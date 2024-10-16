#!/usr/bin/env python3
import shutil
import argparse
import subprocess
from pathlib import Path
import re
from typing import Optional, Sequence
import os


# Add this function at the beginning of the file
def get_home_directory():
    return os.environ.get("HOME", os.path.expanduser("~"))


try:
    from . import utils as script_utils
except ImportError:
    import utils as script_utils  # type: ignore

R2_BASE_URL: str = "https://assets.turntrout.com"
R2_BUCKET_NAME: str = "turntrout"
R2_MEDIA_DIR: Path = Path(get_home_directory()) / "Downloads" / "website-media-r2"


def get_r2_key(filepath: Path) -> str:
    # Convert Path to string and remove everything up to and including 'quartz/'
    key = re.sub(r".*quartz/", "", str(filepath))
    # Remove leading '/' if present
    return re.sub(r"^/", "", key)


def upload_and_move(
    file_path: Path,
    verbose: bool = False,
    replacement_dir: Optional[Path] = None,
    move_to_dir: Optional[Path] = None,
) -> None:
    """
    Upload a file to R2 storage and update references.

    Args:
        file_path (Path): The file to upload.
        verbose (bool): Whether to print verbose output.
        move_to_dir (Path): The local directory to move the file to after upload.

    Raises:
        ValueError: If the file path does not contain 'quartz/'.
        RuntimeError: If the rclone command fails.
        FileNotFoundError: If the original file cannot be moved.
    """
    if move_to_dir is None:
        move_to_dir = R2_MEDIA_DIR

    if "quartz/" not in str(file_path):
        raise ValueError("Error: File path does not contain 'quartz/'.")
    if not file_path.is_file():
        raise FileNotFoundError(f"Error: File not found: {file_path}")
    relative_path = script_utils.path_relative_to_quartz(file_path)
    r2_key: str = get_r2_key(relative_path)

    if verbose:
        print(f"Uploading {file_path} to R2 with key: {r2_key}")

    upload_target: str = f"r2:{R2_BUCKET_NAME}/{r2_key}"
    try:
        subprocess.run(["rclone", "copyto", str(file_path), upload_target], check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to upload file to R2: {e}") from e

    # Update references in markdown files
    relative_original_path: Path = script_utils.path_relative_to_quartz(file_path)
    # References start with 'static', generally
    relative_subpath: Path = Path(
        *relative_original_path.parts[relative_original_path.parts.index("static") :]
    )
    r2_address: str = f"{R2_BASE_URL}/{r2_key}"
    if verbose:
        print(f'Changing "{relative_subpath}" references to "{r2_address}"')
    for text_file_path in script_utils.get_files(replacement_dir, (".md",)):
        with open(text_file_path, "r", encoding="utf-8") as f:
            file_content: str = f.read()

        # Check original_path because it's longer than subpath
        escaped_original_path: str = re.escape(str(relative_original_path))
        escaped_relative_subpath: str = re.escape(str(relative_subpath))
        new_content: str = re.sub(
            rf"(?<=[\(\"])(?:\.?/)?(?:{escaped_original_path}|{escaped_relative_subpath})",
            r2_address,
            file_content,
        )
        with open(text_file_path, "w", encoding="utf-8") as f:
            f.write(new_content)

    if move_to_dir:
        if verbose:
            print(f"Moving original file: {file_path}")
        # Create the directory structure in the target location
        git_root = script_utils.get_git_root()
        relative_path = file_path.relative_to(str(git_root))
        target_path = move_to_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(file_path), str(target_path))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-r",
        "--replacement-dir",
        type=Path,
        default=Path(f"{script_utils.get_git_root()}") / "content",
        help="Directory to search for files to update references",
    )
    parser.add_argument(
        "-m",
        "--move-to-dir",
        type=Path,
        default=None,
        help="Move file to directory after upload",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose output"
    )
    parser.add_argument(
        "-a",
        "--all-asset-dir",  # TODO clarify name
        type=Path,
        default=None,
        help="Upload all files of specified types to the given asset directory",
    )
    parser.add_argument(
        "-t",
        "--filetypes",
        nargs="+",
        default=(".mp4", ".svg", ".avif"),
        help="File types to upload when using --all (default: .mp4 .svg .avif)",
    )
    parser.add_argument("file", type=Path, nargs="?", help="File to upload")
    args = parser.parse_args()

    files_to_upload: Sequence[Path] = []
    if args.all_asset_dir:
        files_to_upload = script_utils.get_files(
            args.all_asset_dir,
            args.filetypes,
        )
    elif args.file:
        files_to_upload = [args.file]
    else:
        parser.error("Either --all-asset-dir or a file must be specified")

    for file_to_upload in files_to_upload:
        upload_and_move(
            file_to_upload,
            verbose=args.verbose,
            replacement_dir=args.replacement_dir,
            move_to_dir=args.move_to_dir,
        )


if __name__ == "__main__":
    main()
