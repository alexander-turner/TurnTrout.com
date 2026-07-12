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


def _uw(word: str, source: str = "x.html", context: str = "") -> object:
    return spellcheck_triage.UnknownWord(
        word=word, source=source, context=context
    )


def _dec(word: str, action: str, reason: str = "") -> object:
    return spellcheck_triage.Decision(word=word, action=action, reason=reason)


def _response(decisions: list[dict]) -> MagicMock:
    """Build a fake Anthropic response with ``decisions`` as JSON text."""
    block = MagicMock(type="text", text=json.dumps({"decisions": decisions}))
    return MagicMock(content=[block])


@pytest.fixture
def wordlist(tmp_path: Path) -> Path:
    p = tmp_path / "wordlist.txt"
    p.write_text("Apple\nKaTeX\n")
    return p


# ---------- _context_for ---------------------------------------------------


@pytest.mark.parametrize(
    "paragraphs,word,expected",
    [
        ([], "KaTeX", ""),
        (["unrelated text"], "KaTeX", ""),
        (["  KaTeX is fast.  "], "KaTeX", "KaTeX is fast."),
    ],
)
def test_context_for(paragraphs, word, expected):
    assert spellcheck_triage._context_for(paragraphs, word) == expected


def test_context_for_truncates_oversized_paragraph():
    para = "X" * (spellcheck_triage._CONTEXT_MAX + 100) + " KaTeX"
    ctx = spellcheck_triage._context_for([para], "KaTeX")
    assert ctx.endswith("…") and len(ctx) == spellcheck_triage._CONTEXT_MAX + 1


# ---------- _parse_decisions ----------------------------------------------


def test_parse_decisions_parses_valid_actions():
    text = json.dumps(
        {
            "decisions": [
                {"word": "KaTeX", "action": "add", "reason": "Known."},
                {"word": "xyzzy", "action": "defer", "reason": "Unclear."},
            ]
        }
    )
    assert [
        (d.word, d.action) for d in spellcheck_triage._parse_decisions(text)
    ] == [("KaTeX", "add"), ("xyzzy", "defer")]


def test_parse_decisions_tolerates_prose_around_json():
    text = (
        "Here you go:\n"
        '{"decisions": [{"word": "KaTeX", "action": "add"}]}\nThanks!'
    )
    assert spellcheck_triage._parse_decisions(text)[0].word == "KaTeX"


def test_parse_decisions_raises_without_json():
    with pytest.raises(ValueError, match="No JSON object"):
        spellcheck_triage._parse_decisions("nothing json-shaped here")


def test_parse_decisions_raises_on_invalid_action():
    text = json.dumps({"decisions": [{"word": "bad", "action": "maybe"}]})
    with pytest.raises(ValueError, match="invalid action"):
        spellcheck_triage._parse_decisions(text)


def test_parse_decisions_raises_on_missing_decisions_list():
    text = json.dumps({"not_decisions": []})
    with pytest.raises(ValueError, match="missing a 'decisions' list"):
        spellcheck_triage._parse_decisions(text)


@pytest.mark.parametrize(
    "item",
    [
        {"action": "add"},  # missing "word"
        "not-an-object",
    ],
)
def test_parse_decisions_raises_on_malformed_item(item: object):
    text = json.dumps({"decisions": [item]})
    with pytest.raises(ValueError, match="Malformed decision item"):
        spellcheck_triage._parse_decisions(text)


# ---------- classify -------------------------------------------------------


def test_classify_short_circuits_on_empty():
    assert spellcheck_triage.classify([]) == []


def test_classify_injects_client_and_forwards_context():
    client = MagicMock()
    client.messages.create.return_value = _response(
        [{"word": "KaTeX", "action": "add", "reason": "Known."}]
    )
    result = spellcheck_triage.classify(
        [_uw("KaTeX", source="open-source.html", context="KaTeX API")],
        client=client,
    )
    assert [(d.word, d.action) for d in result] == [("KaTeX", "add")]
    sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "KaTeX" in sent and "open-source.html" in sent


def test_classify_lazily_constructs_default_anthropic_client(monkeypatch):
    fake_anthropic = MagicMock()
    fake_anthropic.Anthropic.return_value.messages.create.return_value = (
        _response([{"word": "KaTeX", "action": "add"}])
    )
    monkeypatch.setitem(sys.modules, "anthropic", fake_anthropic)
    spellcheck_triage.classify([_uw("KaTeX")])
    fake_anthropic.Anthropic.assert_called_once_with()


# ---------- apply_additions ------------------------------------------------


def test_apply_additions_inserts_new_words_case_insensitively(wordlist: Path):
    added = spellcheck_triage.apply_additions(
        [_dec("Banana", "add"), _dec("xyzzy", "defer")], wordlist
    )
    assert added == ["Banana"]
    assert wordlist.read_text().splitlines() == ["Apple", "Banana", "KaTeX"]


@pytest.mark.parametrize(
    "decisions",
    [
        pytest.param([_dec("KaTeX", "add")], id="word-already-present"),
        pytest.param([_dec("xyzzy", "defer")], id="no-add-decisions"),
    ],
)
def test_apply_additions_noop(decisions, wordlist: Path):
    original = wordlist.read_text()
    assert spellcheck_triage.apply_additions(decisions, wordlist) == []
    assert wordlist.read_text() == original


# ---------- _format_deferrals ---------------------------------------------


