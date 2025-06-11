import io
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml
from ruamel.yaml.timestamp import TimeStamp

import scripts.utils as script_utils

from .. import update_date_on_publish as update_lib


@pytest.fixture
def temp_content_dir(tmp_path):
    """
    Create a temporary content directory with test files.
    """
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()
    return content_dir


def create_timestamp(dt: datetime) -> TimeStamp:
    """
    Helper function to create TimeStamp objects from datetime.
    """
    return TimeStamp(
        dt.year,
        dt.month,
        dt.day,
        dt.hour,
        dt.minute,
        dt.second,
        dt.microsecond,
    )


@pytest.fixture
def mock_datetime(monkeypatch):
    """
    Mock datetime to return a fixed date.
    """
    fixed_date = datetime(2024, 2, 1)
    fixed_timestamp = create_timestamp(fixed_date)
    monkeypatch.setattr(update_lib, "current_date", fixed_timestamp)
    return fixed_date


@pytest.fixture
def mock_git(temp_content_dir):
    """
    Create a mock git command that uses temp_content_dir as root.

    By default, returns no modifications. Pass modified_files to simulate
    changes.
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
                        return f"website_content/{file_path.name}"
                # If no specific file check but we have modified files, return them all
                elif modified_files:
                    return "\n".join(
                        f"website_content/{f}" for f in modified_files
                    )
            return ""  # Default: no changes

        return _git_command

    return _mock_git


def create_md_file(
    directory: Path, filename: str, frontmatter_content: dict
) -> Path:
    """
    Helper to create markdown test files.
    """
    file_path = directory / filename

    # Use ruamel.yaml for consistent dumping with the main script
    stream = io.StringIO()
    update_lib.yaml_parser.dump(frontmatter_content, stream)
    yaml_content = stream.getvalue()

    content = "---\n"
    content += yaml_content
    content += "---\n"
    content += "Test content"
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_adds_missing_date(temp_content_dir, mock_datetime, mock_git):
    """
    Test that date is added when missing.
    """
    test_file = create_md_file(
        temp_content_dir, "test1.md", {"title": "Test Post", "tags": ["test"]}
    )

    with patch("subprocess.check_output", side_effect=mock_git):
        metadata, content = script_utils.split_yaml(test_file)
        update_lib.update_publish_date(metadata)
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    expected_date = create_timestamp(datetime(2024, 2, 1))
    assert metadata["date_published"] == expected_date
    assert metadata["date_updated"] == expected_date


def test_preserves_existing_date(temp_content_dir, mock_git):
    """
    Test that existing dates are not modified.
    """
    existing_date = "12/25/2023"
    test_file = create_md_file(
        temp_content_dir,
        "test2.md",
        {"title": "Test Post", "date_published": existing_date},
    )

    with patch("subprocess.check_output", side_effect=mock_git):
        metadata, content = script_utils.split_yaml(test_file)
        update_lib.update_publish_date(metadata)
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == existing_date


def test_handles_empty_date(temp_content_dir, mock_datetime, mock_git):
    """
    Test that empty dates are updated.
    """
    test_file = create_md_file(
        temp_content_dir,
        "test3.md",
        {"title": "Test Post", "date_published": ""},
    )

    with patch("subprocess.check_output", side_effect=mock_git):
        metadata, content = script_utils.split_yaml(test_file)
        update_lib.update_publish_date(metadata)
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])

    expected_date = create_timestamp(mock_datetime)
    assert metadata["date_published"] == expected_date
    assert metadata["date_updated"] == expected_date


def test_updates_date_when_modified(temp_content_dir, mock_datetime, mock_git):
    """
    Test that date_updated is modified when git shows changes.
    """
    # Create initial dates as strings instead of TimeStamp objects
    test_file = create_md_file(
        temp_content_dir,
        "test2.md",
        {
            "title": "Test Post",
            "date_published": "2024-01-01",
            "date_updated": "2024-01-01",
        },
    )

    # Fix: Use the mock_git fixture with modified files
    with patch(
        "subprocess.check_output", side_effect=mock_git([test_file.name])
    ):
        metadata, content = script_utils.split_yaml(test_file)
        if update_lib.is_file_modified(test_file):
            metadata["date_updated"] = (
                "2024-02-01"  # Use string format instead of TimeStamp
            )
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "2024-01-01"
    assert metadata["date_updated"] == "2024-02-01"


def test_preserves_dates_when_not_modified(temp_content_dir, mock_git):
    """
    Test that dates aren't modified when git shows no changes.
    """
    test_file = create_md_file(
        temp_content_dir,
        "test3.md",
        {
            "title": "Test Post",
            "date_published": "01/01/2023",
            "date_updated": "01/01/2023",
        },
    )

    with patch(
        "subprocess.check_output", side_effect=mock_git()
    ):  # No modified files
        metadata, content = script_utils.split_yaml(test_file)
        if update_lib.is_file_modified(test_file):
            metadata["date_updated"] = "02/01/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "01/01/2023"
    assert metadata["date_updated"] == "01/01/2023"


def test_split_yaml_invalid_format(temp_content_dir):
    """
    Test handling of invalid YAML format.
    """
    file_path = temp_content_dir / "invalid.md"
    file_path.write_text(
        "Invalid content without proper frontmatter", encoding="utf-8"
    )

    metadata, content = script_utils.split_yaml(file_path)
    assert metadata == {}
    assert content == ""


def test_split_yaml_empty_frontmatter(temp_content_dir):
    """
    Test handling of empty frontmatter.
    """
    file_path = temp_content_dir / "empty.md"
    file_path.write_text("---\n---\nContent", encoding="utf-8")

    metadata, content = script_utils.split_yaml(file_path)
    assert metadata == {}
    assert content == "\nContent"


def test_split_yaml_malformed_yaml(temp_content_dir):
    """
    Test handling of malformed YAML.
    """
    file_path = temp_content_dir / "malformed.md"
    file_path.write_text(
        '---\ntitle: "Unclosed quote\n---\nContent', encoding="utf-8"
    )

    # Expect split_yaml to return empty metadata and content for malformed files
    metadata, content = script_utils.split_yaml(file_path, verbose=True)
    assert metadata == {}
    assert content == ""


def test_write_to_yaml_preserves_order(temp_content_dir):
    """
    Test that YAML writing preserves field order.
    """
    original_metadata = {
        "title": "Test Post",
        "date_published": "01/01/2024",
        "tags": ["test"],
        "date_updated": "01/01/2024",
    }

    test_file = create_md_file(
        temp_content_dir, "order_test.md", original_metadata
    )
    metadata, content = script_utils.split_yaml(test_file)
    update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        written_content = f.read()

    # Check that fields appear in the same order
    field_positions = {
        field: written_content.index(field) for field in original_metadata
    }
    assert list(field_positions.keys()) == list(original_metadata.keys())


def test_main_function_integration(temp_content_dir, mock_datetime, mock_git):
    """
    Test the main function's integration.
    """
    initial_date = create_timestamp(datetime(2024, 1, 1))
    files = [
        ("new.md", {"title": "New Post"}),
        (
            "existing.md",
            {"title": "Existing Post", "date_published": initial_date},
        ),
        (
            "modified.md",
            {"title": "Modified Post", "date_published": initial_date},
        ),
    ]

    for filename, metadata in files:
        create_md_file(temp_content_dir, filename, metadata)

    with (
        patch(
            "subprocess.check_output", side_effect=mock_git(["modified.md"])
        ),
        patch("scripts.update_date_on_publish.commit_changes") as mock_commit,
    ):
        update_lib.main(temp_content_dir)
        mock_commit.assert_called_once()

    expected_new_date = create_timestamp(datetime(2024, 2, 1))
    for filename, _ in files:
        with (temp_content_dir / filename).open("r", encoding="utf-8") as f:
            metadata = yaml.safe_load(f.read().split("---")[1])
            assert "date_published" in metadata
            if filename == "modified.md":
                assert metadata["date_updated"] == expected_new_date


# Test the git check
@pytest.fixture
def mock_git_root():
    return "/path/to/git/root"


@pytest.fixture
def test_file():
    return Path("/path/to/git/root/website_content/test.md")


@pytest.fixture
def mock_git_commands(mock_git_root):
    """
    Factory fixture for creating git command mocks with different behaviors.
    """

    def create_mock(*, has_changes=False, raise_error=False):
        def _mock_git(*args, **kwargs):
            if raise_error:
                raise subprocess.CalledProcessError(1, "git")

            if "rev-parse" in args[0]:
                return f"{mock_git_root}\n"
            if "diff" in args[0]:
                return "website_content/test.md\n" if has_changes else ""
            return ""

        return _mock_git

    return create_mock


def test_is_file_modified_with_changes(test_file, mock_git_commands):
    """
    Test when file has unpushed changes.
    """
    with patch(
        "subprocess.check_output",
        side_effect=mock_git_commands(has_changes=True),
    ):
        assert update_lib.is_file_modified(test_file) is True


def test_is_file_modified_no_changes(test_file, mock_git_commands):
    """
    Test when file has no unpushed changes.
    """
    with patch(
        "subprocess.check_output",
        side_effect=mock_git_commands(has_changes=False),
    ):
        assert update_lib.is_file_modified(test_file) is False


def test_is_file_modified_git_error(test_file, mock_git_commands):
    """
    Test handling of git command errors.
    """
    with patch(
        "subprocess.check_output",
        side_effect=mock_git_commands(raise_error=True),
    ):
        assert update_lib.is_file_modified(test_file) is False


def test_is_file_modified_invalid_path(mock_git_commands):
    """
    Test with file outside git root.
    """
    test_file = Path("/different/path/test.md")
    with patch(
        "subprocess.check_output",
        side_effect=mock_git_commands(has_changes=False),
    ):
        with pytest.raises(ValueError):
            update_lib.is_file_modified(test_file)


def test_yaml_formatting_preservation():
    """
    Test that YAML formatting, quotes, and comments are preserved.
    """
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
        metadata, content = script_utils.split_yaml(test_file)
        update_lib.write_to_yaml(test_file, metadata, content)

        # Read the result and verify
        with open(test_file) as f:
            result = f.read()

        assert '"Quoted Title"' in result  # Double quotes preserved
        assert "'05/20/2024'" in result  # Single quotes preserved
        assert "# Header comment" in result
        assert "# Side comment" in result
        assert "unquoted_tag" in result
        assert "  - " in result  # List indentation preserved


def test_date_updates_preserve_formatting():
    """
    Test that date updates don't affect existing formatting.
    """
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
        metadata, content = script_utils.split_yaml(test_file)
        metadata["date_updated"] = "05/22/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

        # Read the result and verify
        with open(test_file) as f:
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
def test_initialize_missing_dates(temp_content_dir, mock_datetime, test_case):
    """
    Test that both dates are set when missing.
    """
    test_file = create_md_file(temp_content_dir, "test.md", {})
    with open(test_file, "w") as f:
        f.write(test_case)

    expected_date = create_timestamp(mock_datetime)
    metadata, content = script_utils.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_published"] == expected_date
    assert metadata["date_updated"] == expected_date


def test_preserve_existing_publish_date(temp_content_dir):
    """
    Test that existing publish date is preserved but updated date is set.
    """
    test_file = create_md_file(
        temp_content_dir, "test.md", {}
    )  # Using existing helper
    content = """---
