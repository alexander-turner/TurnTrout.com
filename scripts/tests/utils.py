from pathlib import Path
import subprocess
from .. import compress
from typing import Optional
import pytest
from PIL import Image
import numpy as np


def create_test_image(path: Path, size: str) -> None:
    """
    Creates a test image using ImageMagick.

    This function generates a solid red image of the specified size and saves it to the given path.

    Args:
        path (Path): The file path where the image will be saved.
        size (str): The size of the image in ImageMagick format (e.g., "100x100").

    Returns:
        None

    Raises:
        subprocess.CalledProcessError: If the ImageMagick command fails.
    """
    subprocess.run(["magick", "-size", size, "xc:red", str(path)], check=True)


def create_test_video(path: Path, codec: Optional[str] = None) -> None:
    """
    Creates a test video using FFmpeg.

    This function generates a short (1 second) test video using FFmpeg's built-in
    color pattern test video generator (rgbtestsrc). The video is saved to the specified path.

    Args:
        path (Path): The file path where the video will be saved.
        codec (str, optional): The video codec to use for encoding. If None, FFmpeg's default codec is used.

    Returns:
        None

    Raises:
        subprocess.CalledProcessError: If the FFmpeg command fails.

    Note:
        The function uses FFmpeg's 'lavfi' input format to generate the test video.
        Standard output and error are suppressed to keep the console clean during test runs.
    """
    base_command = [
        "ffmpeg",
        "-f",
        "lavfi",  # Use the 'lavfi' input format for generating test content
        "-i",
        "rgbtestsrc",  # Use the RGB test source pattern
        "-t",
        "1",  # Set the duration to 1 second
    ]

    if codec:
        base_command.extend(["-c:v", codec])

    base_command.append(str(path))

    subprocess.run(
        base_command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
    )


def create_test_gif(file_path, duration=1, size=(100, 100), fps=10):
    """Create a test GIF file."""
    frames = []
    for i in range(duration * fps):
        array = np.random.rand(size[1], size[0], 3) * 255
        image = Image.fromarray(array.astype("uint8")).convert("RGB")
        frames.append(image)

    frames[0].save(
        file_path, save_all=True, append_images=frames[1:], duration=1000 // fps, loop=0
    )


@pytest.fixture
def setup_test_env(tmp_path):
    """Sets up a temporary Git repository and populates it with test assets."""

    # Create the required directories for testing
    for dir_name in ["quartz/static", "scripts", "content"]:
        (tmp_path / dir_name).mkdir(parents=True, exist_ok=True)

    # Create image assets for testing and add reference to markdown file
    for ext in compress.ALLOWED_IMAGE_EXTENSIONS:
        create_test_image(tmp_path / "quartz/static" / f"asset{ext}", "32x32")

        to_write = f"![](static/asset{ext})\n"
        to_write += f"[[static/asset{ext}]]\n"
        to_write += f'<img src="static/asset{ext}" alt="shrek"/>\n'
        markdown_file = tmp_path / "content" / f"{ext.lstrip('.')}.md"
        markdown_file.write_text(to_write)

    # Create video assets for testing and add references to markdown files
    for ext in compress.ALLOWED_VIDEO_EXTENSIONS:
        create_test_video(tmp_path / "quartz/static" / f"asset{ext}")
        with open(tmp_path / "content" / f"{ext.lstrip('.')}.md", "a") as file:
            file.write(f"![](static/asset{ext})\n")
            file.write(f"[[static/asset{ext}]]\n")
            if ext != ".gif":
                file.write(f'<video src="static/asset{ext}" alt="shrek"/>\n')

    # Special handling for GIF file in markdown
    with open(tmp_path / "content" / "gif.md", "a") as file:
        file.write('<img src="static/asset.gif" alt="shrek">')

    # Create an unsupported file
    (tmp_path / "quartz/static/unsupported.txt").touch()
    # Create file outside of quartz/static
    (tmp_path / "file.png").touch()
    (tmp_path / "quartz" / "file.png").touch()

    yield tmp_path  # Return the temporary directory path
