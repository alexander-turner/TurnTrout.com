"""Tests for replace_asset_staging_refs.py"""

from pathlib import Path

import pytest

from scripts.replace_asset_staging_refs import replace_asset_staging_refs


@pytest.fixture
def temp_dirs(tmp_path: Path) -> dict[str, Path]:
    """Create temporary directory structure for testing."""
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()

    staging_dir = content_dir / "asset_staging"
    staging_dir.mkdir()

    return {
        "content": content_dir,
        "staging": staging_dir,
    }


def create_staged_file(staging_dir: Path, filename: str) -> Path:
    """Create a dummy file in the staging directory."""
    file_path = staging_dir / filename
    file_path.write_text("dummy")
    return file_path


def create_markdown_file(
    content_dir: Path, filename: str, content: str
) -> Path:
    """Create a markdown file with given content."""
    file_path = content_dir / filename
    file_path.write_text(content)
    return file_path


def run_replacement(staging_dir: Path, content_dir: Path) -> None:
    """Run the asset staging reference replacement."""
    replace_asset_staging_refs(staging_dir, content_dir)


def assert_content_contains(file_path: Path, expected: str) -> None:
    """Assert that file contains expected string."""
    content = file_path.read_text()
    assert (
        expected in content
    ), f"Expected '{expected}' not found in:\n{content}"


def assert_content_not_contains(file_path: Path, unexpected: str) -> None:
    """Assert that file does not contain unexpected string."""
    content = file_path.read_text()
    assert (
        unexpected not in content
    ), f"Unexpected '{unexpected}' found in:\n{content}"


def assert_content_equals(file_path: Path, expected: str) -> None:
    """Assert that file content exactly matches expected."""
    content = file_path.read_text()
    assert content == expected, f"Expected:\n{expected}\n\nGot:\n{content}"


def test_replace_asset_staging_prefix(temp_dirs: dict[str, Path]) -> None:
    """Test replacing asset_staging/filename references."""
    create_staged_file(temp_dirs["staging"], "test_image.png")
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "![Image](asset_staging/test_image.png)",
    )

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_contains(md_file, "static/images/posts/test_image.png")
    assert_content_not_contains(md_file, "asset_staging")


def test_replace_standalone_filename(temp_dirs: dict[str, Path]) -> None:
    """Test replacing standalone filename references."""
    create_staged_file(temp_dirs["staging"], "standalone.jpg")
    md_file = create_markdown_file(
        temp_dirs["content"], "test.md", "![Image](standalone.jpg)"
    )

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_equals(
        md_file, "![Image](static/images/posts/standalone.jpg)"
    )


def test_preserve_card_image_urls(temp_dirs: dict[str, Path]) -> None:
    """Test that card_image URLs are NOT corrupted."""
    filename = "b34a33eed86d79c77c6ad3560e8dd7865a109d202e8b9c74.png"
    create_staged_file(temp_dirs["staging"], filename)

    card_url = (
        f"https://assets.turntrout.com/static/images/card_images/{filename}"
    )
    content = f"""---
card_image: {card_url}
---

Some content with asset_staging/{filename}
"""
    md_file = create_markdown_file(temp_dirs["content"], "test.md", content)

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    # Card image URL should be unchanged
    assert_content_contains(md_file, card_url)
    # asset_staging reference should be replaced
    assert_content_contains(md_file, f"static/images/posts/{filename}")
    assert_content_not_contains(md_file, "asset_staging/")


def test_preserve_other_urls(temp_dirs: dict[str, Path]) -> None:
    """Test that other URLs with matching filenames are preserved."""
    create_staged_file(temp_dirs["staging"], "example.png")

    content = """
![Local](asset_staging/example.png)
![CDN](https://assets.turntrout.com/static/images/posts/example.png)
![External](https://example.com/images/example.png)
"""
    md_file = create_markdown_file(temp_dirs["content"], "test.md", content)

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    # asset_staging should be replaced
    assert_content_contains(
        md_file, "![Local](static/images/posts/example.png)"
    )
    # Other URLs should be unchanged
    assert_content_contains(
        md_file, "https://assets.turntrout.com/static/images/posts/example.png"
    )
    assert_content_contains(md_file, "https://example.com/images/example.png")


