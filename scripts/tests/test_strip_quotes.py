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
