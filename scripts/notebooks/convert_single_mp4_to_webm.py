import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Final, Iterator, Optional

# Assuming compress.py, r2_upload.py, and utils.py are accessible
try:
    # Attempt relative import if run as part of a package
    from .. import compress, r2_upload
    from .. import utils as script_utils
except ImportError:
    # Fallback for running as a script: Add parent dir (scripts) to sys.path
    # This allows importing compress, r2_upload, utils directly
    script_dir = Path(__file__).parent
    parent_dir = script_dir.parent
    sys.path.insert(0, str(parent_dir))
    import compress  # type: ignore
    import r2_upload  # type: ignore
    import utils as script_utils  # type: ignore


# Constants from imported modules
R2_BASE_URL: Final[str] = r2_upload.R2_BASE_URL
R2_BUCKET_NAME: Final[str] = r2_upload.R2_BUCKET_NAME
R2_MEDIA_DIR: Final[Path] = r2_upload.R2_MEDIA_DIR
_DEFAULT_VP9_CRF: Final[int] = compress._DEFAULT_VP9_CRF

# Regex to find <video> tags with exactly one source tag pointing to an R2 MP4
# Captures parts needed for reconstruction.
VIDEO_TAG_RE = re.compile(
    # Group 1: Everything before the MP4 source tag + potential indentation
    r"(<video[^>]*>\s*)"
    # Group 2: The indentation before the source tag
    r"(\s*)"
    # Group 3: The MP4 source tag itself
    r"(<source[^>]*src=['\"]"  # Start of source tag
    r"(" + re.escape(R2_BASE_URL) + r"/[^>]*?\.mp4)"  # Group 4: MP4 URL
    r"['\"][^>]*>)"  # End of source tag
    # Group 5: Everything after the source tag until </video>
    r"(\s*(?!<source).*?</video>)",
    re.IGNORECASE | re.DOTALL,
)


def _find_single_mp4_videos_for_update(content: str) -> Iterator[re.Match]:
    """Finds <video> tags with a single MP4 source and yields the match object."""
    yield from VIDEO_TAG_RE.finditer(content)


def _download_mp4(mp4_url: str, temp_dir: Path) -> Optional[Path]:
    """Downloads an MP4 file to the temporary directory using rclone."""
    mp4_filename = Path(mp4_url).name
    local_mp4_path = temp_dir / mp4_filename
    r2_key_mp4 = mp4_url.replace(f"{R2_BASE_URL}/", "")
    download_source = f"r2:{R2_BUCKET_NAME}/{r2_key_mp4}"

    try:
        print(
            f"    Downloading {mp4_url} using rclone from {download_source}..."
        )
        rclone_args = [
            "rclone",
            "copyto",
            download_source,
            str(local_mp4_path),
        ]
        subprocess.run(rclone_args, check=True, capture_output=True, text=True)
        print(f"    Download successful: {local_mp4_path.name}")
        return local_mp4_path
    except subprocess.CalledProcessError as e:
        print(
            f"    Rclone download failed for {download_source}: {e.stderr}",
            file=sys.stderr,
        )
        # Ensure partial file is removed on failure
        local_mp4_path.unlink(missing_ok=True)
        return None
    except Exception as e:
        print(
            f"    Error during rclone download for {download_source}: {e}",
            file=sys.stderr,
        )
        # Clean up potentially partially downloaded file
        local_mp4_path.unlink(missing_ok=True)
        return None


def _convert_to_webm(
    local_mp4_path: Path, quality: int = _DEFAULT_VP9_CRF
) -> Optional[Path]:
    """Converts a local MP4 file to WEBM."""
    local_webm_path = local_mp4_path.with_suffix(".webm")
    try:
        print(f"    Converting {local_mp4_path.name} to WEBM...")
        compress._run_ffmpeg_webm(local_mp4_path, local_webm_path, quality)
        print(f"    Conversion successful: {local_webm_path.name}")
        return local_webm_path
    except Exception as e:
        print(
            f"    Failed to convert {local_mp4_path.name}: {e}",
            file=sys.stderr,
        )
        # Clean up potentially created partial webm file
        local_webm_path.unlink(missing_ok=True)
        return None


def _upload_and_move_webm(
    local_webm_path: Path, r2_key_webm: str, webm_url: str
) -> bool:
    """Uploads the WEBM file to R2 and moves it to the local R2 media directory."""
    try:
        print(f"    Uploading {local_webm_path.name} to R2 key: {r2_key_webm}")
        upload_target = f"r2:{R2_BUCKET_NAME}/{r2_key_webm}"
        rclone_args = ["rclone", "copyto", str(local_webm_path), upload_target]
        subprocess.run(rclone_args, check=True, capture_output=True, text=True)
        print(f"    Upload successful: {webm_url}")

        # Move local file to R2 media dir
        target_move_path = R2_MEDIA_DIR / Path(r2_key_webm)
        target_move_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(local_webm_path), target_move_path)
        print(f"    Moved {local_webm_path.name} to {target_move_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(
            f"    Rclone upload failed for {local_webm_path.name}: {e.stderr}",
            file=sys.stderr,
        )
        return False
    except Exception as e:
        print(
            f"    Failed to upload/move {local_webm_path.name}: {e}",
            file=sys.stderr,
        )
        return False


