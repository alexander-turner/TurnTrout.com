"""Script to compress images and videos."""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Final

_DEFAULT_IMAGE_QUALITY: Final[int] = 56
_DEFAULT_HEVC_CRF: Final[int] = 28
_DEFAULT_VP9_CRF: Final[int] = 31
ALLOWED_IMAGE_EXTENSIONS: Final[tuple[str, ...]] = tuple(
    sorted((".jpg", ".jpeg", ".png"))
)
ALLOWED_VIDEO_EXTENSIONS: Final[tuple[str, ...]] = tuple(
    sorted(
        (
            ".gif",
            ".mov",
            ".mp4",
            ".avi",
            ".mpeg",
            ".webm",
        )
    )
)
ALLOWED_EXTENSIONS: Final[tuple[str, ...]] = (
    ALLOWED_IMAGE_EXTENSIONS + ALLOWED_VIDEO_EXTENSIONS
)

_CODEC_HEVC: Final[str] = "libx265"
_CODEC_VP9: Final[str] = "libvpx-vp9"
_CODEC_AUDIO_OPUS: Final[str] = "libopus"
_PIXEL_FORMAT_YUV420P: Final[str] = "yuv420p"
_TAG_APPLE_COMPATIBILITY: Final[str] = "hvc1"

_FFMPEG_COMMON_OUTPUT_ARGS: Final[list[str]] = [
    "-movflags",
    "+faststart",
    "-y",
    "-v",
    "error",
]


def _check_dependencies() -> None:  # pragma: no cover
    """Check if required command-line tools are installed."""
    required_tools = ["ffmpeg", "ffprobe", "magick"]
    missing_tools = [
        tool for tool in required_tools if shutil.which(tool) is None
    ]
    if missing_tools:
        raise RuntimeError(
            f"Error: Missing required tools: {', '.join(missing_tools)}. "
            "Please install them (e.g. using brew install ffmpeg imagemagick)."
        )


def _print_filepath_warning(file_path: Path) -> None:
    print(
        f"File '{file_path.name}' already exists. Skipping conversion.",
        file=sys.stderr,
    )


def image(image_path: Path, quality: int = _DEFAULT_IMAGE_QUALITY) -> None:
    """
    Converts an image to AVIF format using ImageMagick.

    Args:
        `image_path`: The path to the image file.
        `quality`: The AVIF quality (0-100).
            Lower quality means smaller file size.
    """
    if not image_path.is_file():
        raise FileNotFoundError(f"Error: File '{image_path}' not found.")
    if image_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Error: Unsupported file type '{image_path.suffix}'."
        )

    avif_path: Path = image_path.with_suffix(".avif")
    if avif_path.exists():
        _print_filepath_warning(avif_path)
        return

    try:
        command: list[str | Path] = [
            "magick",
            image_path,
            "-quality",
            str(quality),
            "-strip",  # Removes metadata that might block serving
            "-colorspace",
            "sRGB",
            "-define",
            "heic:preserve-color-profile=true",
            str(avif_path),
        ]
        subprocess.run(command, check=True, capture_output=True)
        print(f"Successfully converted {image_path.name} to {avif_path.name}")
    except subprocess.CalledProcessError as e:  # pragma: no cover
        raise RuntimeError(
            f"Error during AVIF conversion of {image_path.name}: {e}"
        ) from e


def video(
    video_path: Path,
    quality_hevc: int = _DEFAULT_HEVC_CRF,
    quality_webm: int = _DEFAULT_VP9_CRF,
) -> None:
    """Converts a video to both mp4 (HEVC) and webm (VP9) formats using ffmpeg,
    unless the output files already exist."""
    if not video_path.is_file():
        raise FileNotFoundError(f"Error: Input file '{video_path}' not found.")

    if video_path.suffix.lower() not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError(
            f"Error: Unsupported file type '{video_path.suffix}'. "
            f"Supported types are: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}."
        )

    hevc_output_path: Path = video_path.with_suffix(".mp4")
    _run_ffmpeg_hevc(video_path, hevc_output_path, quality_hevc)

    webm_output_path: Path = video_path.with_suffix(".webm")
    _run_ffmpeg_webm(video_path, webm_output_path, quality_webm)


