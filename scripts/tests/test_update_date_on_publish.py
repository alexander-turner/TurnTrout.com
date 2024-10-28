import pytest
import tempfile
from pathlib import Path
from datetime import datetime
import yaml
import subprocess
from unittest.mock import patch

from .. import update_date_on_publish as update_lib


@pytest.fixture
def temp_content_dir(tmp_path):
    """Create a temporary content directory with test files"""
    content_dir = tmp_path / "content"
    content_dir.mkdir()
    return content_dir


@pytest.fixture
def mock_datetime(monkeypatch):
    """Mock datetime to return a fixed date"""
    fixed_date = datetime(2024, 2, 1)

    class MockDateTime:
        @staticmethod
        def now():
            return fixed_date

    monkeypatch.setattr(update_lib, "current_date", fixed_date.strftime("%m/%d/%Y"))
    return fixed_date


@pytest.fixture
def mock_git(temp_content_dir):
    """Create a mock git command that uses temp_content_dir as root.

    By default, returns no modifications. Pass modified_files to simulate changes.
    """

    def _mock_git(modified_files=None):
        def _git_command(*args, **kwargs):
            if "rev-parse" in args[0]:
                return str(temp_content_dir.parent) + "\n"
            if "diff" in args[0]:
                # If specific files are marked as modified, return their paths
                if modified_files and len(args) > 3 and args[3]:
                    file_path = Path(args[3])
                    if file_path.name in modified_files:
                        return f"content/{file_path.name}"
                # If no specific file check but we have modified files, return them all
                elif modified_files:
                    return "\n".join(f"content/{f}" for f in modified_files)
            return ""  # Default: no changes

        return _git_command

    return _mock_git


def create_md_file(directory: Path, filename: str, frontmatter_content: dict) -> Path:
    """Helper to create markdown test files"""
    file_path = directory / filename
    content = "---\n"
    content += yaml.dump(frontmatter_content, sort_keys=False, allow_unicode=True)
    content += "---\n"
    content += "Test content"
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_adds_missing_date(temp_content_dir, mock_datetime, mock_git):
    """Test that date is added when missing"""
    test_file = create_md_file(
        temp_content_dir, "test1.md", {"title": "Test Post", "tags": ["test"]}
    )

    with patch("subprocess.check_output", side_effect=mock_git):
        metadata, content = update_lib.split_yaml(test_file)
        update_lib.update_publish_date(metadata)
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "02/01/2024"
    assert metadata["date_updated"] == "02/01/2024"


def test_preserves_existing_date(temp_content_dir, mock_git):
    """Test that existing dates are not modified"""
    existing_date = "12/25/2023"
    test_file = create_md_file(
        temp_content_dir,
        "test2.md",
        {"title": "Test Post", "date_published": existing_date},
    )

    with patch("subprocess.check_output", side_effect=mock_git):
        metadata, content = update_lib.split_yaml(test_file)
        update_lib.update_publish_date(metadata)
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == existing_date


def test_handles_empty_date(temp_content_dir, mock_datetime, mock_git):
    """Test that empty dates are updated"""
    test_file = create_md_file(
        temp_content_dir, "test3.md", {"title": "Test Post", "date_published": ""}
    )

    with patch("subprocess.check_output", side_effect=mock_git):
        metadata, content = update_lib.split_yaml(test_file)
        update_lib.update_publish_date(metadata)
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "02/01/2024"
    assert metadata["date_updated"] == "02/01/2024"


