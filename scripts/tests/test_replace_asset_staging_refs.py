"""Tests for replace_asset_staging_refs.py."""

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
    (staging_dir / filename).write_text("dummy")
    return staging_dir / filename


def create_markdown_file(
    content_dir: Path, filename: str, content: str
) -> Path:
    """Create a markdown file with given content."""
    (content_dir / filename).write_text(content)
    return content_dir / filename


def test_replace_asset_staging_prefix(temp_dirs: dict[str, Path]) -> None:
    """Test replacing asset_staging/filename references."""
    create_staged_file(temp_dirs["staging"], "test_image.png")
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "![Image](asset_staging/test_image.png)",
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    content = md_file.read_text()
    assert "static/images/posts/test_image.png" in content
    assert "asset_staging" not in content


def test_replace_standalone_filename(temp_dirs: dict[str, Path]) -> None:
    """Test replacing standalone filename references."""
    create_staged_file(temp_dirs["staging"], "standalone.jpg")
    md_file = create_markdown_file(
        temp_dirs["content"], "test.md", "![Image](standalone.jpg)"
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert md_file.read_text() == "![Image](static/images/posts/standalone.jpg)"


def test_preserve_card_image_urls(temp_dirs: dict[str, Path]) -> None:
    """Test that card_image URLs are NOT corrupted."""
    filename = "b34a33eed86d79c77c6ad3560e8dd7865a109d202e8b9c74.png"
    create_staged_file(temp_dirs["staging"], filename)

    card_url = (
        f"https://assets.turntrout.com/static/images/card_images/{filename}"
    )
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        f"---\ncard_image: {card_url}\n---\n\nSome content with asset_staging/{filename}\n",
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    content = md_file.read_text()
    assert card_url in content  # Card image URL unchanged
    # asset_staging replaced
    assert f"static/images/posts/{filename}" in content
    assert "asset_staging/" not in content


def test_preserve_other_urls(temp_dirs: dict[str, Path]) -> None:
    """Test that other URLs with matching filenames are preserved."""
    create_staged_file(temp_dirs["staging"], "example.png")
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "\n![Local](asset_staging/example.png)\n"
        "![CDN](https://assets.turntrout.com/static/images/posts/example.png)\n"
        "![External](https://example.com/images/example.png)\n",
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    content = md_file.read_text()
    assert "![Local](static/images/posts/example.png)" in content
    assert (
        "https://assets.turntrout.com/static/images/posts/example.png"
        in content
    )
    assert "https://example.com/images/example.png" in content


def test_filename_at_start_of_line(temp_dirs: dict[str, Path]) -> None:
    """Test replacing filename at the start of a line."""
    create_staged_file(temp_dirs["staging"], "start.png")
    md_file = create_markdown_file(
        temp_dirs["content"], "test.md", "start.png is an image"
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert md_file.read_text() == "static/images/posts/start.png is an image"


def test_special_characters_in_filename(temp_dirs: dict[str, Path]) -> None:
    """Test handling filenames with special regex characters."""
    create_staged_file(temp_dirs["staging"], "test-image_v2.0.png")
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "![Image](asset_staging/test-image_v2.0.png)",
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert "static/images/posts/test-image_v2.0.png" in md_file.read_text()


def test_multiple_files_in_staging(temp_dirs: dict[str, Path]) -> None:
    """Test replacing references to multiple files."""
    for filename in ["image1.png", "image2.jpg", "image3.svg"]:
        create_staged_file(temp_dirs["staging"], filename)

    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "\n![One](asset_staging/image1.png)\n![Two](image2.jpg)\n"
        "![Three](asset_staging/image3.svg)\n",
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    content = md_file.read_text()
    assert "static/images/posts/image1.png" in content
    assert "static/images/posts/image2.jpg" in content
    assert "static/images/posts/image3.svg" in content
    assert "asset_staging" not in content


def test_multiple_markdown_files(temp_dirs: dict[str, Path]) -> None:
    """Test replacing references across multiple markdown files."""
    create_staged_file(temp_dirs["staging"], "shared.png")
    md1 = create_markdown_file(
        temp_dirs["content"], "test1.md", "![Image](asset_staging/shared.png)"
    )
    md2 = create_markdown_file(
        temp_dirs["content"], "test2.md", "![Image](shared.png)"
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert "static/images/posts/shared.png" in md1.read_text()
    assert "static/images/posts/shared.png" in md2.read_text()


def test_empty_staging_directory(temp_dirs: dict[str, Path]) -> None:
    """Test handling empty staging directory."""
    md_file = create_markdown_file(
        temp_dirs["content"], "test.md", "Some content"
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert md_file.read_text() == "Some content"


def test_no_matching_references(temp_dirs: dict[str, Path]) -> None:
    """Test when there are no references to replace."""
    create_staged_file(temp_dirs["staging"], "unused.png")
    md_file = create_markdown_file(
        temp_dirs["content"], "test.md", "Some content without images"
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert md_file.read_text() == "Some content without images"


def test_preserve_url_with_colon(temp_dirs: dict[str, Path]) -> None:
    """Test that URLs with colons (like https:) are preserved."""
    create_staged_file(temp_dirs["staging"], "test.png")
    md_file = create_markdown_file(
        temp_dirs["content"],
        "test.md",
        "\n![Local](asset_staging/test.png)\n![URL](https://example.com/test.png)\n",
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    content = md_file.read_text()
    assert "![Local](static/images/posts/test.png)" in content
    assert "https://example.com/test.png" in content


def test_nested_markdown_files(temp_dirs: dict[str, Path]) -> None:
    """Test replacing references in nested directories."""
    create_staged_file(temp_dirs["staging"], "nested.png")
    nested_dir = temp_dirs["content"] / "subdir"
    nested_dir.mkdir()
    md_file = create_markdown_file(
        nested_dir, "test.md", "![Image](asset_staging/nested.png)"
    )
    replace_asset_staging_refs(temp_dirs["staging"], temp_dirs["content"])

    assert "static/images/posts/nested.png" in md_file.read_text()


def test_no_markdown_files(temp_dirs: dict[str, Path], capsys) -> None:
    """Test handling when no markdown files exist."""
    create_staged_file(temp_dirs["staging"], "test.png")
    empty_dir = temp_dirs["content"] / "empty"
    empty_dir.mkdir()

    replace_asset_staging_refs(temp_dirs["staging"], empty_dir)

    assert "No markdown files found." in capsys.readouterr().out


def test_main_function_missing_staging_dir(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    """Test main() function when asset_staging directory doesn't exist."""
    from scripts import replace_asset_staging_refs

    # Mock get_git_root to return our temp directory
    monkeypatch.setattr(
        "scripts.replace_asset_staging_refs.script_utils.get_git_root",
        lambda: tmp_path,
    )

    # Run main() - should exit with code 1
    with pytest.raises(SystemExit) as exc_info:
        replace_asset_staging_refs.main()

    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "Asset staging directory not found" in captured.out


def test_main_function_success(tmp_path: Path, monkeypatch, capsys) -> None:
    """Test main() function with valid directories."""
    from scripts import replace_asset_staging_refs

    # Create the expected directory structure
    website_content = tmp_path / "website_content"
    website_content.mkdir()

    staging_dir = website_content / "asset_staging"
    staging_dir.mkdir()

    # Create a test file and markdown
    test_file = staging_dir / "test.png"
    test_file.write_text("dummy")

    md_file = website_content / "test.md"
    md_file.write_text("![Image](asset_staging/test.png)")

    # Mock get_git_root to return our temp directory
    monkeypatch.setattr(
        "scripts.replace_asset_staging_refs.script_utils.get_git_root",
        lambda: tmp_path,
    )

    # Run main()
    replace_asset_staging_refs.main()

    # Verify the replacement happened
    content = md_file.read_text()
    assert "static/images/posts/test.png" in content
    assert "asset_staging" not in content

    captured = capsys.readouterr()
    assert "Processing: test.png" in captured.out
