"""Tests for strip_for_spellcheck.py."""

import shutil
import sys
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

sys.path.append(str(Path(__file__).parent.parent))

if TYPE_CHECKING:
    from .. import strip_for_spellcheck
else:
    import strip_for_spellcheck


@pytest.mark.parametrize(
    "line, expected",
    [
        pytest.param("", 0, id="empty"),
        pytest.param("regular text", 0, id="plain-text"),
        pytest.param("> text", 1, id="level-1"),
        pytest.param("> > text", 2, id="level-2"),
        pytest.param("> > > text", 3, id="level-3"),
        pytest.param(">text", 1, id="no-space-after-gt"),
        pytest.param("> ", 1, id="trailing-space"),
        pytest.param(">", 1, id="bare-gt"),
        pytest.param("  > text", 1, id="leading-spaces"),
        pytest.param(">> text", 2, id="consecutive-gt"),
    ],
)
def test_get_quote_level(line: str, expected: int):
    assert strip_for_spellcheck.get_quote_level(line) == expected


@pytest.mark.parametrize(
    "line, expected",
    [
        pytest.param("> [!quote]", True, id="basic-quote"),
        pytest.param("> [!quote] Title", True, id="quote-with-title"),
        pytest.param("> [!quote]- Collapsible", True, id="collapsible-minus"),
        pytest.param("> [!quote]+ Expanded", True, id="expanded-plus"),
        pytest.param("> > [!quote] Nested", True, id="nested-level-2"),
        pytest.param("> [!quote]Author Name", True, id="no-space-before-title"),
        pytest.param("> [!Quote]", False, id="mixed-case-rejected"),
        pytest.param("> [!QUOTE]", False, id="upper-case-rejected"),
        pytest.param("> [!note]", False, id="note-not-quote"),
        pytest.param("> [!warning]", False, id="warning-not-quote"),
        pytest.param("regular text", False, id="plain-text"),
        pytest.param("", False, id="empty-string"),
        pytest.param("> [!quotation]", False, id="quotation-not-quote"),
    ],
)
def test_is_quote_callout_start(line: str, expected: bool):
    assert strip_for_spellcheck.is_quote_callout_start(line) == expected


@pytest.mark.parametrize(
    "text, expected",
    [
        # Identity cases (no modification)
        pytest.param("", "", id="empty"),
        pytest.param(
            "Regular text\nMore text\n\nAnother paragraph",
            "Regular text\nMore text\n\nAnother paragraph",
            id="no-quotes",
        ),
        pytest.param(
            "> [!note]\n> Note content\n> More note",
            "> [!note]\n> Note content\n> More note",
            id="preserves-non-quote-callout",
        ),
        # Basic stripping
        pytest.param(
            "> [!quote] Title\n> Content line\n\nAfter quote",
            "\n\n\nAfter quote",
            id="simple-quote",
        ),
        pytest.param(
            "> [!quote]- Collapsible title\n> Hidden content",
            "\n",
            id="collapsible",
        ),
        # Mixed-case [!Quote] is NOT matched (case-sensitive)
        pytest.param(
            "> [!Quote] Title\n> Content",
            "> [!Quote] Title\n> Content",
            id="mixed-case-not-stripped",
        ),
        pytest.param(
            "Before\n> [!quote]\n> Content",
            "Before\n\n",
            id="quote-at-end",
        ),
        # Bare > (blank blockquote line) inside quote
        pytest.param(
            "> [!quote] Title\n>\n> Content\n\nAfter",
            "\n\n\n\nAfter",
            id="bare-gt-in-quote",
        ),
        pytest.param(
            "> [!quote]\n>\n> Content\n\nKept",
            "\n\n\n\nKept",
            id="no-title-with-bare-gt",
        ),
        # Multiple blocks separated by blank line
        pytest.param(
            "> [!quote] First\n> Content1\n\n> [!quote] Second\n> Content2",
            "\n\n\n\n",
            id="multiple-blocks",
        ),
        # Nested quote inside other callout
        pytest.param(
            "> [!note]\n> Text\n> > [!quote] Attr\n> > Quoted\n> Back",
            "> [!note]\n> Text\n\n\n> Back",
            id="nested-in-other-callout",
        ),
        # Stress: quote-only file (no surrounding text)
        pytest.param("> [!quote]\n> Content", "\n", id="quote-only-file"),
        # Stress: header only, no content lines
        pytest.param(
            "> [!quote]\nPlain text",
            "\nPlain text",
            id="header-only-no-content",
        ),
        # Stress: back-to-back quotes with no blank line
        pytest.param(
            "> [!quote]\n> A\n> [!quote]\n> B",
            "\n\n\n",
            id="back-to-back-quotes",
        ),
        # Stress: deeply nested quote (level 3) returning to level 2
        pytest.param(
            "> > > [!quote]\n> > > Deep\n> > Outer",
            "\n\n> > Outer",
            id="deeply-nested-level-3",
        ),
        # Stress: many content lines
        pytest.param(
            "> [!quote]\n" + "\n".join(f"> Line {i}" for i in range(20)),
            "\n" * 20,
            id="many-content-lines",
        ),
        # Stress: quote sandwiched between non-quote callouts
        pytest.param(
            "> [!note]\n> N1\n\n> [!quote]\n> Q\n\n> [!warning]\n> W1",
            "> [!note]\n> N1\n\n\n\n\n> [!warning]\n> W1",
            id="quote-between-callouts",
        ),
    ],
)
def test_strip_quote_blocks(text: str, expected: str):
    result = strip_for_spellcheck.strip_quote_blocks(text)
    assert result == expected
    assert result.count("\n") == text.count("\n"), (
        "Line count must be preserved"
    )


