"""Tests for strip_quotes.py."""

import shutil
import sys
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

from .. import utils as script_utils

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
        ("> [!quote]", True),
        ("> [!quote] Title", True),
        ("> [!quote]- Collapsible", True),
        ("> [!quote]+ Expanded", True),
        ("> > [!quote] Nested", True),
        ("> [!Quote]", True),  # case insensitive
        ("> [!QUOTE]", True),  # case insensitive
        ("> [!note]", False),
        ("> [!warning]", False),
        ("regular text", False),
        ("", False),
        ("> [!quotation]", False),  # must not match partial
    ],
    ids=[
        "basic",
        "with-title",
        "collapsible",
        "expanded",
        "nested",
        "mixed-case",
        "upper-case",
        "note-callout",
        "warning-callout",
        "plain-text",
        "empty",
        "quotation-not-quote",
    ],
)
def test_is_quote_callout_start(line: str, expected: bool):
    assert strip_quotes.is_quote_callout_start(line) == expected


class TestStripQuoteBlocks:
    def test_simple_quote_block(self):
        text = "> [!quote] Title\n> Content line\n\nAfter quote"
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "\n\n\nAfter quote"

    def test_preserves_non_quote_callouts(self):
        text = "> [!note]\n> Note content\n> More note"
        assert strip_quotes.strip_quote_blocks(text) == text

    def test_nested_quote_inside_other_callout(self):
        text = (
            "> [!note]\n"
            "> Text\n"
            "> > [!quote] Attribution\n"
            "> > Quoted text\n"
            "> Back to note"
        )
        result = strip_quotes.strip_quote_blocks(text)
        assert result == (
            "> [!note]\n" "> Text\n" "\n" "\n" "> Back to note"
        )

    def test_empty_text(self):
        assert strip_quotes.strip_quote_blocks("") == ""

    def test_no_quotes(self):
        text = "Regular text\nMore text\n\nAnother paragraph"
        assert strip_quotes.strip_quote_blocks(text) == text

    def test_multiple_quote_blocks(self):
        text = (
            "> [!quote] First\n"
            "> Content1\n"
            "\n"
            "> [!quote] Second\n"
            "> Content2"
        )
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "\n\n\n\n"

    def test_line_count_preserved(self):
        text = "Line 1\n> [!quote]\n> Content\n> More\nLine 5"
        result = strip_quotes.strip_quote_blocks(text)
        assert result.count("\n") == text.count("\n")

    def test_quote_with_blank_blockquote_line(self):
        """Quote block containing bare ``>`` (blank line within blockquote)."""
        text = "> [!quote] Title\n>\n> Content\n\nAfter"
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "\n\n\n\nAfter"

    def test_collapsible_quote(self):
        text = "> [!quote]- Collapsible title\n> Hidden content"
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "\n"

    def test_quote_at_end_of_file(self):
        text = "Before\n> [!quote]\n> Content"
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "Before\n\n"

    def test_case_insensitive(self):
        text = "> [!Quote] Title\n> Content"
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "\n"

    def test_no_title_with_blank_line(self):
        """Quote with no title and blank ``>`` before content."""
        text = "> [!quote]\n>\n> Content\n\nKept"
        result = strip_quotes.strip_quote_blocks(text)
        assert result == "\n\n\n\nKept"


class TestCreateStrippedDirectory:
    def test_creates_stripped_files(self, tmp_path: Path):
        source = tmp_path / "source"
        source.mkdir()
        (source / "test.md").write_text(
            "> [!quote]\n> Quoted\n\nKept", encoding="utf-8"
        )

        output = tmp_path / "output"
        result = strip_quotes.create_stripped_directory(source, output)

        assert result == output
        stripped = (output / "test.md").read_text(encoding="utf-8")
        assert stripped == "\n\n\nKept"

    def test_preserves_subdirectory_structure(self, tmp_path: Path):
        source = tmp_path / "source"
        subdir = source / "subdir"
        subdir.mkdir(parents=True)
        (subdir / "test.md").write_text("content", encoding="utf-8")

        output = tmp_path / "output"
        strip_quotes.create_stripped_directory(source, output)

        assert (output / "subdir" / "test.md").exists()
        assert (output / "subdir" / "test.md").read_text() == "content"

    def test_creates_temp_dir_when_no_output(self, tmp_path: Path):
        source = tmp_path / "source"
        source.mkdir()
        (source / "test.md").write_text("content", encoding="utf-8")

        result = strip_quotes.create_stripped_directory(source)

        assert result.exists()
        assert "stripped_quotes_" in result.name
        shutil.rmtree(result)

    def test_only_processes_md_files(self, tmp_path: Path):
        source = tmp_path / "source"
        source.mkdir()
        (source / "test.md").write_text("md content", encoding="utf-8")
        (source / "test.txt").write_text("txt content", encoding="utf-8")

        output = tmp_path / "output"
        strip_quotes.create_stripped_directory(source, output)

        assert (output / "test.md").exists()
        assert not (output / "test.txt").exists()


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

        result = strip_quotes.main()

        assert result == 0
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

        result = strip_quotes.main()

        assert result == 0
        captured = capsys.readouterr()
        assert str(output) in captured.out