def _run_ffmpeg_hevc(
    input_video_path: Path,
    output_path: Path,
    quality: int,
) -> None:
    """Helper function to run the ffmpeg command for HEVC/MP4 conversion."""
    if input_video_path.suffix.lower() == ".mp4" and _check_if_hevc_codec(
        input_video_path
    ):
        _print_filepath_warning(input_video_path)
        return

    is_gif: bool = input_video_path.suffix.lower() == ".gif"
    audio_args = [
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:a",
        "copy",
    ]

    ffmpeg_cmd: list[str] = [
        "ffmpeg",
        "-i",
        str(input_video_path),
        "-c:v",
        _CODEC_HEVC,
        "-crf",
        str(quality),
        "-x265-params",
        "log-level=warning",  # Keep logging minimal for x265
        "-preset",
        "slower",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-pix_fmt",
        _PIXEL_FORMAT_YUV420P,
        "-tag:v",
        _TAG_APPLE_COMPATIBILITY,
        *(["-an"] if is_gif else audio_args),  # No audio for GIF output
        *(["-loop", "0"] if is_gif else []),
        *_FFMPEG_COMMON_OUTPUT_ARGS,
    ]

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path: Path = Path(temp_dir) / output_path.name
        subprocess.run(
            ffmpeg_cmd + [str(temp_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        shutil.move(temp_path, output_path)
    print(
        f"Successfully converted {input_video_path.name} to {output_path.name}"
    )


_WEBM_AUDIO_ARGS: Final[list[str]] = [
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:a",
    _CODEC_AUDIO_OPUS,
    "-b:a",
    "128k",
]


def _run_ffmpeg_webm(
    input_video_path: Path,
    output_path: Path,
    quality: int,
) -> None:
    """Helper function to run the ffmpeg command for WebM/VP9 conversion."""
    if not 0 <= quality <= 63:
        raise ValueError(
            f"WebM quality (CRF) must be between 0 and 63, got {quality}."
        )
    if output_path.exists():
        _print_filepath_warning(output_path)
        return

    is_gif: bool = input_video_path.suffix.lower() == ".gif"
    ffmpeg_cmd: list[str] = [
        "ffmpeg",
        "-i",
        str(input_video_path),
        "-c:v",
        _CODEC_VP9,
        "-crf",
        str(quality),
        "-b:v",
        "0",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-pix_fmt",
        _PIXEL_FORMAT_YUV420P,
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        "-row-mt",
        "1",
        "-auto-alt-ref",
        "1",
        *(["-an"] if is_gif else _WEBM_AUDIO_ARGS),
        *(["-loop", "0"] if is_gif else []),
        *_FFMPEG_COMMON_OUTPUT_ARGS,
    ]

    subprocess.run(
        ffmpeg_cmd + [str(output_path)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )

    print(
        f"Successfully converted {input_video_path.name} to {output_path.name}"
    )


_CMD_TO_CHECK_CODEC: tuple[str, ...] = (
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
)


def _check_if_hevc_codec(video_path: Path) -> bool:
    """Checks if the video is already HEVC encoded."""
    args: tuple[str, ...] = _CMD_TO_CHECK_CODEC + (str(video_path),)
    codec: str = subprocess.check_output(
        args, universal_newlines=True, stderr=subprocess.PIPE
    ).strip()
    return codec == "hevc"


def _parse_args() -> argparse.Namespace:  # pragma: no cover
    """Parse command-line arguments."""
    parser: argparse.ArgumentParser = argparse.ArgumentParser(
        description="Compress assets: image to AVIF,"
        " video to MP4/HEVC and WebM/VP9."
    )
    parser.add_argument(
        "path", type=Path, help="Path to the file to compress."
    )
    parser.add_argument(
        "--quality-img",
        type=int,
        default=_DEFAULT_IMAGE_QUALITY,
        help=f"Quality for image (AVIF) (0-100, lower means smaller file)."
        f" Default: {_DEFAULT_IMAGE_QUALITY}",
    )
    parser.add_argument(
        "--quality-hevc",
        type=int,
        default=_DEFAULT_HEVC_CRF,
        help=f"Quality for video (HEVC CRF) (0-51, lower is better quality)."
        f" Default: {_DEFAULT_HEVC_CRF}",
        choices=list(range(0, 52)),
    )
    parser.add_argument(
        "--quality-webm",
        type=int,
        default=_DEFAULT_VP9_CRF,
        help=f"Quality for video (WebM CRF) (0-63, lower is better quality)."
        f" Default: {_DEFAULT_VP9_CRF}",
        choices=list(range(0, 64)),
    )

    return parser.parse_args()


def main() -> None:  # pragma: no cover
    """Main execution function."""
    # Check dependencies first
    _check_dependencies()

    args: argparse.Namespace = _parse_args()
    file_path: Path = args.path

    if not file_path.is_file():
        raise FileNotFoundError(f"Error: Input file '{file_path}' not found.")

    file_suffix_lower: str = file_path.suffix.lower()

    if file_suffix_lower in ALLOWED_IMAGE_EXTENSIONS:
        image(file_path, args.quality_img)
    elif file_suffix_lower in ALLOWED_VIDEO_EXTENSIONS:
        video(file_path, args.quality_hevc, args.quality_webm)
    else:
        raise ValueError(
            f"Error: Unsupported file type '{file_path.suffix}'. "
            f"Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )


if __name__ == "__main__":
    main()