def _blank_inner_spans(text: str, spans: list[tuple[int, int]]) -> str:
    """
    Build expected by blanking the math interior, keeping `$` delimiters.

    Each span is `(start, end_exclusive)` of a full math match. The leading and
    trailing `$` (or `$$`) are kept; the interior non-newline chars become
    spaces, newlines are kept.
    """
    out = list(text)
    for start, end in spans:
        delim_len = 2 if text[start : start + 2] == "$$" else 1
        inner_start = start + delim_len
        inner_end = end - delim_len
        for i in range(inner_start, inner_end):
            if out[i] != "\n":
                out[i] = " "
    return "".join(out)


@pytest.mark.parametrize(
    "text, blanks",
    [
        # Identity cases
        pytest.param("", [], id="empty"),
        pytest.param("plain text", [], id="no-math"),
        pytest.param("price is \\$5", [], id="escaped-dollar"),
        pytest.param("a $ alone", [], id="single-unmatched-dollar"),
        # Inline math: $...$
        pytest.param("Let $x=1$ here.", [(4, 9)], id="inline-basic"),
        pytest.param(
            "$\\frac{1}{2}$ and $a+b$",
            [(0, 13), (18, 23)],
            id="multiple-inline",
        ),
        pytest.param(
            "$\\cdot.5$ inside",
            [(0, 9)],
            id="inline-cdot-real-case",
        ),
        # Inline math: don't cross newlines
        pytest.param("$start\nend$ tail", [], id="inline-no-newline-cross"),
        # Display math: $$...$$
        pytest.param("$$a=b$$", [(0, 7)], id="display-single-line"),
        pytest.param(
            "before\n$$\nx=1\n$$\nafter",
            [(7, 16)],
            id="display-multi-line",
        ),
        pytest.param(
            "$$x$$ then $y$", [(0, 5), (11, 14)], id="display-then-inline"
        ),
        # Escaped delimiters are not start/end markers
        pytest.param("\\$x=1\\$ kept", [], id="escaped-delims-kept"),
        # Backslash-escaped dollar inside inline math is permitted
        pytest.param("$\\$5$ done", [(0, 5)], id="inline-with-escaped-dollar"),
    ],
)
def test_strip_math(text: str, blanks: list[tuple[int, int]]):
    expected = _blank_inner_spans(text, blanks)
    result = strip_for_spellcheck.strip_math(text)
    assert result == expected
    assert result.count("\n") == text.count("\n"), (
        "Line count must be preserved"
    )
    assert len(result) == len(text), "Length must be preserved"