def test_filename_at_start_of_line(temp_dirs: dict[str, Path]) -> None:
    """Test replacing filename at the start of a line."""
    create_staged_file(temp_dirs["staging"], "start.png")
    md_file = create_markdown_file(
        temp_dirs["content"], "test.md", "start.png is an image"
    )

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_equals(md_file, "static/images/posts/start.png is an image")


def test_special_characters_in_filename(temp_dirs: dict[str, Path]) -> None:
    """Test handling filenames with special regex characters."""
    create_staged_file(temp_dirs["staging"], "test-image_v2.0.png")
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "![Image](asset_staging/test-image_v2.0.png)",
    )

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_contains(md_file, "static/images/posts/test-image_v2.0.png")


def test_multiple_files_in_staging(temp_dirs: dict[str, Path]) -> None:
    """Test replacing references to multiple files."""
    for filename in ["image1.png", "image2.jpg", "image3.svg"]:
        create_staged_file(temp_dirs["staging"], filename)

    content = """
![One](asset_staging/image1.png)
![Two](image2.jpg)
![Three](asset_staging/image3.svg)
"""
    md_file = create_markdown_file(temp_dirs["content"], "test.md", content)

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_contains(md_file, "static/images/posts/image1.png")
    assert_content_contains(md_file, "static/images/posts/image2.jpg")
    assert_content_contains(md_file, "static/images/posts/image3.svg")
    assert_content_not_contains(md_file, "asset_staging")


def test_multiple_markdown_files(temp_dirs: dict[str, Path]) -> None:
    """Test replacing references across multiple markdown files."""
    create_staged_file(temp_dirs["staging"], "shared.png")

    md1 = create_markdown_file(
        temp_dirs["content"], "test1.md", "![Image](asset_staging/shared.png)"
    )
    md2 = create_markdown_file(
        temp_dirs["content"], "test2.md", "![Image](shared.png)"
    )

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_contains(md1, "static/images/posts/shared.png")
    assert_content_contains(md2, "static/images/posts/shared.png")


def test_empty_staging_directory(temp_dirs: dict[str, Path]) -> None:
    """Test handling empty staging directory."""
    original = "Some content"
    md_file = create_markdown_file(temp_dirs["content"], "test.md", original)

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_equals(md_file, original)


def test_no_matching_references(temp_dirs: dict[str, Path]) -> None:
    """Test when there are no references to replace."""
    create_staged_file(temp_dirs["staging"], "unused.png")

    original = "Some content without images"
    md_file = create_markdown_file(temp_dirs["content"], "test.md", original)

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_equals(md_file, original)


def test_preserve_url_with_colon(temp_dirs: dict[str, Path]) -> None:
    """Test that URLs with colons (like https:) are preserved."""
    create_staged_file(temp_dirs["staging"], "test.png")

    content = """
![Local](asset_staging/test.png)
![URL](https://example.com/test.png)
"""
    md_file = create_markdown_file(temp_dirs["content"], "test.md", content)

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    # asset_staging should be replaced
    assert_content_contains(md_file, "![Local](static/images/posts/test.png)")
    # URL should be unchanged
    assert_content_contains(md_file, "https://example.com/test.png")


def test_nested_markdown_files(temp_dirs: dict[str, Path]) -> None:
    """Test replacing references in nested directories."""
    create_staged_file(temp_dirs["staging"], "nested.png")

    nested_dir = temp_dirs["content"] / "subdir"
    nested_dir.mkdir()
    md_file = create_markdown_file(
        nested_dir, "test.md", "![Image](asset_staging/nested.png)"
    )

    run_replacement(temp_dirs["staging"], temp_dirs["content"])

    assert_content_contains(md_file, "static/images/posts/nested.png")
