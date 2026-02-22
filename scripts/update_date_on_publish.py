"""Update the publish and update dates in markdown files."""

import io
import re  # Import the re module
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.timestamp import TimeStamp

# Ensure the parent directory is in the sys path so we can import utils
sys.path.append(str(Path(__file__).parent.parent))
# pylint: disable=wrong-import-position
import scripts.utils as script_utils

yaml_parser = YAML(typ="rt")  # Use Round-Trip to preserve formatting
yaml_parser.preserve_quotes = True  # Preserve existing quotes
yaml_parser.indent(mapping=2, sequence=2, offset=2)
yaml_parser.width = 4096  # Prevent line wrapping for long URLs

now = datetime.now()
current_date = TimeStamp(
    now.year,
    now.month,
    now.day,
    now.hour,
    now.minute,
    now.second,
    now.microsecond,
)


def _determine_commit_range(commit_range: str | None) -> str:
    """
    Determine the git commit range to check for file modifications.

    Args:
        commit_range (str | None): Git commit range from CI (e.g., "abc123..def456").
            If None, checks for unpushed changes against origin/main.

    Returns:
        str: The commit range to check
    """
    # Local environment: check for unpushed changes
    if not commit_range:
        return "origin/main..HEAD"

    # CI environment: extract before and after commits
    if ".." not in commit_range:
        return commit_range

    before_commit, after_commit = commit_range.split("..", 1)

    # Handle edge case: initial push has before=0000000000000000000000000000000000000000
    if before_commit.strip("0"):
        # Normal case: compare the range
        return commit_range

    # First push: check the after commit only
    return f"{after_commit}^..{after_commit}"


def is_file_modified(file_path: Path, commit_range: str | None = None) -> bool:
    """
    Check if file was modified in the relevant commit range.

    Args:
        file_path (Path): Path to the file to check
        commit_range (str | None): Git commit range to check (e.g., "abc123..def456").
            If None, checks for unpushed changes against origin/main.

    Returns:
        bool: True if file was modified, False otherwise
    """
    try:
        # Get the relative path from git root
        git_executable = script_utils.find_executable("git")
        git_root = subprocess.check_output(
            [git_executable, "rev-parse", "--show-toplevel"], text=True
        ).strip()
        rel_path = file_path.resolve().relative_to(Path(git_root))

        # Determine commit range to check
        range_to_check = _determine_commit_range(commit_range)

        # Check if file changed in the range
        result = subprocess.check_output(
            [
                git_executable,
                "diff",
                "--name-only",
                range_to_check,
                str(rel_path),
            ],
            text=True,
        ).strip()

        return bool(result)
    except subprocess.CalledProcessError:
        print(f"Warning: Could not check git status for {file_path}")
        return False


def maybe_convert_to_timestamp(
    raw_timestamp_info: str | datetime | TimeStamp,
) -> TimeStamp:
    """Convert various date formats to TimeStamp."""
    if isinstance(raw_timestamp_info, TimeStamp):
        return raw_timestamp_info

    if isinstance(raw_timestamp_info, str):
        # Non-ISO is ambiguous; do not catch errors for that
        dt = datetime.fromisoformat(raw_timestamp_info)
    elif isinstance(raw_timestamp_info, datetime):
        dt = raw_timestamp_info
    else:
        raise ValueError(f"Unknown date type {type(raw_timestamp_info)}")

    return TimeStamp(
        dt.year,
        dt.month,
        dt.day,
        dt.hour,
        dt.minute,
        dt.second,
        dt.microsecond,
    )


def maybe_update_publish_date(yaml_metadata: dict) -> None:
    """Update publish and update dates in a markdown file's frontmatter."""
    # If date_published doesn't exist or is empty/None, create it
    if not yaml_metadata.get("date_published"):
        yaml_metadata["date_published"] = current_date
        yaml_metadata["date_updated"] = current_date
        return

    if "date_updated" not in yaml_metadata:
        yaml_metadata["date_updated"] = yaml_metadata["date_published"]


def write_to_yaml(file_path: Path, metadata: dict, content: str) -> None:
    """Write updated metadata to a markdown file."""
    # Use StringIO to capture the YAML dump with preserved formatting
    stream = io.StringIO()
    yaml_parser.dump(metadata, stream)
    updated_yaml = stream.getvalue()

    # Write back to file if changes were made
    with file_path.open("w", encoding="utf-8") as f:
        f.write("---\n")
        f.write(updated_yaml)
        f.write("---\n")
        f.write(content)


_README_PATH = Path("README.md")
COPYRIGHT_PATTERN = re.compile(
    r"© +(?P<start_year>\d{4})[-–](?P<end_year>\d{4})"
)


def update_readme_copyright_year(current_datetime: datetime) -> bool:
    """
    Update the copyright year in README.md if necessary.

    Returns:
        bool: True if README was modified, False otherwise
    """
    if not _README_PATH.exists():
        raise FileNotFoundError(f"README.md not found at {_README_PATH}")

    readme_content: str = _README_PATH.read_text(encoding="utf-8")

    current_year = str(current_datetime.year)

    match = COPYRIGHT_PATTERN.search(readme_content)
    if not match:
        raise ValueError("Could not find copyright line in README.md")

    readme_end_year = match.group("end_year")
    if readme_end_year == current_year:
        return False

    print(
        f"Updating copyright year in {_README_PATH} "
        f"from {readme_end_year} to {current_year}"
    )
    readme_start_year = match.group("start_year")
    new_readme_content = COPYRIGHT_PATTERN.sub(
        rf"© {readme_start_year}-{current_year}", readme_content
    )
    _README_PATH.write_text(new_readme_content, encoding="utf-8")
    return True


# pylint: disable=missing-function-docstring
def commit_changes(message: str) -> None:
    git_executable = script_utils.find_executable("git")
    subprocess.run([git_executable, "add", "-A"], check=True)
    subprocess.run([git_executable, "commit", "-m", message], check=True)


def main(
    content_dir: Path = Path("website_content"), commit_range: str | None = None
) -> None:
    """
    Main function to update dates in markdown files.

    Args:
        content_dir (Path, optional): Directory containing markdown files.
            Defaults to "website_content" in current directory.
        commit_range (str | None, optional): Git commit range to check for modifications
            (e.g., "abc123..def456"). If None, checks for unpushed changes.
    """
    for md_file_path in content_dir.glob("*.md"):
        metadata, content = script_utils.split_yaml(md_file_path)
        if not metadata and not content:
            continue
        original_metadata = metadata.copy()

        # If the file has never been marked as published, set the publish date
        maybe_update_publish_date(metadata)

        # Check for unpushed changes and update date_updated if needed
        if is_file_modified(md_file_path, commit_range):
            metadata["date_updated"] = current_date

        # Ensure that date fields are timestamps
        for key in ("date_published", "date_updated"):
            value = metadata.get(key)
            if value:
                metadata[key] = maybe_convert_to_timestamp(value)

        if metadata != original_metadata:
            print(f"Updated date information on {md_file_path}")
            write_to_yaml(md_file_path, metadata, content)

    update_readme_copyright_year(now)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Update publication dates in markdown files"
    )
    parser.add_argument(
        "--commit-range",
        type=str,
        help="Git commit range to check (e.g., abc123..def456)",
    )
    parser.add_argument(
        "--content-dir",
        type=Path,
        default=Path("website_content"),
        help="Directory containing markdown files",
    )
    args = parser.parse_args()

    main(content_dir=args.content_dir, commit_range=args.commit_range)