def test_updates_date_when_modified(temp_content_dir, mock_datetime, mock_git):
    """Test that date_updated is modified when git shows changes"""
    test_file = create_md_file(
        temp_content_dir,
        "test2.md",
        {
            "title": "Test Post",
            "date_published": "01/01/2024",
            "date_updated": "01/01/2024",
        },
    )

    def mock_git_with_changes(*args, **kwargs):
        if "rev-parse" in args[0]:
            return str(temp_content_dir.parent) + "\n"
        if "diff" in args[0]:
            return f"content/{test_file.name}"  # Simulate file as modified
        return ""

    with patch("subprocess.check_output", side_effect=mock_git_with_changes):
        metadata, content = update_lib.split_yaml(test_file)
        if update_lib.is_file_modified(test_file):
            metadata["date_updated"] = "02/01/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "01/01/2024"  # Unchanged
    assert metadata["date_updated"] == "02/01/2024"  # Updated


def test_preserves_dates_when_not_modified(temp_content_dir, mock_git):
    """Test that dates aren't modified when git shows no changes"""
    test_file = create_md_file(
        temp_content_dir,
        "test3.md",
        {
            "title": "Test Post",
            "date_published": "01/01/2023",
            "date_updated": "01/01/2023",
        },
    )

    with patch("subprocess.check_output", side_effect=mock_git()):  # No modified files
        metadata, content = update_lib.split_yaml(test_file)
        if update_lib.is_file_modified(test_file):
            metadata["date_updated"] = "02/01/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "01/01/2023"
    assert metadata["date_updated"] == "01/01/2023"  # Unchanged


def test_split_yaml_invalid_format(temp_content_dir):
    """Test handling of invalid YAML format"""
    file_path = temp_content_dir / "invalid.md"
    file_path.write_text("Invalid content without proper frontmatter", encoding="utf-8")

    metadata, content = update_lib.split_yaml(file_path)
    assert metadata == {}
    assert content == ""


def test_split_yaml_empty_frontmatter(temp_content_dir):
    """Test handling of empty frontmatter"""
    file_path = temp_content_dir / "empty.md"
    file_path.write_text("---\n---\nContent", encoding="utf-8")

    metadata, content = update_lib.split_yaml(file_path)
    assert metadata == {}
    assert content == "\nContent"


def test_split_yaml_malformed_yaml(temp_content_dir):
    """Test handling of malformed YAML"""
    file_path = temp_content_dir / "malformed.md"
    file_path.write_text("---\ntitle: 'Unclosed quote\n---\nContent", encoding="utf-8")

    metadata, content = update_lib.split_yaml(file_path)
    assert metadata == {}
    assert content == ""


def test_write_to_yaml_preserves_order(temp_content_dir):
    """Test that YAML writing preserves field order"""
    original_metadata = {
        "title": "Test Post",
        "date_published": "01/01/2024",
        "tags": ["test"],
        "date_updated": "01/01/2024",
    }

    test_file = create_md_file(temp_content_dir, "order_test.md", original_metadata)
    metadata, content = update_lib.split_yaml(test_file)
    update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        written_content = f.read()

    # Check that fields appear in the same order
    field_positions = {
        field: written_content.index(field) for field in original_metadata.keys()
    }
    assert list(field_positions.keys()) == list(original_metadata.keys())


def test_main_function_integration(temp_content_dir, mock_datetime, mock_git):
    """Test the main function's integration"""
    # Create multiple test files
    files = [
        ("new.md", {"title": "New Post"}),
        ("existing.md", {"title": "Existing Post", "date_published": "01/01/2024"}),
        ("modified.md", {"title": "Modified Post", "date_published": "01/01/2024"}),
    ]

    for filename, metadata in files:
        create_md_file(temp_content_dir, filename, metadata)

    def mock_git_selective(*args, **kwargs):
        if "rev-parse" in args[0]:
            return str(temp_content_dir.parent) + "\n"
        if "diff" in args[0] and "modified.md" in str(args):
            return "content/modified.md"
        return ""

    with patch("subprocess.check_output", side_effect=mock_git_selective):
        update_lib.main(temp_content_dir)

    # Verify results
    for filename, _ in files:
        with (temp_content_dir / filename).open("r", encoding="utf-8") as f:
            metadata = yaml.safe_load(f.read().split("---")[1])
            assert "date_published" in metadata
            if filename == "modified.md":
                assert metadata["date_updated"] == "02/01/2024"