title: "Test Post"
date_published: "01/01/2023"
---
Content
"""
    with open(test_file, "w") as f:
        f.write(content)

    metadata, content = script_utils.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_published"] == "01/01/2023"
    assert "date_updated" in metadata


def test_preserve_both_dates(temp_content_dir):
    """
    Test that both dates are preserved when they exist.
    """
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

    metadata, content = script_utils.split_yaml(test_file)
    update_lib.update_publish_date(metadata)

    assert metadata["date_published"] == "01/01/2023"
    assert metadata["date_updated"] == "01/02/2023"


def test_formatting_preservation(temp_content_dir):
    """
    Test that YAML formatting is preserved during updates.
    """
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

    metadata, content = script_utils.split_yaml(test_file)
    update_lib.update_publish_date(metadata)
    update_lib.write_to_yaml(test_file, metadata, content)

    with open(test_file) as f:
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
    """
    Test that date_updated is set when file is modified in git.
    """
    test_file = create_md_file(
        temp_content_dir,
        "test2.md",
        {
            "title": "Test Post",
            "date_published": "01/01/2023",
            "date_updated": "01/02/2023",
        },
    )

    with patch(
        "subprocess.check_output", side_effect=mock_git([test_file.name])
    ):
        metadata, content = script_utils.split_yaml(test_file)
        if update_lib.is_file_modified(test_file):
            metadata["date_updated"] = "02/01/2024"
        update_lib.write_to_yaml(test_file, metadata, content)

    with test_file.open("r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f.read().split("---")[1])
    assert metadata["date_published"] == "01/01/2023"
    assert metadata["date_updated"] == "02/01/2024"


def test_maybe_convert_to_timestamp_datetime_input():
    """
    Test maybe_convert_to_timestamp with a datetime object input.
    """
    input_dt = datetime(2023, 10, 26, 12, 30, 0)
    expected_ts = TimeStamp(2023, 10, 26, 12, 30, 0)
    result_ts = update_lib.maybe_convert_to_timestamp(input_dt)
    assert result_ts == expected_ts
    assert isinstance(result_ts, TimeStamp)


def test_maybe_convert_to_timestamp_iso_string_input():
    """
    Test maybe_convert_to_timestamp with an ISO format string input.
    """
    input_iso_str = "2023-10-26T12:30:00"
    expected_ts = TimeStamp(2023, 10, 26, 12, 30, 0)
    result_ts = update_lib.maybe_convert_to_timestamp(input_iso_str)
    assert result_ts == expected_ts
    assert isinstance(result_ts, TimeStamp)


def test_maybe_convert_to_timestamp_invalid_type():
    """
    Test maybe_convert_to_timestamp with an unsupported input type.
    """
    with pytest.raises(ValueError, match="Unknown date type <class 'int'>"):
        update_lib.maybe_convert_to_timestamp(12345)


def test_main_default_content_dir(mock_datetime, mock_git):
    """
    Test that main uses 'website_content' dir by default.
    """
    glob_calls = []

    def mock_glob(self, pattern):
        glob_calls.append((self, pattern))
        return []  # Return empty list to avoid processing files

    # Use patch.object to only mock the glob method
    with (
        patch.object(Path, "glob", mock_glob),
        patch("subprocess.check_output", side_effect=mock_git()),
        patch("scripts.update_date_on_publish.commit_changes"),
    ):
        update_lib.main()

    # Check that glob was called with the right path and pattern
    assert len(glob_calls) > 0, "Path.glob was not called"
    called_path, pattern = glob_calls[0]
    assert (
        str(called_path) == "website_content"
    ), f"Expected path 'website_content', got '{called_path}'"
    assert pattern == "*.md", f"Expected pattern '*.md', got '{pattern}'"


def test_main_skips_invalid_file(temp_content_dir, mock_datetime, mock_git):
    """
    Test that main skips files with invalid/empty frontmatter.
    """
    create_md_file(temp_content_dir, "valid.md", {"title": "Valid"})
    invalid_file = temp_content_dir / "invalid.md"
    invalid_file.write_text("Not a valid markdown file with frontmatter")

    # Mock split_yaml to return empty for the invalid file
    original_split = script_utils.split_yaml

    def mock_split_yaml(file_path):
        if file_path.name == "invalid.md":
            return ({}, "")
        return original_split(file_path)

    with (
        patch("scripts.utils.split_yaml", side_effect=mock_split_yaml),
        patch("subprocess.check_output", side_effect=mock_git()),
        patch.object(update_lib, "write_to_yaml") as mock_write,
        patch("scripts.update_date_on_publish.commit_changes"),
    ):
        update_lib.main(temp_content_dir)
        # Assert write was called once (for the valid file), not twice
        mock_write.assert_called_once()
        assert mock_write.call_args[0][0].name == "valid.md"


# --- Tests for update_readme_copyright_year --- #


@pytest.fixture
def mock_readme_path(tmp_path, monkeypatch):
    """
    Fixture to mock the _README_PATH constant to point to a temporary file.
    """
    readme_file = tmp_path / "README.md"
    monkeypatch.setattr(update_lib, "_README_PATH", readme_file)
    return readme_file


@pytest.mark.parametrize(
    ("initial_content", "current_year", "expected_content"),
    [
        (
            "Some text\nturntrout.com © 2023-2024 by Alexander Turner is licensed under CC BY-SA 4.0.\nMore text",
            2025,
            "Some text\nturntrout.com © 2023-2025 by Alexander Turner is licensed under CC BY-SA 4.0.\nMore text",
        ),
        (
            "Another line\nturntrout.com ©   2022–2023 by Alexander Turner is licensed under CC BY-SA 4.0.",
            2024,
            "Another line\nturntrout.com © 2022-2024 by Alexander Turner is licensed under CC BY-SA 4.0.",
        ),
        (  # Only updates the end year
            "1500-4400 line\nturntrout.com © 2022–2023 by Alexander Turner is licensed under CC BY-SA 4.0.",
            2024,
            "1500-4400 line\nturntrout.com © 2022-2024 by Alexander Turner is licensed under CC BY-SA 4.0.",
        ),
    ],
)
def test_update_readme_copyright_year_updates_needed(
    mock_readme_path,
    initial_content,
    current_year,
    expected_content,
):
    """
    Test updating the copyright year when it's outdated.
    """
    mock_readme_path.write_text(initial_content, encoding="utf-8")
    mock_current_datetime = datetime(
        current_year, 1, 1
    )  # Month/day don't matter

    update_lib.update_readme_copyright_year(mock_current_datetime)

    final_content = mock_readme_path.read_text(encoding="utf-8")
    assert final_content == expected_content


@pytest.mark.parametrize(
    ("initial_content", "current_year"),
    [
        (
            "Some text\nturntrout.com © 2023-2024 by Alexander Turner is licensed under CC BY-SA 4.0.\nMore text",
            2024,
        ),
        (
            "Another line\nturntrout.com © 2022–2023 by Alexander Turner is licensed under CC BY-SA 4.0.",
            2023,
        ),
    ],
)
def test_update_readme_copyright_year_no_update_needed(
    mock_readme_path, initial_content, current_year
):
    """
    Test that the file is not modified when the copyright year is current.
    """
    mock_readme_path.write_text(initial_content, encoding="utf-8")
    mock_current_datetime = datetime(current_year, 5, 15)

    update_lib.update_readme_copyright_year(mock_current_datetime)

    final_content = mock_readme_path.read_text(encoding="utf-8")
    assert final_content == initial_content  # Content should be unchanged


def test_update_readme_copyright_year_readme_not_found(tmp_path, monkeypatch):
    """
    Test FileNotFoundError when README.md does not exist.
    """
    non_existent_path = tmp_path / "non_existent_README.md"
    monkeypatch.setattr(update_lib, "_README_PATH", non_existent_path)
    mock_current_datetime = datetime(2024, 1, 1)

    with pytest.raises(FileNotFoundError, match="README.md not found"):
        update_lib.update_readme_copyright_year(mock_current_datetime)


def test_update_readme_copyright_year_pattern_not_found(mock_readme_path):
    """
    Test ValueError when the copyright pattern is not found in README.md.
    """
    invalid_content = "This file does not contain the expected copyright line."
    mock_readme_path.write_text(invalid_content, encoding="utf-8")
    mock_current_datetime = datetime(2024, 1, 1)

    with pytest.raises(ValueError, match="Could not find copyright line"):
        update_lib.update_readme_copyright_year(mock_current_datetime)
