"""Script to compress images and videos."""

import argparse
import concurrent.futures
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import IO, Final, cast

DEFAULT_IMAGE_QUALITY: Final[int] = 56
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

# Raster image formats embedded as `<img>` in the rendered site. Broader
# than ALLOWED_IMAGE_EXTENSIONS — compress.py only takes .jpg/.jpeg/.png
# as input, but the rendered HTML also embeds .avif/.webp/.gif directly.
EMBEDDED_RASTER_EXTENSIONS: Final[tuple[str, ...]] = tuple(
    sorted(set(ALLOWED_IMAGE_EXTENSIONS) | {".avif", ".webp", ".gif"})
)

# Subset of ALLOWED_VIDEO_EXTENSIONS used as inline looping muted GIF
# replacements (`<video autoplay loop muted>`). Excludes .gif/.avi/.mpeg
# because those aren't embedded as `<video>` sources on the site.
INLINE_VIDEO_EXTENSIONS: Final[tuple[str, ...]] = (".mp4", ".webm", ".mov")

# Image formats PIL can read for re-encoding to JPEG (e.g. card-image
# previews in YAML frontmatter). Subset of EMBEDDED_RASTER_EXTENSIONS —
# excludes .gif because animated GIF → first-frame JPEG isn't useful for
# social cards.
CONVERTIBLE_CARD_IMAGE_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {".avif", ".webp", ".jpg", ".jpeg", ".png"}
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
    # Machine-readable progress on stdout (parsed by `_stream_progress`);
    # `-nostats` keeps the human stats line off stderr so it stays clean for
    # error reporting.
    "-progress",
    "pipe:1",
    "-nostats",
]

# Throttle progress prints: emit a line each time the encode crosses another
# 5% of the source duration (or, when the duration is unknown, every 5s).
_PROGRESS_PCT_STEP: Final[int] = 5
_PROGRESS_SECONDS_STEP: Final[int] = 5

# Even-dimension downscale + 8-bit planar pixel format, shared by the HEVC and
# WebM encoders so both honor the same scaling/pixel-format contract.
_FFMPEG_SCALE_PIX_FMT_ARGS: Final[list[str]] = [
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-pix_fmt",
    _PIXEL_FORMAT_YUV420P,
]

# Stream-mapping for HEVC: copy the source audio track through untouched.
_HEVC_AUDIO_ARGS: Final[list[str]] = [
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:a",
    "copy",
]


def _ffmpeg_audio_loop_args(is_gif: bool, audio_args: list[str]) -> list[str]:
    """
    Build the audio + GIF-loop suffix shared by both encoders.

    GIF inputs have no audio and must loop forever (``-loop 0``); other
    sources carry ``audio_args`` through and don't loop.
    """
    return [
        *(["-an"] if is_gif else audio_args),
        *(["-loop", "0"] if is_gif else []),
    ]


