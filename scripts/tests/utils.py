from pathlib import Path
import subprocess
from typing import Optional
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
