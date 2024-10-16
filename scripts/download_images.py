import os
import sys
import re
from . import utils as script_utils
from . import compress
import subprocess
from typing import Sequence
from pathlib import Path


def download_image(url: str, target_dir: Path) -> bool:
    filename = os.path.basename(url)
    target_path = target_dir / filename

    print(f"Downloading: {url} to {target_path}")

    curl_command: Sequence[str] = [
        "curl",
        "-L",  # Follow redirects
        "-o",
        str(target_path),  # Output file
        "--retry",
        "5",  # Retry up to 5 times
        "--retry-delay",
        "1",  # Start with a 1 second delay, doubles for each retry
        "--retry-max-time",
        "60",  # Maximum time for retries
        "-s",  # Silent mode
        "-S",  # Show error messages
        url,
    ]

    try:
        result = subprocess.run(curl_command, check=True, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {url}: {e.stderr.decode()}", file=sys.stderr)
        return False


def replace_urls_in_file(file_path: Path, url: str, new_url: str) -> None:
    with open(file_path, "r") as f:
        content = f.read()

    new_content = content.replace(url, new_url)

    with open(file_path, "w") as f:
        f.write(new_content)


SUFFIX_REGEX = r"\.(jpg|jpeg|png|gif|mov|mp4|webm|avi|mpeg|webp|avif)"


def main(markdown_files: list[Path]) -> None:
    git_root = script_utils.get_git_root()
    if git_root is None:
        raise RuntimeError("Error: Not in a git repository")
    images_dir = git_root / "quartz" / "static" / "images" / "posts"

    print(f"Images dir: {images_dir}")
    print(f"Markdown files to process: {markdown_files}")

    # 1. Find all image URLs in Markdown files
    asset_urls: set[str] = set()
    for file in markdown_files:
        with open(file, "r") as f:
            content = f.read()
            print(r"(https?://.*?" + SUFFIX_REGEX)
            urls = re.findall(r"(https?://.*?\." + SUFFIX_REGEX + r")", content)
            asset_urls.update(url for url, _ in urls)

    # 2. Download each image and replace URLs in markdown files
    target_dir = Path("static/images/posts")
    os.makedirs(images_dir, exist_ok=True)

    for url in asset_urls:
        if download_image(url, images_dir):
            new_url = f"/{target_dir}/{os.path.basename(url)}"
            for file in markdown_files:
                replace_urls_in_file(file, url, new_url)

    print("Image download and replacement complete!")


if __name__ == "__main__":
    markdown_files = [Path(path_str) for path_str in sys.argv[1:]]
    main(markdown_files)
