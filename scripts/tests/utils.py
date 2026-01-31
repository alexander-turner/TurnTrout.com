import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Generator
from unittest.mock import Mock

import git
import numpy as np
import PIL
import pytest
import requests
from PIL import Image
from ruamel.yaml import YAML
from ruamel.yaml.timestamp import TimeStamp

from .. import compress
from .. import utils as script_utils


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
    convert_cmd = script_utils.get_imagemagick_command("convert")
    command = [*convert_cmd, "-size", size]

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
    Creates a test video using `ffmpeg` with a silent audio track. Uses MPEG-2
    with high bitrate and all I-frames for maximum inefficiency.

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
    ffmpeg_executable = script_utils.find_executable("ffmpeg")
    base_command = [
        ffmpeg_executable,
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
    """Create a test GIF file."""
    if length_in_seconds <= 0:
        raise ValueError("length_in_seconds must be positive")
    if framerate <= 0:
        raise ValueError("framerate must be positive")
    if not (size[0] > 0 and size[1] > 0):
        raise ValueError("Image dimensions must be positive")
    if file_path.suffix.lower() != ".gif":
        raise ValueError("File extension must be .gif")

    frames: list[Image.Image] = []
    for _ in range(int(length_in_seconds * framerate)):
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


def create_markdown_file(
    path: Path,
    frontmatter: dict[str, Any] | None = None,
    content: str = "# Test",
) -> Path:
    """
    Create a markdown file with YAML front-matter.

    Args:
        path: Destination *Path*.
        frontmatter: Mapping to serialise as YAML front-matter. If *None*, no
            front-matter is written.
        content: Markdown body to append after the front-matter.
    """
    if frontmatter is not None:
        # Use ruamel.yaml for compatibility with TimeStamp objects
        yaml_parser = YAML(typ="rt")
        yaml_parser.preserve_quotes = True

        from io import StringIO

        stream = StringIO()
        yaml_parser.dump(frontmatter, stream)
        yaml_text = stream.getvalue().strip()

        md_text = f"---\n{yaml_text}\n---\n{content}"
    else:
        md_text = content
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(md_text, encoding="utf-8")
    return path


# type: ignore[name-defined]
def mock_http_response(
    *, status_code: int = 200, content: bytes = b"test"
) -> requests.Response:
    """Return a *requests.Response*-like mock object for HTTP tests."""
    mock_resp = Mock()
    mock_resp.status_code = status_code
    mock_resp.iter_content.return_value = [content]
    mock_resp.raise_for_status.return_value = None
    return mock_resp


@pytest.fixture
def setup_test_env(tmp_path: Path) -> Generator[Path, None, None]:
    """Sets up a temporary Git repository and populates it with test assets."""

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

    ffprobe_executable = script_utils.find_executable("ffprobe")
    out: bytes = subprocess.check_output(
        [
            ffprobe_executable,
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


def run_shell_command(
    script_path: Path, *args: str, shell: str = "fish"
) -> subprocess.CompletedProcess:
    """
    Execute a shell script with the specified shell interpreter.

    Args:
        script_path: Path to the script to execute.
        args: Additional arguments to pass to the script.
        shell: Shell interpreter to use (default: "fish").

    Returns:
        CompletedProcess with captured output.
    """
    shell_executable = shutil.which(shell) or shell
    cmd = [shell_executable, str(script_path)]
    cmd.extend(args)
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


def create_timestamp(dt: datetime) -> TimeStamp:
    """
    Convert a datetime object to a ruamel.yaml TimeStamp.

    Args:
        dt: The datetime to convert.

    Returns:
        TimeStamp object compatible with ruamel.yaml serialization.
    """
    return TimeStamp(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)


def setup_git_repo_with_files(
    tmp_path: Path,
    files: dict[str, dict[str, Any]],
    *,
    configure_user: bool = True,
    initial_commit: bool = True,
) -> git.Repo:
    """
    Create a git repository with specified markdown files.

    Args:
        tmp_path: Base directory for the repository.
        files: Dictionary mapping relative file paths to file configurations.
               Each config should have 'frontmatter' (optional) and 'content' keys.
               Example: {"file.md": {"frontmatter": {...}, "content": "..."}}
        configure_user: Whether to configure git user.name and user.email.
        initial_commit: Whether to create an initial commit with the files.

    Returns:
        The initialized git.Repo object.
    """
    repo = git.Repo.init(tmp_path)

    if configure_user:
        config_writer = repo.config_writer()
        config_writer.set_value("user", "name", "Test User")
        config_writer.set_value("user", "email", "test@example.com")
        config_writer.release()

    for file_path, file_config in files.items():
        full_path = tmp_path / file_path
        create_markdown_file(
            full_path,
            frontmatter=file_config.get("frontmatter"),
            content=file_config.get("content", "# Test"),
        )
        if initial_commit:
            repo.index.add([str(full_path)])

    if initial_commit and files:
        repo.index.commit("Initial commit")

    return repo