def process_markdown_file(md_path: Path, temp_dir: Path) -> None:
    """Finds MP4 videos, ensures WEBM versions exist, and updates markdown."""
    print(f"Processing: {md_path.name}")
    try:
        original_content = md_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  Error reading file {md_path}: {e}", file=sys.stderr)
        return

    new_content_parts = []
    last_index = 0
    content_modified = False

    for match in _find_single_mp4_videos_for_update(original_content):
        # Add content before the current match
        new_content_parts.append(original_content[last_index : match.start()])

        # Extract parts from the match
        before_mp4_tag = match.group(1)
        indentation = match.group(2)
        mp4_source_tag = match.group(3)
        mp4_url = match.group(4)
        after_mp4_tag = match.group(5)

        webm_url = mp4_url.replace(".mp4", ".webm")
        r2_key_webm = webm_url.replace(f"{R2_BASE_URL}/", "")
        print(f"  Found MP4 video: {mp4_url}")

        webm_exists = r2_upload.check_exists_on_r2(
            f"r2:{R2_BUCKET_NAME}/{r2_key_webm}"
        )

        if webm_exists:
            print(f"  WEBM exists: {r2_key_webm}")
        else:
            print(f"  WEBM missing for {mp4_url}. Generating...")
            local_mp4_path = None
            local_webm_path = None
            try:
                local_mp4_path = _download_mp4(mp4_url, temp_dir)
                if not local_mp4_path:
                    print(
                        f"  Skipping due to download failure: {mp4_url}",
                        file=sys.stderr,
                    )
                    # Add original match back and continue
                    new_content_parts.append(match.group(0))
                    last_index = match.end()
                    continue

                local_webm_path = _convert_to_webm(local_mp4_path)
                if not local_webm_path:
                    print(
                        f"  Skipping due to conversion failure: {mp4_url}",
                        file=sys.stderr,
                    )
                    new_content_parts.append(match.group(0))
                    last_index = match.end()
                    continue

                if _upload_and_move_webm(
                    local_webm_path, r2_key_webm, webm_url
                ):
                    webm_exists = (
                        True  # Mark as existing after successful upload
                    )
                    print(
                        f"  Successfully generated and uploaded {r2_key_webm}"
                    )
                else:
                    print(
                        f"  Skipping due to upload failure: {mp4_url}",
                        file=sys.stderr,
                    )
                    new_content_parts.append(match.group(0))
                    last_index = match.end()
                    continue

            finally:
                # Clean up temporary files
                if local_mp4_path:
                    local_mp4_path.unlink(missing_ok=True)
                if local_webm_path and local_webm_path.exists():
                    local_webm_path.unlink(missing_ok=True)

        # If WEBM exists (either found or generated), construct the updated tag
        if webm_exists:
            webm_source_tag = (
                f'{indentation}<source src="{webm_url}" type="video/webm">'
            )
            updated_video_block = (
                f"{before_mp4_tag}{webm_source_tag}\n"
                f"{indentation}{mp4_source_tag}{after_mp4_tag}"
            )
            new_content_parts.append(updated_video_block)
            content_modified = True
            print(f"  Adding WEBM source tag for {mp4_url}")
        else:
            # If WEBM still doesn't exist (generation failed), keep the original block
            new_content_parts.append(match.group(0))

        last_index = match.end()

    # Add the remaining content after the last match
    new_content_parts.append(original_content[last_index:])

    # Write the changes back to the file if modified
    if content_modified:
        print(f"  Writing changes to {md_path.name}")
        try:
            md_path.write_text("".join(new_content_parts), encoding="utf-8")
        except Exception as e:
            print(
                f"  Error writing changes to {md_path}: {e}", file=sys.stderr
            )


def main() -> None:
    try:
        compress._check_dependencies()  # Checks ffmpeg, ffprobe, magick
        if not shutil.which("rclone"):
            raise RuntimeError("Error: Missing required tool: rclone.")
    except RuntimeError as e:
        print(f"Dependency check failed: {e}", file=sys.stderr)
        sys.exit(1)

    git_root = script_utils.get_git_root()
    content_dir = git_root / "website_content"
    if not content_dir.is_dir():
        print(
            f"Error: Content directory not found: {content_dir}",
            file=sys.stderr,
        )
        sys.exit(1)

    md_files = script_utils.get_files(
        content_dir, (".md",), use_git_ignore=False
    )

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        print(f"Using temporary directory: {temp_dir}")
        for md_file in md_files:
            process_markdown_file(md_file, temp_dir)

    print("Script finished.")


if __name__ == "__main__":
    main()
