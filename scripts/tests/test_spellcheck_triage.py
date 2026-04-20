"""Tests for scripts/spellcheck_triage.py."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

sys.path.append(str(Path(__file__).parent.parent))

if TYPE_CHECKING:
    from .. import spellcheck_triage
else:
    import spellcheck_triage


def _fake_response(payload: dict) -> MagicMock:
    block = MagicMock()
    block.type = "text"
    block.text = json.dumps(payload)
    response = MagicMock()
    response.content = [block]
    return response


def test_parse_decisions_extracts_add_and_defer():
    text = (
        "Some prose\n"
        '{"decisions": ['
        '{"word": "KaTeX", "action": "add", "reason": "Known library."},'
        '{"word": "xyzzy", "action": "defer", "reason": "Unclear."}'
        "]}"
    )
    out = spellcheck_triage._parse_decisions(text)
    assert len(out) == 2
    assert out[0].word == "KaTeX"
    assert out[0].action == "add"
    assert out[1].action == "defer"


def test_parse_decisions_rejects_unknown_action():
    text = '{"decisions": [{"word": "foo", "action": "maybe"}]}'
    assert spellcheck_triage._parse_decisions(text) == []


def test_parse_decisions_raises_without_json():
    with pytest.raises(ValueError, match="No JSON object"):
        spellcheck_triage._parse_decisions("totally not json")


def test_classify_empty_returns_empty():
    assert spellcheck_triage.classify([]) == []


def test_classify_defaults_to_real_anthropic_client(monkeypatch):
    """When no client is passed, ``classify`` constructs one from the SDK."""
    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value.messages.create.return_value = (
        _fake_response(
            {
                "decisions": [
                    {
                        "word": "KaTeX",
                        "action": "add",
                        "reason": "Known tool.",
                    }
                ]
            }
        )
    )
    monkeypatch.setitem(sys.modules, "anthropic", mock_anthropic)

    result = spellcheck_triage.classify(
        [
            spellcheck_triage.UnknownWord(
                word="KaTeX", source="x.html", context="KaTeX is fast."
            )
        ]
    )
    assert [(d.word, d.action) for d in result] == [("KaTeX", "add")]
    mock_anthropic.Anthropic.assert_called_once_with()


def test_classify_uses_injected_client():
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _fake_response(
        {
            "decisions": [
                {"word": "KaTeX", "action": "add", "reason": "Known tool."}
            ]
        }
    )
    unknowns = [
        spellcheck_triage.UnknownWord(
            word="KaTeX", source="open-source.html", context="KaTeX's API"
        )
    ]
    result = spellcheck_triage.classify(unknowns, client=mock_client)
    assert [(d.word, d.action) for d in result] == [("KaTeX", "add")]
    # The model received a structured payload with the context.
    call = mock_client.messages.create.call_args
    user_content = call.kwargs["messages"][0]["content"]
    assert "KaTeX" in user_content
    assert "open-source.html" in user_content


def test_apply_additions_inserts_in_alpha_order(tmp_path: Path):
    wordlist = tmp_path / "wordlist.txt"
    wordlist.write_text("Apple\nKaTeX\nZebra\n")

    decisions = [
        spellcheck_triage.Decision(word="Banana", action="add", reason=""),
        spellcheck_triage.Decision(word="xyzzy", action="defer", reason=""),
    ]
    added = spellcheck_triage.apply_additions(decisions, wordlist)
    assert added == ["Banana"]

    lines = wordlist.read_text().splitlines()
    assert lines == ["Apple", "Banana", "KaTeX", "Zebra"]


def test_apply_additions_skips_existing(tmp_path: Path):
    wordlist = tmp_path / "wordlist.txt"
    wordlist.write_text("KaTeX\n")
    decisions = [
        spellcheck_triage.Decision(word="KaTeX", action="add", reason="")
    ]
    assert spellcheck_triage.apply_additions(decisions, wordlist) == []
    assert wordlist.read_text() == "KaTeX\n"


def test_apply_additions_no_add_decisions_is_noop(tmp_path: Path):
    wordlist = tmp_path / "wordlist.txt"
    original = "KaTeX\n"
    wordlist.write_text(original)
    decisions = [
        spellcheck_triage.Decision(word="foo", action="defer", reason="")
    ]
    assert spellcheck_triage.apply_additions(decisions, wordlist) == []
    assert wordlist.read_text() == original


def test_context_for_truncates_long_context():
    long_para = "X" * 600 + " KaTeX"
    ctx = spellcheck_triage._context_for([long_para], "KaTeX")
    assert ctx.endswith("…")
    assert len(ctx) <= spellcheck_triage._CONTEXT_MAX + 1


def test_context_for_returns_empty_when_missing():
    assert spellcheck_triage._context_for([], "KaTeX") == ""
    assert spellcheck_triage._context_for(["no match here"], "KaTeX") == ""


def test_collect_unknown_words_parses_issues(monkeypatch, tmp_path: Path):
    public = tmp_path / "public"
    (public / "a").mkdir(parents=True)
    page = public / "a" / "open-source.html"
    page.write_text(
        "<html><body><p>KaTeX powers the math.</p></body></html>",
        encoding="utf-8",
    )

    def fake_collect(file, file_path, public_dir, paragraph_map):
        paragraph_map["open-source.html"] = ["KaTeX powers the math."]

    def fake_spellcheck(paragraph_map):
        return [
            "[open-source.html]    - 1:1-1:6  warning  `KaTeX`  retext-spell"
        ]

    monkeypatch.setattr(
        spellcheck_triage.built_site_checks,
        "_collect_paragraphs_for_spellcheck",
        fake_collect,
    )
    monkeypatch.setattr(
        spellcheck_triage.built_site_checks,
        "_spellcheck_flattened_paragraphs",
        fake_spellcheck,
    )
    unknowns = spellcheck_triage.collect_unknown_words(public)
    assert len(unknowns) == 1
    assert unknowns[0].word == "KaTeX"
    assert unknowns[0].source == "open-source.html"
    assert "KaTeX" in unknowns[0].context


def test_collect_unknown_words_deduplicates(monkeypatch, tmp_path: Path):
    public = tmp_path / "public"
    public.mkdir()
    (public / "a.html").write_text("<html></html>")
    (public / "b.html").write_text("<html></html>")

    def fake_collect(file, file_path, public_dir, paragraph_map):
        paragraph_map[file] = [f"The word xyzzy appears in {file}"]

    def fake_spellcheck(paragraph_map):
        return [
            "[a.html]    - 1:1-1:6  warning  `xyzzy`  retext-spell",
            "[a.html]    - 2:1-2:6  warning  `xyzzy`  retext-spell",
            "[b.html]    - 1:1-1:6  warning  `xyzzy`  retext-spell",
        ]

    monkeypatch.setattr(
        spellcheck_triage.built_site_checks,
        "_collect_paragraphs_for_spellcheck",
        fake_collect,
    )
    monkeypatch.setattr(
        spellcheck_triage.built_site_checks,
        "_spellcheck_flattened_paragraphs",
        fake_spellcheck,
    )
    unknowns = spellcheck_triage.collect_unknown_words(public)
    # (xyzzy, a.html) and (xyzzy, b.html) are distinct keys.
    assert len(unknowns) == 2
    assert {u.source for u in unknowns} == {"a.html", "b.html"}


def test_collect_unknown_words_skips_unparseable_issues(
    monkeypatch, tmp_path: Path
):
    public = tmp_path / "public"
    public.mkdir()
    (public / "a.html").write_text("<html></html>")

    def fake_spellcheck(paragraph_map):
        return ["malformed issue line without backticks"]

    monkeypatch.setattr(
        spellcheck_triage.built_site_checks,
        "_collect_paragraphs_for_spellcheck",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        spellcheck_triage.built_site_checks,
        "_spellcheck_flattened_paragraphs",
        fake_spellcheck,
    )
    assert spellcheck_triage.collect_unknown_words(public) == []


def test_format_deferrals_lists_deferred_words_only():
    unknowns = {
        "foo": spellcheck_triage.UnknownWord(
            word="foo", source="p.html", context="foo in context"
        ),
    }
    decisions = [
        spellcheck_triage.Decision(
            word="foo", action="defer", reason="Unclear neologism."
        ),
        spellcheck_triage.Decision(word="bar", action="add", reason=""),
    ]
    out = spellcheck_triage._format_deferrals(decisions, unknowns)
    assert "foo" in out
    assert "Unclear neologism" in out
    assert "bar" not in out


def test_main_without_api_key_returns_error(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert spellcheck_triage.main(["--public", str(tmp_path)]) == 1


def test_main_dry_run_prints_decisions_without_writing(
    monkeypatch, tmp_path, capsys
):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    wordlist = tmp_path / "wordlist.txt"
    wordlist.write_text("KaTeX\n")

    monkeypatch.setattr(
        spellcheck_triage,
        "collect_unknown_words",
        lambda _p: [
            spellcheck_triage.UnknownWord(
                word="Foo", source="x.html", context="Foo is a tool."
            )
        ],
    )
    monkeypatch.setattr(
        spellcheck_triage,
        "classify",
        lambda _u: [
            spellcheck_triage.Decision(word="Foo", action="add", reason="ok.")
        ],
    )

    rc = spellcheck_triage.main(
        [
            "--public",
            str(tmp_path),
            "--wordlist",
            str(wordlist),
            "--dry-run",
        ]
    )
    assert rc == 0
    assert wordlist.read_text() == "KaTeX\n"
    captured = capsys.readouterr()
    assert "Foo" in captured.out


def test_main_applies_additions_and_prints_deferrals(
    monkeypatch, tmp_path, capsys
):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    wordlist = tmp_path / "wordlist.txt"
    wordlist.write_text("Apple\n")

    monkeypatch.setattr(
        spellcheck_triage,
        "collect_unknown_words",
        lambda _p: [
            spellcheck_triage.UnknownWord(
                word="KaTeX", source="x.html", context="KaTeX is fast."
            ),
            spellcheck_triage.UnknownWord(
                word="xyzzy", source="y.html", context="xyzzy appears."
            ),
        ],
    )
    monkeypatch.setattr(
        spellcheck_triage,
        "classify",
        lambda _u: [
            spellcheck_triage.Decision(
                word="KaTeX", action="add", reason="Known."
            ),
            spellcheck_triage.Decision(
                word="xyzzy", action="defer", reason="Unknown."
            ),
        ],
    )

    rc = spellcheck_triage.main(
        ["--public", str(tmp_path), "--wordlist", str(wordlist)]
    )
    assert rc == 0
    assert "KaTeX" in wordlist.read_text().splitlines()

    out = capsys.readouterr().out
    assert "+ KaTeX" in out
    assert "xyzzy" in out
    assert "Unknown." in out


def test_main_exits_zero_when_no_unknowns(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setattr(
        spellcheck_triage, "collect_unknown_words", lambda _p: []
    )
    rc = spellcheck_triage.main(["--public", str(tmp_path)])
    assert rc == 0
    assert "nothing to triage" in capsys.readouterr().out


def test_main_reports_when_no_add_decisions(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    wordlist = tmp_path / "wordlist.txt"
    wordlist.write_text("Apple\n")

    monkeypatch.setattr(
        spellcheck_triage,
        "collect_unknown_words",
        lambda _p: [
            spellcheck_triage.UnknownWord(
                word="xyzzy", source="x.html", context="xyzzy here."
            )
        ],
    )
    monkeypatch.setattr(
        spellcheck_triage,
        "classify",
        lambda _u: [
            spellcheck_triage.Decision(
                word="xyzzy", action="defer", reason="typo?"
            )
        ],
    )
    rc = spellcheck_triage.main(
        ["--public", str(tmp_path), "--wordlist", str(wordlist)]
    )
    assert rc == 0
    assert "No words auto-added" in capsys.readouterr().out
