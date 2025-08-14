"""Upload files to R2 storage and update references in markdown files."""

import argparse
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Sequence

try:
    from . import utils as script_utils
except ImportError:
    import utils as script_utils  # type: ignore

R2_BASE_URL: str = "https://assets.turntrout.com"
R2_BUCKET_NAME: str = "turntrout"
_HOME_DIR = Path(os.environ.get("HOME", os.path.expanduser("~")))
R2_MEDIA_DIR: Path = _HOME_DIR / "Downloads" / "website-media-r2"


def get_r2_key(filepath: Path) -> str:
    """Convert Path to string and remove everything up to and including
    'quartz/'."""
    key = re.sub(r".*quartz/", "", str(filepath))
    # Remove leading '/' if present
    return re.sub(r"^/", "", key)


def check_exists_on_r2(upload_target: str, verbose: bool = False) -> bool:
    """
    Check if a file exists in R2 storage.

    Args:
        upload_target (str): The R2 target path to check.
        verbose (bool): Whether to print verbose output.

    Returns:
        bool: True if the file exists, False otherwise.

    Raises:
        RuntimeError: If the check operation fails.
    """
    # Extract the bucket and key from the upload_target
    _, _, path = upload_target.partition(":")
    bucket, _, key = path.partition("/")
    rclone_executable = script_utils.find_executable("rclone")
    try:
        result = subprocess.run(
            [rclone_executable, "ls", f"r2:{bucket}"],
            capture_output=True,
            text=True,
            check=False,
        )
    except subprocess.CalledProcessError as e:  # pragma: no cover
        raise RuntimeError(
            f"Failed to check existence of file in R2: {e}"
        ) from e

    if result.returncode == 0 and key in result.stdout:
        if verbose:
            print(f"File found in R2: {upload_target}")
        return True

    if verbose:
        print(f"No existing file found in R2: {upload_target}")
    return False


def update_markdown_references(
    file_path: Path,
    r2_address: str,
    references_dir: Optional[Path] = None,
    verbose: bool = False,
) -> None:
    """
    Update references to a file in markdown files with its R2 URL.

    Args:
        file_path: The original file path.
        r2_address: The R2 URL to replace references with.
        references_dir: Dir to search for files to update references.
        verbose: Whether to print verbose output.
    """
    relative_original_path = script_utils.path_relative_to_quartz_parent(
        file_path
    )
    relative_subpath = Path(
        *relative_original_path.parts[
            relative_original_path.parts.index("static") :
        ]
    )

    escaped_relative_subpath: str = re.escape(str(relative_subpath))
    source_regex: str = (
        rf"(?<=[\(\"\[])((quartz|\.)?/)?{escaped_relative_subpath}"
    )

    if verbose:
        print(f'Changing "{relative_subpath}" references to "{r2_address}"')

    # Don't git-ignore so we can update drafts
    for text_file_path in script_utils.get_files(
        references_dir, (".md",), use_git_ignore=False
    ):
        with open(text_file_path, encoding="utf-8") as f:
            file_content: str = f.read()

        new_content: str = re.sub(source_regex, r2_address, file_content)

        with open(text_file_path, "w", encoding="utf-8") as f:
            f.write(new_content)


def _download_from_r2(
    upload_target: str, target: Path
) -> None:  # pragma: no cover
    rclone_args = ["rclone", "copyto", upload_target, str(target)]
    subprocess.run(rclone_args, check=True)