def _probe_duration_seconds(video_path: Path) -> float | None:
    """
    Return the duration of *video_path* in seconds via ffprobe.

    Returns ``None`` when ffprobe cannot determine a duration (e.g. some GIF
    inputs report ``N/A``), in which case progress is shown as elapsed time
    rather than a percentage.
    """
    result = subprocess.run(
        (
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ),
        check=False,
        capture_output=True,
        text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def _progress_line(
    label: str, elapsed_seconds: float, duration_seconds: float | None
) -> str:
    """Render one throttled progress line for an in-flight encode."""
    if duration_seconds and duration_seconds > 0:
        pct = min(100, int(elapsed_seconds / duration_seconds * 100))
        return (
            f"  [{label}] {pct:3d}%  "
            f"({elapsed_seconds:5.1f}s / {duration_seconds:.1f}s)"
        )
    return f"  [{label}] {elapsed_seconds:5.1f}s elapsed"


def _stream_progress(
    stdout: IO[str], label: str, duration_seconds: float | None
) -> None:
    """
    Print throttled progress from ffmpeg's ``-progress pipe:1`` output.

    Reads ``key=value`` lines until EOF, printing a line each time the encode
    crosses another progress bucket (see ``_PROGRESS_PCT_STEP`` /
    ``_PROGRESS_SECONDS_STEP``). Newline-terminated and prefixed with *label*
    so concurrent encodes interleave readably.
    """
    last_bucket = -1
    for raw_line in stdout:
        key, sep, value = raw_line.strip().partition("=")
        if not sep or key != "out_time_us":
            continue
        try:
            out_time_us = int(value)
        except ValueError:
            continue  # ffmpeg emits "N/A" before the first frame is written
        if out_time_us < 0:
            # Before the first frame ffmpeg reports a huge negative sentinel
            # (INT64 min) rather than "N/A"; treat it as not-yet-started.
            continue
        elapsed_seconds = out_time_us / 1_000_000
        if duration_seconds and duration_seconds > 0:
            pct = min(100, int(elapsed_seconds / duration_seconds * 100))
            bucket = pct // _PROGRESS_PCT_STEP
        else:
            bucket = int(elapsed_seconds) // _PROGRESS_SECONDS_STEP
        if bucket != last_bucket:
            print(_progress_line(label, elapsed_seconds, duration_seconds))
            last_bucket = bucket


def _run_ffmpeg(
    ffmpeg_cmd: list[str],
    input_video_path: Path,
    output_path: Path,
    label: str,
    duration_seconds: float | None,
) -> None:
    """
    Run an ffmpeg command via a tempfile, then move it into place.

    Streams ffmpeg's progress to stdout while the encode runs. ffmpeg's stderr
    is routed to a tempfile so reading the progress pipe can't deadlock; on a
    non-zero exit it is surfaced via ``CalledProcessError``.
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path: Path = Path(temp_dir) / output_path.name
        full_cmd: list[str] = ffmpeg_cmd + [str(temp_path)]
        stderr_path: Path = Path(temp_dir) / "ffmpeg-stderr.log"
        with open(stderr_path, "w+", encoding="utf-8") as stderr_file:
            with subprocess.Popen(
                full_cmd,
                stdout=subprocess.PIPE,
                stderr=stderr_file,
                text=True,
            ) as process:
                _stream_progress(
                    cast(IO[str], process.stdout), label, duration_seconds
                )
                returncode = process.wait()
            if returncode != 0:
                stderr_file.seek(0)
                raise subprocess.CalledProcessError(
                    returncode, full_cmd, stderr=stderr_file.read()
                )
        shutil.move(temp_path, output_path)
    print(
        f"Successfully converted {input_video_path.name} to {output_path.name}"
    )


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


def image(image_path: Path, quality: int = DEFAULT_IMAGE_QUALITY) -> None:
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
        raise ValueError(f"Error: Unsupported file type '{image_path.suffix}'.")

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

    # HEVC and WebM are independent encodes of the same source, so run them
    # concurrently. Each ffmpeg is internally multi-threaded; two at once
    # overlaps the slower x265 pass with the VP9 pass for a ~2x wall-clock win.
    duration_seconds: float | None = _probe_duration_seconds(video_path)
    hevc_output_path: Path = video_path.with_suffix(".mp4")
    webm_output_path: Path = video_path.with_suffix(".webm")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(
                _run_ffmpeg_hevc,
                video_path,
                hevc_output_path,
                quality_hevc,
                duration_seconds,
            ),
            executor.submit(
                _run_ffmpeg_webm,
                video_path,
                webm_output_path,
                quality_webm,
                duration_seconds,
            ),
        ]
        for future in concurrent.futures.as_completed(futures):
            future.result()


def _run_ffmpeg_hevc(
    input_video_path: Path,
    output_path: Path,
    quality: int,
    duration_seconds: float | None = None,
) -> None:
    """Helper function to run the ffmpeg command for HEVC/MP4 conversion."""
    if input_video_path.suffix.lower() == ".mp4" and _check_if_hevc_codec(
        input_video_path
    ):
        _print_filepath_warning(input_video_path)
        return

    is_gif: bool = input_video_path.suffix.lower() == ".gif"
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
        "slow",
        *_FFMPEG_SCALE_PIX_FMT_ARGS,
        "-tag:v",
        _TAG_APPLE_COMPATIBILITY,
        *_ffmpeg_audio_loop_args(is_gif, _HEVC_AUDIO_ARGS),
        *_FFMPEG_COMMON_OUTPUT_ARGS,
    ]

    _run_ffmpeg(
        ffmpeg_cmd, input_video_path, output_path, "HEVC", duration_seconds
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
    duration_seconds: float | None = None,
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
        *_FFMPEG_SCALE_PIX_FMT_ARGS,
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        "-row-mt",
        "1",
        "-auto-alt-ref",
        "1",
        *_ffmpeg_audio_loop_args(is_gif, _WEBM_AUDIO_ARGS),
        *_FFMPEG_COMMON_OUTPUT_ARGS,
    ]

    _run_ffmpeg(
        ffmpeg_cmd, input_video_path, output_path, "VP9", duration_seconds
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
    # subprocess.run with check=True surfaces ffprobe's stderr in the raised
    # CalledProcessError; check_output discards it.
    result = subprocess.run(
        args,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() == "hevc"


def _parse_args() -> argparse.Namespace:  # pragma: no cover
    """Parse command-line arguments."""
    parser: argparse.ArgumentParser = argparse.ArgumentParser(
        description="Compress assets: image to AVIF, video to MP4/HEVC and WebM/VP9."
    )
    parser.add_argument("path", type=Path, help="Path to the file to compress.")
    parser.add_argument(
        "--quality-img",
        type=int,
        default=DEFAULT_IMAGE_QUALITY,
        help=f"Quality for image (AVIF) (0-100, lower means smaller file)."
        f" Default: {DEFAULT_IMAGE_QUALITY}",
    )
    parser.add_argument(
        "--quality-hevc",
        type=int,
        default=_DEFAULT_HEVC_CRF,
        help=f"Quality for video (HEVC CRF) (0-51, lower is better quality)."
        f" Default: {_DEFAULT_HEVC_CRF}",
        choices=range(52),
    )
    parser.add_argument(
        "--quality-webm",
        type=int,
        default=_DEFAULT_VP9_CRF,
        help=f"Quality for video (WebM CRF) (0-63, lower is better quality)."
        f" Default: {_DEFAULT_VP9_CRF}",
        choices=range(64),
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