# Test the git check
@pytest.fixture
def mock_git_root():
    return "/path/to/git/root"


@pytest.fixture
def test_file():
    return Path("/path/to/git/root/content/test.md")


@pytest.fixture
def mock_git_commands(mock_git_root):
    """Factory fixture for creating git command mocks with different behaviors"""

    def create_mock(*, has_changes=False, raise_error=False):
        def _mock_git(*args, **kwargs):
            if raise_error:
                raise subprocess.CalledProcessError(1, "git")

            if "rev-parse" in args[0]:
                return f"{mock_git_root}\n"
            if "diff" in args[0]:
                return "content/test.md\n" if has_changes else ""
            return ""

        return _mock_git

    return create_mock


def test_is_file_modified_with_changes(test_file, mock_git_commands):
    """Test when file has unpushed changes"""
    with patch(
        "subprocess.check_output", side_effect=mock_git_commands(has_changes=True)
    ):
        assert update_lib.is_file_modified(test_file) is True


def test_is_file_modified_no_changes(test_file, mock_git_commands):
    """Test when file has no unpushed changes"""
    with patch(
        "subprocess.check_output", side_effect=mock_git_commands(has_changes=False)
    ):
        assert update_lib.is_file_modified(test_file) is False


def test_is_file_modified_git_error(test_file, mock_git_commands):
    """Test handling of git command errors"""
    with patch(
        "subprocess.check_output", side_effect=mock_git_commands(raise_error=True)
    ):
        assert update_lib.is_file_modified(test_file) is False


def test_is_file_modified_invalid_path(mock_git_commands):
    """Test with file outside git root"""
    test_file = Path("/different/path/test.md")
    with patch(
        "subprocess.check_output", side_effect=mock_git_commands(has_changes=False)
    ):
        with pytest.raises(ValueError):
            update_lib.is_file_modified(test_file)


def test_yaml_formatting_preservation():
    """Test that YAML formatting, quotes, and comments are preserved."""
    # Create a test file with specific formatting
    test_content = """---
# Header comment
title: "Quoted Title"
date_published: '05/20/2024'  # Side comment
tags:
  - "tag1"
  - 'tag2'
  - unquoted_tag
nested:
  key1: "value1"  # Another comment
  key2: 'value2'
---
Test content here
"""

    with tempfile.TemporaryDirectory() as tmp_dir:
        test_file = Path(tmp_dir) / "test.md"
        with open(test_file, "w") as f:
            f.write(test_content)

        # Read and write back the file
        metadata, content = update_lib.split_yaml(test_file)
        update_lib.write_to_yaml(test_file, metadata, content)

        # Read the result and verify
        with open(test_file, "r") as f:
            result = f.read()

        assert '"Quoted Title"' in result  # Double quotes preserved
        assert "'05/20/2024'" in result  # Single quotes preserved
        assert "# Header comment" in result
        assert "# Side comment" in result
        assert "unquoted_tag" in result
        assert "  - " in result  # List indentation preserved


def test_date_updates_preserve_formatting():
    """Test that date updates don't affect existing formatting."""
    test_content = """---
date_published: "05/20/2024"  # Original publish date
date_updated: '05/21/2024'    # Last update
title: "Test Post"
---
Content here
"""

    with tempfile.TemporaryDirectory() as tmp_dir:
        test_file = Path(tmp_dir) / "test.md"
        with open(test_file, "w") as f:
            f.write(test_content)

        # Read, modify a date, and write back
        metadata, content = update_lib.split_yaml(test_file)
        metadata["date_updated"] = "05/22/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

        # Read the result and verify
        with open(test_file, "r") as f:
            result = f.read()

        # Check that quotes and comments are preserved
        assert 'date_published: "05/20/2024"' in result
        assert "# Original publish date" in result
        assert "# Last update" in result
        assert 'title: "Test Post"' in result