def upload_to_r2(
    file_path: Path,
    verbose: bool = False,
    overwrite_existing: bool = False,
) -> str:
    """
    Upload a file to R2 storage and update references.

    Args:
        file_path (Path): The file to upload.
        verbose (bool): Whether to print verbose output.
        references_dir (Path): Dir to search for files to update references.
        overwrite_existing (bool): Whether to overwrite existing files in R2.

    Returns:
        str: The R2 URL of the uploaded file.

    Raises:
        ValueError: If the file path does not contain 'quartz/'.
        RuntimeError:
            If the rclone command fails.
            If the file exists without overwrite.
        FileNotFoundError: If the file is not found.
    """
    if "quartz/" not in str(file_path):
        raise ValueError(f"{str(file_path)} does not contain 'quartz/'.")

    if not file_path.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")

    relative_path = script_utils.path_relative_to_quartz_parent(file_path)
    r2_key: str = get_r2_key(relative_path)
    upload_target: str = f"r2:{R2_BUCKET_NAME}/{r2_key}"

    file_exists = check_exists_on_r2(upload_target, verbose)
    if file_exists and not overwrite_existing:
        print(
            f"File '{r2_key}' already exists in R2. "
            "Use '--overwrite-existing' to overwrite."
        )
        return f"{R2_BASE_URL}/{r2_key}"

    if file_exists and overwrite_existing:
        # ANSI escape code for red text
        red_start = "\033[91m"
        red_end = "\033[0m"
        print(f"{red_start}Overwriting existing file in R2: {r2_key}{red_end}")

        temp_file = Path(tempfile.gettempdir()) / file_path.name
        _download_from_r2(upload_target, temp_file)
        print(f"Downloaded backup from R2: {temp_file}")

    if verbose:
        print(f"Uploading {file_path} to R2 with key: {r2_key}")

    rclone_args = ["rclone", "copyto", str(file_path), upload_target]
    # Add metadata option for SVG files
    # otherwise CORS will deny the request by the client
    if file_path.suffix.lower() == ".svg":
        rclone_args.extend(["--metadata-set", "content-type=image/svg+xml"])
    try:
        subprocess.run(rclone_args, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to upload file to R2: {e}") from e

    return f"{R2_BASE_URL}/{r2_key}"  # The r2 address


def move_uploaded_file(
    file_path: Path,
    move_to_dir: Path = R2_MEDIA_DIR,
    verbose: bool = False,
) -> None:
    """
    Move an uploaded file to a new directory, preserving its relative path
    structure.

    Args:
        file_path (Path): The file to move.
        move_to_dir (Path): The directory to move the file to.
        verbose (bool): Whether to print verbose output.

    Raises:
        OSError: If the original file cannot be moved.
    """
    if verbose:
        print(f"Moving original file: {file_path}")

    git_root = script_utils.get_git_root()
    relative_path = file_path.absolute().relative_to(git_root)
    target_path = move_to_dir / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(file_path), str(target_path))


file_exts_to_upload = (".mp4", ".svg", ".avif", ".webm")


def upload_and_move(
    file_path: Path,
    verbose: bool = False,
    references_dir: Optional[Path] = None,
    move_to_dir: Optional[Path] = None,
    overwrite_existing: bool = False,
) -> None:
    """
    Upload a file to R2 storage, update references, and move the original file.

    Args:
        file_path (Path): The file to upload.
        verbose (bool): Whether to print verbose output.
        references_dir (Path): Dir to search for files to update references.
        move_to_dir (Path): The local dir to move the file to after upload.
        overwrite_existing (bool): Whether to overwrite existing files in R2.
    """
    r2_address: str = upload_to_r2(
        file_path,
        verbose=verbose,
        overwrite_existing=overwrite_existing,
    )
    update_markdown_references(
        file_path,
        r2_address=r2_address,
        references_dir=references_dir,
        verbose=verbose,
    )

    if move_to_dir:
        if not move_to_dir.exists():
            print(f"Warning: Directory does not exist: {move_to_dir}")
        else:
            move_uploaded_file(
                file_path, move_to_dir=move_to_dir, verbose=verbose
            )


def main() -> None:
    """Upload files to R2 storage and update references in markdown files."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--references-dir",
        type=Path,
        default=Path(f"{script_utils.get_git_root()}") / "website_content",
        help="Directory to search for files to update references",
    )
    parser.add_argument(
        "--move-to-dir",
        type=Path,
        default=None,
        help="Move file to directory after upload",
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Enable verbose output"
    )
    parser.add_argument(
        "--upload-from-directory",
        type=Path,
        default=None,
        help="Upload all files of specified types from the given directory",
    )
    parser.add_argument(
        "--filetypes",
        nargs="+",
        default=file_exts_to_upload,
        help="File types to upload when using --upload-from-directory",
    )
    parser.add_argument(
        "--overwrite-existing",
        action="store_true",
        default=False,
        help="Overwrite existing files in R2 if they already exist",
    )
    parser.add_argument("file", type=Path, nargs="?", help="File to upload")
    args = parser.parse_args()

    files_to_upload: Sequence[Path] = []
    if args.upload_from_directory:
        files_to_upload = script_utils.get_files(
            args.upload_from_directory,
            args.filetypes,
            use_git_ignore=False,  # several image dirs are git ignored
        )
    elif args.file:
        files_to_upload = [args.file]
    else:
        parser.error(
            "Either --upload_from_directory or a file must be specified"
        )

    for file_to_upload in files_to_upload:
        upload_and_move(
            file_to_upload,
            verbose=args.verbose,
            references_dir=args.references_dir,
            move_to_dir=args.move_to_dir,
            overwrite_existing=args.overwrite_existing,
        )


if __name__ == "__main__":
    main()
