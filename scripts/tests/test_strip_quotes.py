"""Tests for strip_quotes.py."""

import shutil
import sys
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

sys.path.append(str(Path(__file__).parent.parent))

if TYPE_CHECKING:
    from .. import strip_quotes
else:
    import strip_quotes


@pytest.mark.parametrize(
    "line, expected",
    [
        ("", 0),
        ("regular text", 0),
        ("> text", 1),
        ("> > text", 2),
        ("> > > text", 3),
        (">text", 1),
        ("> ", 1),
        (">", 1),
        ("  > text", 1),  # leading spaces before >
        (">> text", 2),  # consecutive > without space
    ],
    ids=[
        "empty",
        "plain-text",
        "level-1",
        "level-2",
        "level-3",
        "no-space-after-gt",
        "trailing-space",
        "bare-gt",
        "leading-spaces",
        "consecutive-gt",
    ],
)
def test_get_quote_level(line: str, expected: int):
    assert strip_quotes.get_quote_level(line) == expected


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
    assert strip_quotes.is_quote_callout_start(line) == expected


@pytest.mark.parametrize(
    "text, expected",
    [
        # Identity cases (no modification)
        ("", ""),
        ("Regular text\nMore text\n\nAnother paragraph",
         "Regular text\nMore text\n\nAnother paragraph"),
        ("> [!note]\n> Note content\n> More note",
         "> [!note]\n> Note content\n> More note"),
        # Basic stripping
        ("> [!quote] Title\n> Content line\n\nAfter quote",
         "\n\n\nAfter quote"),
        ("> [!quote]- Collapsible title\n> Hidden content", "\n"),
        # Mixed-case [!Quote] is NOT matched (case-sensitive)
        ("> [!Quote] Title\n> Content",
         "> [!Quote] Title\n> Content"),
        ("Before\n> [!quote]\n> Content", "Before\n\n"),
        # Bare > (blank blockquote line) inside quote
        ("> [!quote] Title\n>\n> Content\n\nAfter", "\n\n\n\nAfter"),
        ("> [!quote]\n>\n> Content\n\nKept", "\n\n\n\nKept"),
        # Multiple blocks separated by blank line
        ("> [!quote] First\n> Content1\n\n> [!quote] Second\n> Content2",
         "\n\n\n\n"),
        # Nested quote inside other callout
        ("> [!note]\n> Text\n> > [!quote] Attr\n> > Quoted\n> Back",
         "> [!note]\n> Text\n\n\n> Back"),
        # Stress: quote-only file (no surrounding text)
        ("> [!quote]\n> Content", "\n"),
        # Stress: header only, no content lines
        ("> [!quote]\nPlain text", "\nPlain text"),
        # Stress: back-to-back quotes with no blank line
        ("> [!quote]\n> A\n> [!quote]\n> B", "\n\n\n"),
        # Stress: deeply nested quote (level 3) returning to level 2
        ("> > > [!quote]\n> > > Deep\n> > Outer", "\n\n> > Outer"),
        # Stress: many content lines
        ("> [!quote]\n" + "\n".join(f"> Line {i}" for i in range(20)),
         "\n" * 20),
        # Stress: quote sandwiched between non-quote callouts
        ("> [!note]\n> N1\n\n> [!quote]\n> Q\n\n> [!warning]\n> W1",
         "> [!note]\n> N1\n\n\n\n\n> [!warning]\n> W1"),
    ],
    ids=[
        "empty",
        "no-quotes",
        "preserves-non-quote-callout",
        "simple-quote",
        "collapsible",
        "mixed-case-not-stripped",
        "quote-at-end",
        "bare-gt-in-quote",
        "no-title-with-bare-gt",
        "multiple-blocks",
        "nested-in-other-callout",
        "quote-only-file",
        "header-only-no-content",
        "back-to-back-quotes",
        "deeply-nested-level-3",
        "many-content-lines",
        "quote-between-callouts",
    ],
)
def test_strip_quote_blocks(text: str, expected: str):
    result = strip_quotes.strip_quote_blocks(text)
    assert result == expected
    assert result.count("\n") == text.count("\n"), "Line count must be preserved"


class TestCreateStrippedDirectory:
    def test_strips_quotes_and_preserves_structure(self, tmp_path: Path):
        source = tmp_path / "source"
        subdir = source / "subdir"
        subdir.mkdir(parents=True)
        (source / "root.md").write_text(
            "> [!quote]\n> Quoted\n\nKept", encoding="utf-8"
        )
        (subdir / "nested.md").write_text("content", encoding="utf-8")
        (source / "ignored.txt").write_text("txt content", encoding="utf-8")

        output = tmp_path / "output"
        result = strip_quotes.create_stripped_directory(source, output)

        assert result == output
        assert (output / "root.md").read_text(encoding="utf-8") == "\n\n\nKept"
        assert (output / "subdir" / "nested.md").read_text() == "content"
        assert not (output / "ignored.txt").exists()

    def test_creates_temp_dir_when_no_output(self, tmp_path: Path):
        source = tmp_path / "source"
        source.mkdir()
        (source / "test.md").write_text("content", encoding="utf-8")

        result = strip_quotes.create_stripped_directory(source)

        assert result.exists()
        assert "stripped_quotes_" in result.name
        shutil.rmtree(result)


class TestMain:
    def test_with_explicit_args(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys
    ):
        source = tmp_path / "source"
        source.mkdir()
        (source / "test.md").write_text(
            "> [!quote]\n> Content", encoding="utf-8"
        )
        output = tmp_path / "output"

        monkeypatch.setattr(
            "sys.argv",
            [
                "strip_quotes.py",
                "--source-dir",
                str(source),
                "--output-dir",
                str(output),
            ],
        )

        strip_quotes.main()

        captured = capsys.readouterr()
        assert str(output) in captured.out
        assert (output / "test.md").read_text() == "\n"

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
            ["strip_quotes.py", "--output-dir", str(output)],
        )

        strip_quotes.main()

        captured = capsys.readouterr()
        assert str(output) in captured.out