@pytest.mark.parametrize(
    "test_case",
    [
        pytest.param(
            """---
---
Content
""",
            id="empty-frontmatter",
        ),
        pytest.param(
            """---
title: "Test Post"
---
Content
""",
            id="missing-dates",
        ),
    ],
)
def test_initialize_missing_dates(temp_content_dir, test_case):
    """Test that both dates are set when missing."""
    test_file = create_md_file(temp_content_dir, "test.md", {})
    with open(test_file, "w") as f:
        f.write(test_case)

    current_date = datetime.now().strftime("%m/%d/%Y")
    metadata, content = update_lib.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_published"] == current_date
    assert metadata["date_updated"] == current_date


def test_preserve_existing_publish_date(temp_content_dir):
    """Test that existing publish date is preserved but updated date is set."""
    test_file = create_md_file(temp_content_dir, "test.md", {})  # Using existing helper
    content = """---
title: "Test Post"
date_published: "01/01/2023"
---
Content
"""
    with open(test_file, "w") as f:
        f.write(content)

    metadata, content = update_lib.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_published"] == "01/01/2023"
    assert "date_updated" in metadata


def test_preserve_both_dates(temp_content_dir):
    """Test that both dates are preserved when they exist."""
    test_file = create_md_file(temp_content_dir, "test.md", {})
    content = """---
title: "Test Post"
date_published: "01/01/2023"
date_updated: "01/02/2023"
---
Content
"""
    with open(test_file, "w") as f:
        f.write(content)

    metadata, content = update_lib.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_published"] == "01/01/2023"
    assert metadata["date_updated"] == "01/02/2023"


@pytest.mark.parametrize(
    "legacy_field,legacy_date",
    [
        ("lw-last-modification", "01/02/2023"),
        ("lw-latest-edit", "01/02/2023"),
    ],
)
def test_legacy_date_migration(temp_content_dir, legacy_field, legacy_date):
    """Test migration of each legacy date field."""
    test_file = create_md_file(temp_content_dir, "test.md", {})
    content = f"""---
title: "Test Post"
date_published: "01/01/2023"
{legacy_field}: "{legacy_date}"
---
Content
"""
    with open(test_file, "w") as f:
        f.write(content)

    metadata, content = update_lib.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_updated"] == legacy_date


def test_formatting_preservation(temp_content_dir):
    """Test that YAML formatting is preserved during updates."""
    test_file = create_md_file(temp_content_dir, "test.md", {})
    content = """---
# Header comment
title: "Test Post"  # Title comment
date_published: "01/01/2023"  # Original date
tags:  # Tag list
  - "tag1"
  - 'tag2'  # Mixed quotes
---
Content
"""
    with open(test_file, "w") as f:
        f.write(content)

    metadata, content = update_lib.split_yaml(test_file)
    update_lib.update_publish_date(metadata)
    update_lib.write_to_yaml(test_file, metadata, content)

    with open(test_file, "r") as f:
        result = f.read()

    assert "# Header comment" in result
    assert "# Title comment" in result
    assert '"Test Post"' in result
    assert "# Original date" in result
    assert "# Tag list" in result
    assert '"tag1"' in result
    assert "'tag2'" in result
    assert "# Mixed quotes" in result


def test_git_modified_date_update(temp_content_dir, mock_git):
    """Test that date_updated is set when file is modified in git."""
    test_file = create_md_file(
        temp_content_dir,
        "test2.md",
        {
            "title": "Test Post",
            "date_published": "01/01/2023",
            "date_updated": "01/02/2023",
        },
    )

    with patch("subprocess.check_output", side_effect=mock_git([test_file.name])):
        metadata, content = update_lib.split_yaml(test_file)
        if update_lib.is_file_modified(test_file):
            metadata["date_updated"] = "02/01/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "01/01/2023"  # Unchanged
    assert metadata["date_updated"] == "02/01/2024"  # Updated
