import sys
import textwrap
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).parent.parent))

import typing

if typing.TYPE_CHECKING:
    from .. import scan_for_empty_alt
else:
    import scan_for_empty_alt


@pytest.mark.parametrize(
    "alt, expected",
    [
        (None, False),
        ("", False),
        ("   ", False),
        ("image", False),
        ("A meaningful description", True),
        ("Meaningful", True),
    ],
)
def test_is_alt_meaningful(alt: str | None, expected: bool) -> None:
    assert scan_for_empty_alt._is_alt_meaningful(alt) is expected


def _write_md(tmp_path: Path, content: str, name: str = "test.md") -> Path:
    file_path = tmp_path / name
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_build_queue_markdown_asset(tmp_path: Path) -> None:
    md_content = """
Paragraph one.

![](img/foo.png)

Paragraph two.
"""
    _write_md(tmp_path, md_content)
    queue = scan_for_empty_alt.build_queue(tmp_path)
    assert len(queue) == 1
    item = queue[0]
    assert item.asset_path == "img/foo.png"
    assert item.line_number == 4
    assert "Paragraph one." in item.context_snippet
    assert "Paragraph two." in item.context_snippet


def test_build_queue_html_img_missing_alt(tmp_path: Path) -> None:
    md_content = """
Intro.

<img src=\"assets/pic.jpg\">
"""
    _write_md(tmp_path, md_content, "html.md")
    queue = scan_for_empty_alt.build_queue(tmp_path)
    assert len(queue) == 1, f"{queue} doesn't have the right elements"
    assert queue[0].asset_path == "assets/pic.jpg"


def test_build_queue_ignores_good_alt(tmp_path: Path) -> None:
    md_content = "![](foo.png)\n\n![Good alt](bar.png)"
    _write_md(tmp_path, md_content)
    queue = scan_for_empty_alt.build_queue(tmp_path)

    # only the empty alt should be queued
    assert len(queue) == 1, f"{queue} doesn't have the right elements"
    assert queue[0].asset_path == "foo.png"


@pytest.mark.parametrize(
    "content, expected_paths",
    [
        ("![](img/blank.png)", ["img/blank.png"]),
        ("![Good desc](img/good.png)", []),
        (
            '<img src="assets/foo.jpg" alt="photo">\n',
            ["assets/foo.jpg"],
        ),
        (
            '<img src="assets/bar.jpg" alt="Meaningful description">\n',
            [],
        ),
        (
            '<img src="assets/baz.jpg" alt="">\n',
            ["assets/baz.jpg"],
        ),
    ],
)
def test_queue_expected_paths(
    tmp_path: Path, content: str, expected_paths: list[str]
) -> None:
    """Verify that *build_queue* includes exactly the expected offending assets."""

    file_path = tmp_path / "edge.md"
    file_path.write_text(content, encoding="utf-8")

    queue = scan_for_empty_alt.build_queue(tmp_path)
    assert sorted(item.asset_path for item in queue) == sorted(expected_paths)


def test_html_img_line_number_fallback(tmp_path: Path) -> None:
    """If markdown-it does not supply *token.map* for an HTML image, the
    fallback logic should locate the correct source line instead of defaulting
    to 1."""

    md_content = textwrap.dedent(
        """
        Intro line.

        <img src="assets/foo.jpg">

        After image.
        """
    )
    _write_md(tmp_path, md_content, "fallback.md")

    queue = scan_for_empty_alt.build_queue(tmp_path)
    assert len(queue) == 1

    item = queue[0]
    # The <img> tag is on the 4th line of the file (1-based)
    assert item.line_number == 4, f"Expected line 4, got {item.line_number}"


def test_html_img_line_number_with_frontmatter(tmp_path: Path) -> None:
    """Ensure line numbers for HTML images located *after* YAML front-matter
    are computed relative to the full file."""

    md_content = textwrap.dedent(
        """
        ---
        title: Sample
        ---

        Preamble text.

        <img src="assets/bar.jpg">
        """
    )
    file_path = _write_md(tmp_path, md_content, "frontmatter.md")

    # Sanity-check the actual line number of the <img> element
    img_line_no = next(
        idx + 1
        for idx, ln in enumerate(file_path.read_text().splitlines())
        if "<img" in ln
    )

    queue = scan_for_empty_alt.build_queue(tmp_path)
    assert len(queue) == 1
    assert queue[0].line_number == img_line_no
