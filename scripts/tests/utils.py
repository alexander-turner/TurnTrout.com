import subprocess
from pathlib import Path
from typing import Generator

import numpy as np
import PIL
import pytest
from PIL import Image

from .. import compress


def create_test_image(
    path: Path,
    size: str,
    *,
    colorspace: str | None = None,
    background: str | None = None,
    draw: str | None = None,
    metadata: str | None = None,
) -> None:
    """
    Creates a test image using ImageMagick.


    Args:
        path (Path): The file path where the image will be saved.
        size (str): The size of the image in ImageMagick format (e.g., "100x100").
        colorspace (str, optional): The colorspace to use (e.g., "sRGB").
        background (str, optional): The background color/type (e.g., "none" for transparency).
        draw (str, optional): ImageMagick draw commands to execute.
        metadata (str, optional): Metadata to add to the image (e.g., "Artist=Test Artist").

    Returns:
        None

    Raises:
        subprocess.CalledProcessError: If the ImageMagick command fails.
    """
    command = ["/opt/homebrew/bin/magick", "-size", size]

    if background:
        command.extend(["xc:" + background])
    else:
        command.extend(["xc:red"])

    if colorspace:
        command.extend(["-colorspace", colorspace])

    if draw:
        command.extend(["-draw", draw])

    if metadata:
        command.extend(["-set", metadata])

    command.append(str(path))

    subprocess.run(command, check=True)


def create_test_video(
    path: Path,
    codec: str | None = None,
    duration: int = 1,
    framerate: float = 15,
) -> None:
    """
    Creates a test video using `ffmpeg` with a silent audio track.
    Uses MPEG-2 with high bitrate and all I-frames for maximum inefficiency.


    Args:
        path (Path): The file path where the video will be saved.
        codec (str, optional): The video codec to use for encoding. If None, FFmpeg's default codec is used.
        duration (int): Duration of the video in seconds. Default is 1.
        fps (float, optional): Frames per second for the video.

    Returns:
        None

    Raises:
        `subprocess.CalledProcessError`: If the FFmpeg command fails.

    Note:
        The function uses FFmpeg's `lavfi` input format to generate the test video.
        Standard output and error are suppressed to keep the console clean during test runs.
    """
    output_extension = path.suffix.lower()
    if output_extension == ".gif":
        _create_test_gif(path, length_in_seconds=duration, framerate=framerate)
        return

    match output_extension:
        case ".webm":
            audio_codec = "libopus"
        case ".mpeg":
            audio_codec = "mp2"
        case _:
            audio_codec = "aac"
    base_command = [
        "ffmpeg",
        "-f",
        "lavfi",
        "-i",
        # Tiny video, lower framerate
        f"testsrc=size=160x120:rate={framerate}",
        "-f",
        "lavfi",
        "-i",
        "anullsrc",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:a",
        audio_codec,
        "-shortest",
        "-t",
        str(duration),
        "-v",
        "error",
    ]

    if output_extension == ".webm":
        base_command.extend(
            [
                "-c:v",
                "libvpx-vp9",
                "-b:v",
                "1M",  # Adjust bitrate as needed
            ]
        )
    else:
        if not codec:
            codec = "mpeg2video"
        base_command.extend(
            [
                "-c:v",
                codec,
                "-b:v",
                "4000k",  # High bitrate for testing
                "-g",
                "1",  # Every frame is an I-frame
                "-qmin",
                "1",  # High quality
                "-qmax",
                "1",  # High quality
            ]
        )

    base_command.append(str(path))

    subprocess.run(
        base_command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )


def _create_test_gif(
    file_path: Path,
    length_in_seconds: float = 1,
    size: tuple[int, int] = (50, 50),
    framerate: float = 15.0,
) -> None:
    """
    Create a test GIF file.
    """
    if length_in_seconds <= 0:
        raise ValueError("length_in_seconds must be positive")
    if framerate <= 0:
        raise ValueError("framerate must be positive")
    if not (size[0] > 0 and size[1] > 0):
        raise ValueError("Image dimensions must be positive")
    if file_path.suffix.lower() != ".gif":
        raise ValueError("File extension must be .gif")

    frames: list[Image.Image] = []
    for i in range(int(length_in_seconds * framerate)):
        array = np.random.rand(size[1], size[0], 3) * 255
        image = Image.fromarray(array.astype("uint8")).convert("RGB")
        frames.append(image)

    frames[0].save(
        file_path,
        save_all=True,
        append_images=frames[1:],
        duration=int(1000 / framerate),  # delay per frame in ms
        loop=0,
    )


@pytest.fixture
def setup_test_env(tmp_path: Path) -> Generator[Path, None, None]:
    """
    Sets up a temporary Git repository and populates it with test assets.
    """

    # Create the required directories for testing
    for dir_name in ["quartz/static", "scripts", "website_content"]:
        (tmp_path / dir_name).mkdir(parents=True, exist_ok=True)

    # Create image assets for testing and add reference to markdown file
    for ext in compress.ALLOWED_IMAGE_EXTENSIONS:
        create_test_image(
            tmp_path / "quartz" / "static" / f"asset{ext}", "32x32"
        )

        to_write = f"![](static/asset{ext})\n"
        to_write += f"[[static/asset{ext}]]\n"
        to_write += f'<img src="static/asset{ext}" alt="shrek"/>\n'
        markdown_file = tmp_path / "website_content" / f"{ext.lstrip('.')}.md"
        markdown_file.write_text(to_write)

    # Create video assets for testing and add references to markdown files
    for ext in compress.ALLOWED_VIDEO_EXTENSIONS:
        create_test_video(tmp_path / "quartz/static" / f"asset{ext}")
        # skipcq: PTC-W6004 because this is server-side
        with open(
            tmp_path / "website_content" / f"{ext.lstrip('.')}.md", "a"
        ) as file:
            file.write(f"![](static/asset{ext})\n")
            file.write(f"[[static/asset{ext}]]\n")
            if ext != ".gif":
                file.write(f'<video src="static/asset{ext}" alt="shrek"/>\n')

    # Special handling for GIF file in markdown
    with open(tmp_path / "website_content" / "gif.md", "a") as file:
        file.write('<img src="static/asset.gif" alt="shrek">')

    # Create an unsupported file
    (tmp_path / "quartz/static/unsupported.txt").touch()
    # Create file outside of quartz/static
    (tmp_path / "file.png").touch()
    (tmp_path / "quartz" / "file.png").touch()

    yield tmp_path  # Return the temporary directory path


def _get_frame_rate(filename: Path) -> float:
    if filename.suffix.lower() == ".gif":
        return _get_gif_frame_rate(filename)
    return _get_video_frame_rate(filename)


def _get_video_frame_rate(filename: Path) -> float:
    if not filename.exists():
        raise FileNotFoundError(f"Error: File '{filename}' not found.")

    out: bytes = subprocess.check_output(
        [
            "ffprobe",
            filename,
            "-v",
            "0",
            "-select_streams",
            "v",
            "-print_format",
            "flat",
            "-show_entries",
            "stream=r_frame_rate",
        ],
    )
    out_str: str = out.decode("utf-8")
    rate = out_str.split("=")[1].strip()[1:-1].split("/")
    if len(rate) == 1:
        return float(rate[0])
    if len(rate) == 2:
        return float(rate[0]) / float(rate[1])
    raise ValueError(
        f"Error: Invalid frame rate {out_str} for file {filename.name}."
    )


def _get_gif_frame_rate(gif_path: Path) -> float:
    return 1000 / PIL.Image.open(gif_path).info["duration"]
