from .. import compress
import shutil
import pytest
from pathlib import Path
from . import utils
import sys
from io import StringIO
import subprocess
import json
import os

# --- Image Tests ---


@pytest.mark.parametrize("image_ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_avif_file_size_reduction(temp_dir: Path, image_ext: str) -> None:
    """Assert that AVIF files are less than the size of originals."""
    input_file = temp_dir / f"test{image_ext}"
    print(input_file)
    utils.create_test_image(input_file, "100x100")
    original_size = input_file.stat().st_size

    # Convert to AVIF
    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")
    if not avif_file.exists():
        raise AssertionError

    avif_size = avif_file.stat().st_size

    if (
        avif_size >= original_size
    ):
        raise AssertionError(f"AVIF ({avif_file}) size ({avif_size}) not less than half of original {image_ext.upper()} ({original_size} {input_file})")


def test_convert_avif_fails_with_non_existent_file(temp_dir: Path) -> None:
    input_file = temp_dir / "non_existent_file.jpg"

    with pytest.raises(FileNotFoundError):
        compress.image(input_file)


def test_convert_avif_fails_with_invalid_extension(temp_dir: Path) -> None:
    input_file = temp_dir / "fakefile.fake"
    input_file.touch()

    with pytest.raises(ValueError):
        compress.image(input_file)


def test_convert_avif_skips_if_avif_already_exists(temp_dir: Path) -> None:
    input_file: Path = temp_dir / "test.jpg"
    avif_file: Path = input_file.with_suffix(".avif")
    utils.create_test_image(input_file, "100x100")
    avif_file.touch()

    stderr_capture = StringIO()
    sys.stderr = stderr_capture

    compress.image(input_file)
    sys.stderr = sys.__stderr__

    if "Skipping conversion" not in stderr_capture.getvalue():
        raise AssertionError


# --- Video Tests ---


@pytest.mark.parametrize("video_ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_video_conversion(temp_dir: Path, video_ext: str) -> None:
    input_file: Path = temp_dir / f"test{video_ext}"
    utils.create_test_video(input_file)
    original_size: int = input_file.stat().st_size

    compress.to_hevc_video(input_file)

    mp4_file: Path = input_file.with_suffix(".mp4")
    if not mp4_file.exists():
        raise AssertionError
    if not ((
        mp4_file.stat().st_size <= original_size
    ) or video_ext == ".webm"):
        raise AssertionError

def test_convert_mp4_fails_with_non_existent_file(temp_dir: Path) -> None:
    input_file = temp_dir / "non_existent_file.mov"

    with pytest.raises(FileNotFoundError):
        compress.to_hevc_video(input_file)

def test_convert_mp4_fails_with_invalid_extension(temp_dir: Path) -> None:
    input_file = temp_dir / "fakefile.fake"
    input_file.touch()

    with pytest.raises(ValueError):
        compress.to_hevc_video(input_file)

def test_convert_mp4_skips_if_mp4_already_exists(temp_dir: Path) -> None:
    input_file: Path = temp_dir / "test.mp4"
    utils.create_test_video(input_file, codec="libx265")

    stdout_capture = StringIO()
    sys.stdout = stdout_capture

    compress.to_hevc_video(input_file)
    sys.stdout = sys.__stdout__

    if "Skipping conversion" not in stdout_capture.getvalue():
        raise AssertionError

def test_error_probing_codec(temp_dir: Path) -> None:
    input_file: Path = temp_dir / "test.mp4"
    input_file.touch()

    with pytest.raises(RuntimeError):
        compress.to_hevc_video(input_file)

def test_compress_gif(temp_dir: Path) -> None:
    """Test that a GIF file is successfully converted to MP4."""
    # Create a test GIF file
    input_file = temp_dir / "test.gif"
    utils.create_test_gif(input_file, duration=1, size=(100, 100))
    
    # Compress the GIF
    compress._compress_gif(input_file)
    
    # Check if MP4 file was created
    output_file = input_file.with_suffix(".mp4")
    if not output_file.exists():
        raise AssertionError(f"MP4 file {output_file} was not created")
    
    # Check if the output file is a valid MP4 with HEVC encoding
    try:
        result = subprocess.run([
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(output_file)
        ], capture_output=True, text=True, check=True)
        
        if result.stdout.strip() != "hevc":
            raise AssertionError(f"Output video codec is not HEVC, got: {result.stdout.strip()}")
    except subprocess.CalledProcessError as e:
        pytest.fail(f"Error checking MP4 file: {e.stderr}")
    
    # Check if temporary PNG files were cleaned up
    png_files = list(temp_dir.glob(f"{input_file.stem}_*.png"))
    assert len(png_files) == 0, f"Temporary PNG files were not cleaned up: {png_files}"

def test_compress_gif_preserves_frame_rate(temp_dir: Path) -> None:
    """Test that GIF compression preserves the detected frame rate."""
    # Create a test GIF file
    input_file = temp_dir / "test_framerate.gif"
    utils.create_test_gif(input_file, duration=1, size=(100, 100), fps=15)
    
    # Compress the GIF
    compress._compress_gif(input_file)
    
    # Check if MP4 file was created
    output_file = input_file.with_suffix(".mp4")
    if not output_file.exists():
        raise AssertionError(f"MP4 file {output_file} was not created")
    
    # Get frame rates for both input and output files
    def get_frame_rate(file_path):
        result = subprocess.run([
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            str(file_path)
        ], capture_output=True, text=True, check=True)
        
        probe_data = json.loads(result.stdout)
        for stream in probe_data.get('streams', []):
            if stream.get('codec_type') == 'video':
                avg_frame_rate = stream.get('avg_frame_rate', '0/0')
                num, den = map(int, avg_frame_rate.split('/'))
                return num / den if den != 0 else 0
        return 0

    input_fps = get_frame_rate(input_file)
    output_fps = get_frame_rate(output_file)

    # Compare frame rates
    relative_error = abs(output_fps - input_fps) / input_fps
    if relative_error >= 0.01:
        raise AssertionError(f"Output frame rate ({output_fps}) differs significantly from input frame rate ({input_fps}). Relative error: {relative_error:.2%}")