@pytest.mark.parametrize(
    "text, expected",
    [
        pytest.param("", "", id="empty"),
        pytest.param("no tags here", "no tags here", id="no-tags"),
        # The canonical case: span fuses inner letter with following word
        pytest.param(
            '<span class="dropcap" data-first-letter="D">d</span>ropcap',
            "dropcap",
            id="dropcap-span-fuses",
        ),
        # Capital letter inside span
        pytest.param(
            '<span class="dropcap" data-first-letter="T">T</span>his',
            "This",
            id="dropcap-capital",
        ),
        # `div` is also handled
        pytest.param(
            '<div class="dropcap" data-first-letter="A">A</div>',
            "A",
            id="dropcap-div-standalone",
        ),
        # Multi-class — `dropcap` is one of several classes
        pytest.param(
            '<span class="dropcap ignore-pa11y" aria-hidden="true">A</span>',
            "A",
            id="dropcap-multiclass",
        ),
        # Non-dropcap spans are left alone (so unrelated HTML survives)
        pytest.param(
            '<span class="other">x</span>tail',
            '<span class="other">x</span>tail',
            id="non-dropcap-span-preserved",
        ),
        # Inline code containing a dropcap-looking string is preserved as-is
        # because dropcap spans inside backticks are part of a literal example
        # — but the regex still matches it (we accept this since dropcap
        # examples in code are vanishingly rare in real content).
        pytest.param(
            '`<span class="dropcap">d</span>ropcap`',
            "`dropcap`",
            id="dropcap-in-backticks",
        ),
        # Mismatched open/close tags don't match
        pytest.param(
            '<span class="dropcap">d</div>ropcap',
            '<span class="dropcap">d</div>ropcap',
            id="mismatched-tags-preserved",
        ),
    ],
)
def test_strip_dropcap_tags(text: str, expected: str):
    result = strip_for_spellcheck.strip_dropcap_tags(text)
    assert result == expected


@pytest.mark.parametrize(
    "text, expected",
    [
        pytest.param("", "", id="empty"),
        pytest.param("plain text", "plain text", id="no-callout"),
        pytest.param(
            "> [!info] Title\n> Body",
            ">         Title\n> Body",
            id="basic-marker",
        ),
        pytest.param(
            "> [!thanks]+ Acks\n> Body",
            ">            Acks\n> Body",
            id="expanded-modifier",
        ),
        pytest.param(
            "> [!idea]- Hidden",
            ">          Hidden",
            id="collapsible-modifier",
        ),
        pytest.param(
            "> > [!note] Nested",
            "> >         Nested",
            id="nested-level-2",
        ),
        # Inline `[!type]` outside a blockquote is left alone.
        pytest.param(
            "see [!info] here", "see [!info] here", id="inline-skipped"
        ),
        # Uppercase / mixed-case callout types are still markers in Obsidian
        # syntax; blank them too so the parser confusion is neutralized.
        pytest.param("> [!Note] Title", ">         Title", id="mixed-case"),
    ],
)
def test_strip_callout_markers(text: str, expected: str):
    result = strip_for_spellcheck.strip_callout_markers(text)
    assert result == expected
    assert len(result) == len(text), "Length must be preserved"
    assert result.count("\n") == text.count("\n"), (
        "Line count must be preserved"
    )


def test_strip_for_lint_blanks_non_quote_callout_marker():
    # The integration pipeline (quote-strip → callout-marker-strip → …) should
    # neutralize `[!type]` on non-quote callouts so a trailing period two
    # paragraphs earlier doesn't get fused with its preceding word.
    text = "Done evaluability.\n\n> [!thanks] Acks\n> Body"
    result = strip_for_spellcheck.strip_for_lint(text)
    assert "[!thanks]" not in result
    assert "Done evaluability." in result
    assert result.count("\n") == text.count("\n")


