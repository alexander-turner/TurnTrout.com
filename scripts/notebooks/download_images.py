import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Sequence

# Ensure the parent directory is in the sys path so we can import utils
sys.path.append(str(Path(__file__).parent.parent))

try:
    from .. import utils as script_utils
except ImportError:
    import utils as script_utils  # type: ignore


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
        subprocess.run(curl_command, check=True, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {url}: {e.stderr.decode()}", file=sys.stderr)
        return False


def replace_urls_in_file(file_path: Path, url: str, new_url: str) -> None:
    git_root = script_utils.get_git_root()
    content_dir = git_root / "website_content"
    if not file_path.resolve().is_relative_to(content_dir):
        raise ValueError(
            f"File path {file_path} is not in the website_content directory."
        )

    with open(file_path) as f:
        content = f.read()

    new_content = content.replace(url, new_url)

    with open(file_path, "w") as f:
        f.write(new_content)


SUFFIX_REGEX = (
    r"\.(jpg|jpeg|png|gif|mov|mp4|webm|avi|mpeg|webp|avif|svg|mp3|m4a|wav|ogg)"
)


def main(markdown_files: list[Path]) -> None:
    git_root = script_utils.get_git_root()

    # 1. Find all image URLs in Markdown files
    asset_urls: set[str] = set()
    for file in markdown_files:
        with open(file) as f:
            content = f.read()
            urls = re.findall(
                r"(https?://.*?\." + SUFFIX_REGEX + r")", content
            )
            asset_urls.update(url for url, _ in urls)

    # 2. Download each image and replace URLs in markdown files
    images_dir = git_root / "quartz" / "static" / "images" / "posts"
    os.makedirs(images_dir, exist_ok=True)

    target_dir = Path("static/images/posts")
    for url in asset_urls:
        if download_image(url, images_dir):
            new_url = f"/{target_dir}/{os.path.basename(url)}"
            for file in markdown_files:
                replace_urls_in_file(file, url, new_url)

    print("Image download and replacement complete!")


if __name__ == "__main__":
    markdown_files = [Path(path_str) for path_str in sys.argv[1:]]
    main(markdown_files)
