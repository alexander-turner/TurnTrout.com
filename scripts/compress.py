#!/usr/bin/env python3
import json
import os
import tempfile
import argparse
import sys
import subprocess
from pathlib import Path

IMAGE_QUALITY: int = (
    56  # Default quality (higher is larger file size but better quality)
)
ALLOWED_IMAGE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png"}


def image(image_path: Path, quality: int = IMAGE_QUALITY) -> None:
    """Converts an image to AVIF format using ImageMagick.

    Args:
        image_path: The path to the image file.
        quality: The AVIF quality (0-100). Lower is better but slower.
    """
    if not image_path.is_file():
        raise FileNotFoundError(f"Error: File '{image_path}' not found.")
    if not image_path.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError(f"Error: Unsupported file type '{image_path.suffix}'.")

    avif_path: Path = image_path.with_suffix(".avif")
    if avif_path.exists():
        print(
            f"AVIF file '{avif_path}' already exists. Skipping conversion.",
            file=sys.stderr,
        )
        return

    try:
        command: list[str | Path] = [
            "magick",
            image_path,
            "-quality",
            str(quality),
            avif_path,
        ]
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Error during conversion: {e}") from e


ALLOWED_VIDEO_EXTENSIONS: set[str] = {
    ".gif",
    ".mov",
    ".mp4",
    ".webm",
    ".avi",
    ".mpeg",
}

ALLOWED_EXTENSIONS: set[str] = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS


VIDEO_QUALITY: int = 28  # Default quality (0-51). Lower is better but slower.


def to_hevc_video(video_path: Path, quality: int = VIDEO_QUALITY) -> None:
    """Converts a video to mp4 format using ffmpeg with HEVC encoding, if not already HEVC."""
    if not video_path.is_file():
        raise FileNotFoundError(f"Error: Input file '{video_path}' not found.")

    if video_path.suffix not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError(
            f"Error: Unsupported file type '{video_path.suffix}'. Supported types are: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}."
        )

    # Check if the input is already HEVC encoded
    probe_cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]

    try:
        codec = subprocess.check_output(probe_cmd, universal_newlines=True).strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Error probing video codec: {e}")

    if codec == "hevc":
        print(f"File {video_path} is already HEVC encoded. Skipping conversion.")
        return

    # Determine output path
    output_path = video_path.with_suffix(".mp4")
    if video_path.suffix.lower() == ".mp4":
        temp_output_path = video_path.with_stem(video_path.stem + "_temp")
    else:
        temp_output_path = output_path

    try:
        if video_path.suffix == ".gif":
            _compress_gif(video_path, quality)
        else:
            # Single pass encoding
            subprocess.run(
                [
                    "ffmpeg",
                    "-i",
                    str(video_path),
                    "-c:v",
                    "libx265",
                    "-preset",
                    "slow",
                    "-crf",
                    str(quality),
                    "-c:a",
                    "copy",  # Copy audio without re-encoding
                    "-tag:v",
                    "hvc1",  # For better compatibility with Apple devices
                    "-movflags",
                    "+faststart",
                    "-colorspace",
                    "bt709",
                    "-v",
                    "error",
                    str(temp_output_path),
                ],
                check=True,
            )

        # If we're overwriting the original file, replace it now
        if output_path == video_path:
            video_path.unlink()
            temp_output_path.rename(output_path)

    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Error during conversion: {e}") from e
    finally:
        # TODO this doesn't always work
        original_path = output_path.with_suffix(output_path.suffix + "_original")

        if original_path.exists():
            original_path.unlink()

    print(f"Successfully converted {video_path} to HEVC: {output_path}")


def _compress_gif(gif_path: Path, quality: int = VIDEO_QUALITY) -> None:
    """
    Compress a GIF file to an MP4 video, preserving the original frame rate.
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Get the frame rate of the original GIF
        probe_cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            str(gif_path),
        ]
        probe_output = subprocess.check_output(probe_cmd, universal_newlines=True)
        probe_data = json.loads(probe_output)

        # Extract the frame rate, defaulting to 10 if not found
        frame_rate = 10
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                avg_frame_rate = stream.get("avg_frame_rate", "10/1")
                num, den = map(int, avg_frame_rate.split("/"))
                frame_rate = int(num / den) if den != 0 else 10
                break

        # Extract frames from GIF
        subprocess.run(
            [
                "ffmpeg",
                "-i",
                str(gif_path),
                "-vsync",
                "0",
                f"{temp_path / 'frame_%04d.png'}",
            ],
            check=True,
        )

        try:
            # Convert frames to MP4
            output_path = gif_path.with_suffix(".mp4")
            subprocess.run(
                [
                    "ffmpeg",
                    "-framerate",
                    str(frame_rate),
                    "-i",
                    f"{temp_path / 'frame_%04d.png'}",
                    "-c:v",
                    "libx265",
                    "-crf",
                    str(quality),
                    "-vf",
                    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    "-pix_fmt",
                    "yuv420p",
                    "-loop",
                    "0",  # Loop the video indefinitely
                    "-v",
                    "error",
                    str(output_path),
                ],
                check=True,
            )

            print(f"Successfully converted {gif_path} to MP4: {output_path}")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Error during conversion: {e}") from e


if __name__ == "__main__":
    parser: argparse.ArgumentParser = argparse.ArgumentParser(
        description="Compress the asset."
    )
    parser.add_argument("path", type=Path, help="Path to the file to compress.")
    parser.add_argument(
        "-q",
        "--quality",
        type=int,
        default=None,
        help="Quality (0-100 for images)",
    )

    args: argparse.Namespace = parser.parse_args()
    if args.path.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
        arg_type = "image"
    elif args.path.suffix.lower() in ALLOWED_VIDEO_EXTENSIONS:
        arg_type = "video"
    else:
        raise ValueError(f"Error: Unsupported file type '{args.path.suffix}'.")

    if args.quality is None:
        args.quality = IMAGE_QUALITY if arg_type == "image" else VIDEO_QUALITY

    if arg_type == "image":
        image(args.path, args.quality)
    elif arg_type == "video":
        to_hevc_video(args.path, args.quality)