def test_strip_for_lint_composes_quote_then_math():
    # Quote block strips first; math inside the quote is consumed with it.
    text = "> [!quote]\n> $x=1$\n\nAfter"
    assert strip_for_spellcheck.strip_for_lint(text) == "\n\n\nAfter"


def test_strip_for_lint_composes_math_outside_quote():
    # Math outside the quote is blanked (delimiters kept); quote stripped.
    text = "Inline $a$ and quote.\n> [!quote]\n> Q\n\nDone"
    result = strip_for_spellcheck.strip_for_lint(text)
    # Line count is preserved across the pipeline.
    assert result.count("\n") == text.count("\n")
    # The math span `$a$` becomes `$ $` (delimiters kept, inner blanked).
    assert "Inline $ $ and quote." in result
    # The original quote line should be gone (replaced with blank line).
    assert "[!quote]" not in result


class TestCreateStrippedDirectory:
    def test_strips_quotes_and_preserves_structure(self, tmp_path: Path):
        source = tmp_path / "source"
        subdir = source / "subdir"
        subdir.mkdir(parents=True)
        (source / "root.md").write_text(
            "> [!quote]\n> Quoted\n\nKept", encoding="utf-8"
        )
        nested_text = "Hello $x=1$ world"
        (subdir / "nested.md").write_text(nested_text, encoding="utf-8")
        (source / "ignored.txt").write_text("txt content", encoding="utf-8")

        output = tmp_path / "output"
        result = strip_for_spellcheck.create_stripped_directory(source, output)

        assert result == output
        assert (output / "root.md").read_text(encoding="utf-8") == "\n\n\nKept"
        nested_out = (output / "subdir" / "nested.md").read_text(
            encoding="utf-8"
        )
        # Math `$x=1$` becomes a placeholder of the same length.
        assert len(nested_out) == len(nested_text)
        assert nested_out.startswith("Hello ")
        assert nested_out.endswith(" world")
        assert not (output / "ignored.txt").exists()

    def test_creates_temp_dir_when_no_output(self, tmp_path: Path):
        source = tmp_path / "source"
        source.mkdir()
        (source / "test.md").write_text("content", encoding="utf-8")

        result = strip_for_spellcheck.create_stripped_directory(source)

        assert result.exists()
        assert "stripped_for_spellcheck_" in result.name
        shutil.rmtree(result)


class TestMain:
    def test_with_explicit_args(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys
    ):
        source = tmp_path / "source"
        source.mkdir()
        source_text = "> [!quote]\n> Content\n\n$x=1$"
        (source / "test.md").write_text(source_text, encoding="utf-8")
        output = tmp_path / "output"

        monkeypatch.setattr(
            "sys.argv",
            [
                "strip_for_spellcheck.py",
                "--source-dir",
                str(source),
                "--output-dir",
                str(output),
            ],
        )

        strip_for_spellcheck.main()

        captured = capsys.readouterr()
        assert str(output) in captured.out
        out_text = (output / "test.md").read_text()
        # Line count preserved; quote stripped; math interior blanked.
        assert out_text.count("\n") == source_text.count("\n")
        assert out_text.startswith("\n\n\n")
        assert "Content" not in out_text
        # `$x=1$` blanked to `$   $` (delimiters kept, 3 inner chars).
        assert out_text.endswith("$   $")

    def test_default_source_dir(
        self,
        mock_git_root: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ):
        content_dir = mock_git_root / "website_content"
        content_dir.mkdir()
        (content_dir / "test.md").write_text("content", encoding="utf-8")
        output = mock_git_root / "output"

        monkeypatch.setattr(
            "sys.argv",
            ["strip_for_spellcheck.py", "--output-dir", str(output)],
        )

        strip_for_spellcheck.main()

        captured = capsys.readouterr()
        assert str(output) in captured.out
