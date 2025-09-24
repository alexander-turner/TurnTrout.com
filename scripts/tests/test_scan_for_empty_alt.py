import sys
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


def test_paragraph_context_grabs_neighboring_paragraphs() -> None:
    """Ensure that the context snippet contains adjacent paragraphs."""

    lines = [
        "Para A line 1\n",
        "\n",
        "Para B line 1\n",
        "Para B line 2\n",
        "\n",
        "Para C line 1\n",
    ]

    snippet = scan_for_empty_alt._paragraph_context(lines, 2, num_paragraphs=1)

    # Should include paragraphs B and C, but not A.
    assert "Para A" not in snippet
    assert "Para B line 1" in snippet and "Para B line 2" in snippet
    assert "Para C line 1" in snippet