def test_format_deferrals_renders_only_defers_with_context():
    lookup = {"foo": _uw("foo", source="p.html", context="foo appears here")}
    out = spellcheck_triage._format_deferrals(
        [_dec("foo", "defer", "Unclear neologism."), _dec("bar", "add")],
        lookup,
    )
    assert "foo" in out and "p.html" in out and "Unclear neologism" in out
    assert "bar" not in out


def test_format_deferrals_handles_missing_lookup_entry():
    out = spellcheck_triage._format_deferrals([_dec("foo", "defer", "?")], {})
    assert "foo" in out and "(?)" in out


# ---------- collect_unknown_words -----------------------------------------


@pytest.fixture
def patch_site_checks(monkeypatch):
    """Monkeypatch the two ``built_site_checks`` helpers used by the script."""

    def install(paragraphs, issues):
        def fake_collect(_soup, _file, _fp, _pub, paragraph_map):
            paragraph_map.update(paragraphs)

        monkeypatch.setattr(
            spellcheck_triage.built_site_checks,
            "_collect_paragraphs_for_spellcheck",
            fake_collect,
        )
        monkeypatch.setattr(
            spellcheck_triage.built_site_checks,
            "_spellcheck_flattened_paragraphs",
            lambda _pm: issues,
        )

    return install


def _make_public(tmp_path: Path, *names: str) -> Path:
    public = tmp_path / "public"
    public.mkdir()
    for name in names:
        (public / name).write_text("<html></html>")
    return public


def test_collect_unknown_words_attaches_source_context(
    tmp_path, patch_site_checks
):
    public = _make_public(tmp_path, "open-source.html")
    patch_site_checks(
        paragraphs={"open-source.html": ["KaTeX powers the math."]},
        issues=[
            "[open-source.html]    - 1:1-1:6  warning  `KaTeX`  retext-spell"
        ],
    )
    [u] = spellcheck_triage.collect_unknown_words(public)
    assert (u.word, u.source) == ("KaTeX", "open-source.html")
    assert "KaTeX" in u.context


def test_collect_unknown_words_dedupes_by_word_and_source(
    tmp_path, patch_site_checks
):
    public = _make_public(tmp_path, "a.html", "b.html")
    patch_site_checks(
        paragraphs={
            "a.html": ["xyzzy appears once"],
            "b.html": ["xyzzy appears again"],
        },
        issues=[
            "[a.html]    - 1:1-1:6  warning  `xyzzy`  retext-spell",
            "[a.html]    - 2:1-2:6  warning  `xyzzy`  retext-spell",
            "[b.html]    - 1:1-1:6  warning  `xyzzy`  retext-spell",
        ],
    )
    unknowns = spellcheck_triage.collect_unknown_words(public)
    assert {u.source for u in unknowns} == {"a.html", "b.html"}


def test_collect_unknown_words_skips_unparsable_warnings(
    tmp_path, patch_site_checks
):
    public = _make_public(tmp_path, "a.html")
    patch_site_checks(paragraphs={}, issues=["malformed warning line"])
    assert spellcheck_triage.collect_unknown_words(public) == []


# ---------- main -----------------------------------------------------------


@pytest.fixture
def patched_main(monkeypatch, wordlist: Path, tmp_path: Path):
    """
    Seed env + stubs so ``main`` runs without real I/O.

    Returns a runner.
    """
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")

    def run(unknowns, decisions, *extra_argv):
        monkeypatch.setattr(
            spellcheck_triage, "collect_unknown_words", lambda _p: unknowns
        )
        monkeypatch.setattr(spellcheck_triage, "classify", lambda _u: decisions)
        argv = [
            "--public",
            str(tmp_path),
            "--wordlist",
            str(wordlist),
            *extra_argv,
        ]
        return spellcheck_triage.main(argv)

    return run


def test_main_requires_anthropic_api_key(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert spellcheck_triage.main(["--public", str(tmp_path)]) == 1


def test_main_reports_and_exits_zero_when_no_unknowns(
    patched_main, wordlist, capsys
):
    original = wordlist.read_text()
    assert patched_main([], []) == 0
    assert "nothing to triage" in capsys.readouterr().out
    assert wordlist.read_text() == original


def test_main_dry_run_prints_decisions_without_writing(
    patched_main, wordlist, capsys
):
    original = wordlist.read_text()
    assert (
        patched_main(
            [_uw("Foo", context="Foo is a tool.")],
            [_dec("Foo", "add", "ok.")],
            "--dry-run",
        )
        == 0
    )
    assert wordlist.read_text() == original
    assert "Foo" in capsys.readouterr().out


def test_main_applies_additions_and_prints_deferrals(
    patched_main, wordlist, capsys
):
    assert (
        patched_main(
            [
                _uw("PyTorch", context="PyTorch is fast."),
                _uw("xyzzy", "y.html", "x"),
            ],
            [
                _dec("PyTorch", "add", "Known."),
                _dec("xyzzy", "defer", "Unknown."),
            ],
        )
        == 0
    )
    assert "PyTorch" in wordlist.read_text().splitlines()
    out = capsys.readouterr().out
    assert "+ PyTorch" in out and "xyzzy" in out and "Unknown." in out


def test_main_reports_when_no_add_decisions(patched_main, wordlist, capsys):
    assert (
        patched_main(
            [_uw("xyzzy", context="xyzzy here.")],
            [_dec("xyzzy", "defer", "typo?")],
        )
        == 0
    )
    assert "No words auto-added" in capsys.readouterr().out
