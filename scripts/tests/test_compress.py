import json
import re
import subprocess
import sys
from io import StringIO
from pathlib import Path
from typing import Any

import PIL
import pytest

from .. import compress
from .. import utils as script_utils
from . import utils

# --- Image Tests ---


@pytest.mark.parametrize("image_ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_avif_creation(temp_dir: Path, image_ext: str) -> None:
    """
    Assert that AVIF files are created during conversion.
    """
    input_file = temp_dir / f"test{image_ext}"
    utils.create_test_image(input_file, "100x100")

    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")
    assert avif_file.exists()


@pytest.mark.parametrize("image_ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_avif_size_reduction(temp_dir: Path, image_ext: str) -> None:
    """
    Assert that AVIF files are smaller than the original image files.
    """
    input_file = temp_dir / f"test{image_ext}"
    utils.create_test_image(input_file, "100x100")
    original_size = input_file.stat().st_size

    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")
    avif_size = avif_file.stat().st_size

    assert (
        avif_size < original_size
    ), f"AVIF ({avif_file}) size ({avif_size}) not less than original {image_ext.upper()} ({original_size} {input_file})"


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

    assert "already exists. Skipping conversion" in stderr_capture.getvalue()


# --- Video Tests ---


@pytest.mark.parametrize("video_ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_video_conversion_creates_mp4(temp_dir: Path, video_ext: str) -> None:
    """Assert that MP4 file is created during video conversion."""
    input_file: Path = temp_dir / f"test{video_ext}"
    utils.create_test_video(input_file)
    compress.video(input_file)
    mp4_file: Path = input_file.with_suffix(".mp4")
    assert mp4_file.exists()


@pytest.mark.parametrize("video_ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_video_conversion_mp4_size(temp_dir: Path, video_ext: str) -> None:
    """Assert the size of the created MP4 file relative to the original."""
    input_file: Path = temp_dir / f"test{video_ext}"
    utils.create_test_video(input_file)
    original_size: int = input_file.stat().st_size
    compress.video(input_file)
    mp4_file: Path = input_file.with_suffix(".mp4")
    assert mp4_file.exists()  # Ensure file exists
    assert (mp4_file.stat().st_size <= original_size) or video_ext == ".webm"


@pytest.mark.parametrize("video_ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_video_conversion_creates_webm(temp_dir: Path, video_ext: str) -> None:
    """Assert that WebM file is created during video conversion."""
    input_file: Path = temp_dir / f"test{video_ext}"
    utils.create_test_video(input_file)
    compress.video(input_file)
    webm_file: Path = input_file.with_suffix(".webm")
    assert webm_file.exists()


@pytest.mark.parametrize(
    "video_ext",
    [ext for ext in compress.ALLOWED_VIDEO_EXTENSIONS if ext != ".webm"],
)
def test_video_conversion_webm_size_reduction(
    temp_dir: Path, video_ext: str
) -> None:
    """Assert that WebM file is smaller than the original video."""
    input_file: Path = temp_dir / f"test{video_ext}"
    utils.create_test_video(input_file)
    original_size: int = input_file.stat().st_size
    compress.video(input_file)
    webm_file: Path = input_file.with_suffix(".webm")
    assert webm_file.stat().st_size < original_size


def test_to_video_fails_with_non_existent_file(temp_dir: Path) -> None:
    input_file = temp_dir / "non_existent_file.mov"

    with pytest.raises(FileNotFoundError):
        compress.video(input_file)


def test_to_video_fails_with_invalid_extension(temp_dir: Path) -> None:
    input_file = temp_dir / "fakefile.fake"
    input_file.touch()

    with pytest.raises(ValueError):
        compress.video(input_file)


def test_convert_mp4_skips_if_mp4_already_exists(temp_dir: Path) -> None:
    input_file: Path = temp_dir / "test.mp4"
    utils.create_test_video(input_file, codec="libx265")

    stderr_capture = StringIO()
    sys.stderr = stderr_capture

    compress.video(input_file)
    sys.stderr = sys.__stderr__

    assert "Skipping conversion" in stderr_capture.getvalue()


def test_convert_webm_skips_if_webm_already_exists(temp_dir: Path) -> None:
    input_file: Path = temp_dir / "test.mov"
    utils.create_test_video(input_file)
    webm_file: Path = input_file.with_suffix(".webm")
    webm_file.touch()  # Create dummy WebM file

    stderr_capture = StringIO()
    sys.stderr = stderr_capture

    compress._run_ffmpeg_webm(input_file, webm_file, compress._DEFAULT_VP9_CRF)

    sys.stderr = sys.__stderr__

    assert "already exists. Skipping conversion" in stderr_capture.getvalue()
    assert webm_file.stat().st_size == 0


@pytest.mark.parametrize("quality", [-1, 64, 1000])
def test_convert_webm_invalid_quality(temp_dir: Path, quality: int) -> None:
    input_file: Path = temp_dir / "test.mov"
    utils.create_test_video(input_file)
    webm_file: Path = input_file.with_suffix(".webm")

    with pytest.raises(ValueError, match="must be between 0 and 63"):
        compress._run_ffmpeg_webm(input_file, webm_file, quality)


def test_error_probing_codec(temp_dir: Path) -> None:
    input_file: Path = temp_dir / "test.mp4"
    input_file.touch()  # Has no codec

    with pytest.raises(subprocess.CalledProcessError):
        compress.video(input_file)


def test_convert_gif_creates_mp4(temp_dir: Path) -> None:
    """Assert that converting a GIF creates an MP4 file."""
    input_file = temp_dir / "test_gif_to_mp4.gif"
    utils._create_test_gif(input_file)
    compress.video(input_file)
    output_file = input_file.with_suffix(".mp4")
    assert output_file.exists(), f"MP4 file {output_file} was not created"


def test_convert_gif_mp4_codec_is_hevc(temp_dir: Path) -> None:
    """Assert that the MP4 created from a GIF uses the HEVC codec."""
    input_file = temp_dir / "test_gif_codec.gif"
    utils._create_test_gif(input_file)
    compress.video(input_file)
    output_file = input_file.with_suffix(".mp4")
    assert output_file.exists()

    try:
        ffprobe_executable = script_utils.find_executable("ffprobe")
        result = subprocess.run(
            [
                ffprobe_executable,
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_name",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(output_file),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        assert (
            result.stdout.strip() == "hevc"
        ), f"Output video codec is not HEVC, got: {result.stdout.strip()}"
    except subprocess.CalledProcessError as e:
        pytest.fail(f"Error checking MP4 file codec: {e.stderr}")


def test_convert_gif_creates_webm(temp_dir: Path) -> None:
    """Assert that converting a GIF creates a WebM file."""
    input_file = temp_dir / "test_gif_to_webm.gif"
    utils._create_test_gif(input_file)
    compress.video(input_file)
    webm_file: Path = input_file.with_suffix(".webm")
    assert webm_file.exists(), f"WebM file {webm_file} was not created"


def _has_audio_stream(file_path: Path) -> bool:
    """Check if a video file contains an audio stream using `ffprobe`."""
    try:
        ffprobe_executable = script_utils.find_executable("ffprobe")
        result = subprocess.run(
            [
                ffprobe_executable,
                "-v",
                "error",
                "-select_streams",
                "a:0",  # Select only the first audio stream
                "-show_entries",
                "stream=codec_type",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        # If ffprobe finds an audio stream, it will output its codec type
        return len(result.stdout.strip()) > 0
    except subprocess.CalledProcessError as e:
        # If ffprobe exits with an error, check stderr (captured by capture_output)
        # Often, if no stream is found, it exits with code 1 and prints to stderr
        if "Stream specifier a:0 matches no streams" in e.stderr:
            return False
        pytest.fail(
            f"`ffprobe` error checking audio stream for {file_path}: {e.stderr}"
        )
    except FileNotFoundError:
        pytest.fail(
            "`ffprobe` command not found. Ensure `ffmpeg` is installed."
        )
    return False


def test_convert_gif_output_has_no_audio(temp_dir: Path) -> None:
    """Verify that converting a GIF results in video files without audio streams."""
    input_file = temp_dir / "test_gif_no_audio.gif"
    utils._create_test_gif(input_file)
    compress.video(input_file)

    for suffix in [".mp4", ".webm"]:
        output_file = input_file.with_suffix(suffix)
        assert output_file.exists(), f"{suffix} file not created from GIF"
        assert not _has_audio_stream(
            output_file
        ), f"{suffix} output from GIF should not have audio"


def test_convert_video_output_has_audio(temp_dir: Path) -> None:
    """Verify that converting a standard video preserves the audio stream."""
    input_file = temp_dir / "test_video_with_audio.mov"
    # create_test_video generates a video with a default silent audio track
    utils.create_test_video(input_file)
    compress.video(input_file)

    for suffix in [".mp4", ".webm"]:
        output_file = input_file.with_suffix(suffix)
        assert output_file.exists(), f"{suffix} file not created from video"
        assert _has_audio_stream(
            output_file
        ), f"{suffix} output from video should have audio"


def _get_frame_rate(file_path: Path) -> float:
    ffprobe_executable = script_utils.find_executable("ffprobe")
    result = subprocess.run(
        [
            ffprobe_executable,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            str(file_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    probe_data = json.loads(result.stdout)
    for stream in probe_data.get("streams", []):
        if stream.get("codec_type") == "video":
            avg_frame_rate = stream.get("avg_frame_rate", "0/0")
            num, den = map(int, avg_frame_rate.split("/"))
            return num / den if den != 0 else 0
    return 0


@pytest.mark.parametrize("input_file_ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_avif_preserves_color_profile(
    temp_dir: Path, input_file_ext: str
) -> None:
    """Test that AVIF conversion preserves sRGB color profile."""
    input_file = temp_dir / f"test{input_file_ext}"
    utils.create_test_image(input_file, "100x100", colorspace="sRGB")

    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")

    # Check color profile using ImageMagick
    magick_executable = script_utils.find_executable("magick")
    result = subprocess.run(
        [magick_executable, "identify", "-verbose", str(avif_file)],
        capture_output=True,
        text=True,
        check=True,
    )

    assert (
        "Colorspace: sRGB" in result.stdout
    ), "AVIF file should have sRGB colorspace"


def test_png_input_has_transparency(temp_dir: Path) -> None:
    """Verify that the test utility creates a PNG with transparency."""
    input_file = temp_dir / "test_transparent_input.png"
    utils.create_test_image(
        input_file,
        "100x100",
        background="none",
        draw="circle 50,50 20,20",
    )
    pre_result = subprocess.run(
        ["/opt/homebrew/bin/magick", "identify", "-verbose", str(input_file)],
        capture_output=True,
        text=True,
        check=True,
    )
    assert (
        "Alpha: 8-bit" in pre_result.stdout
    ), "Input PNG file should have transparency before conversion"


def test_avif_output_preserves_transparency(temp_dir: Path) -> None:
    """Test that AVIF conversion preserves transparency from the input PNG."""
    input_file = temp_dir / "test_transparent_output.png"
    utils.create_test_image(
        input_file,
        "100x100",
        background="none",
        draw="circle 50,50 20,20",
    )

    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")

    # Check for alpha channel using ImageMagick
    post_result = subprocess.run(
        ["/opt/homebrew/bin/magick", "identify", "-verbose", str(avif_file)],
        capture_output=True,
        text=True,
        check=True,
    )
    assert (
        "Alpha: 8-bit" in post_result.stdout
    ), "AVIF file should preserve transparency"


@pytest.mark.parametrize("input_file_ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_avif_quality_affects_file_size(
    temp_dir: Path, input_file_ext: str
) -> None:
    """Test that different quality settings produce different file sizes."""
    input_file = temp_dir / f"test{input_file_ext}"
    utils.create_test_image(input_file, "100x100")

    # Convert with high quality
    compress.image(input_file, quality=80)
    high_quality_size = input_file.with_suffix(".avif").stat().st_size

    # Remove the first AVIF
    input_file.with_suffix(".avif").unlink()

    # Convert with low quality
    compress.image(input_file, quality=20)
    low_quality_size = input_file.with_suffix(".avif").stat().st_size

    assert (
        high_quality_size > low_quality_size
    ), "Higher quality setting should produce larger file size"


def test_avif_format_chroma(temp_dir: Path) -> None:
    """Test that AVIF conversion sets correct Chroma Format (YUV 4:2:0)."""
    input_file = temp_dir / "test_chroma.png"
    utils.create_test_image(input_file, "100x100", colorspace="sRGB")
    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")

    # Use exiftool for consistent output
    exiftool_executable = script_utils.find_executable("exiftool")
    result = subprocess.run(
        [exiftool_executable, str(avif_file)],
        capture_output=True,
        text=True,
        check=True,
    )
    assert re.search(
        r"Chroma Format\s*:\s*YUV 4:2:0", result.stdout
    ), "AVIF should use YUV 4:2:0"


def test_avif_format_pixel_depth(temp_dir: Path) -> None:
    """Test that AVIF conversion sets correct Pixel Depth (8-bit)."""
    input_file = temp_dir / "test_depth.png"
    utils.create_test_image(input_file, "100x100", colorspace="sRGB")
    compress.image(input_file)
    avif_file = input_file.with_suffix(".avif")
    assert avif_file.exists()

    exiftool_executable = script_utils.find_executable("exiftool")
    result = subprocess.run(
        [exiftool_executable, str(avif_file)],
        capture_output=True,
        text=True,
        check=True,
    )
    assert re.search(
        r"Image Pixel Depth\s*:\s*8 8 8", result.stdout
    ), "AVIF should have 8-bit depth"


@pytest.mark.parametrize(
    "test_id, length_in_seconds, expected_fps",
    [
        ("standard", 100, 10),  # 100s -> floor(1000/100) = 10 fps
        ("slow", 500, 2),  # 500s -> floor(1000/500) = 2 fps
        (
            "fast",
            33,
            33,
        ),  # 33s target -> ~30s actual -> floor(1000/30) = 33 fps
    ],
)
def test_get_gif_frame_rate_parametrized(
    temp_dir: Path, test_id: str, length_in_seconds: float, expected_fps: int
) -> None:
    """Test `_get_gif_frame_rate` with various valid GIF `length_in_seconds`."""
    input_file = temp_dir / f"{test_id}.gif"
    utils._create_test_gif(
        input_file,
        length_in_seconds=length_in_seconds,
        size=(10, 10),
        framerate=expected_fps,
    )
    assert round(utils._get_gif_frame_rate(input_file)) == expected_fps


def test_get_gif_frame_rate_zero_length_in_seconds(
    temp_dir: Path, monkeypatch
) -> None:
    """Test `_get_gif_frame_rate` when Pillow reports zero `length_in_seconds`."""
    input_file = temp_dir / "zero_length_in_seconds.gif"
    utils._create_test_gif(input_file)

    class MockImage:
        info: dict[str, int | None] = {"duration": 0}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            # No resources to clean up
            pass

    def mock_open(*args, **kwargs):
        return MockImage()

    monkeypatch.setattr(PIL.Image, "open", mock_open)

    # Expect a ZeroDivisionError or potentially a default value if handled
    with pytest.raises(ZeroDivisionError):
        utils._get_gif_frame_rate(input_file)


def test_get_gif_frame_rate_missing_length_in_seconds(
    temp_dir: Path, monkeypatch
) -> None:
    """Test `_get_gif_frame_rate` when `length_in_seconds` info is missing."""
    input_file = temp_dir / "missing_length_in_seconds.gif"
    utils._create_test_gif(input_file)

    class MockImage:
        info: dict[str, int | None] = {}  # Missing 'length_in_seconds'

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            # No resources to clean up
            pass

    def mock_open(*args, **kwargs):
        return MockImage()

    monkeypatch.setattr(PIL.Image, "open", mock_open)

    with pytest.raises(KeyError):
        utils._get_gif_frame_rate(input_file)


@pytest.mark.parametrize(
    "test_id, mock_output, expected_result",
    [
        ("is_hevc", "hevc\n", True),
        ("is_h264", "h264\n", False),
        ("is_vp9", "vp9\n", False),
        ("empty_output", "", False),
        ("whitespace_output", " \n ", False),
    ],
)
def test_check_if_hevc_codec(
    temp_dir: Path,
    monkeypatch,
    test_id: str,
    mock_output: str,
    expected_result: bool,
) -> None:
    """Test `_check_if_hevc_codec` with various `ffprobe` outputs."""
    input_file = temp_dir / f"test_{test_id}.mp4"
    input_file.touch()

    def mock_check_output(*args: Any, **kwargs: Any) -> str:
        return mock_output

    monkeypatch.setattr(subprocess, "check_output", mock_check_output)
    assert compress._check_if_hevc_codec(input_file) is expected_result


def test_check_if_hevc_codec_ffprobe_error(
    temp_dir: Path, monkeypatch
) -> None:
    """Test `_check_if_hevc_codec` raises error on `ffprobe` failure."""
    input_file = temp_dir / "test_error.mp4"
    input_file.touch()

    def mock_check_output(*args: Any, **kwargs: Any) -> None:
        raise subprocess.CalledProcessError(
            cmd=list(args[0]), returncode=1, stderr="ffprobe error"
        )

    monkeypatch.setattr(subprocess, "check_output", mock_check_output)
    with pytest.raises(subprocess.CalledProcessError):
        compress._check_if_hevc_codec(input_file)


@pytest.mark.parametrize("input_video_ext", compress.ALLOWED_VIDEO_EXTENSIONS)
@pytest.mark.parametrize("framerate", [15, 30, 60, 45.53])
def test_video_preserves_framerate(
    temp_dir: Path, input_video_ext: str, framerate: float
) -> None:
    """Test that WebM from video preserves the original frame rate."""
    input_file = temp_dir / f"test_framerate_{framerate}{input_video_ext}"

    utils.create_test_video(input_file, framerate=framerate)
    compress.video(input_file)

    input_fps = utils._get_frame_rate(input_file)

    # TODO `create_test_video` framerate isn't reliable for GIFs
    if input_video_ext != ".gif":
        assert input_fps == pytest.approx(
            framerate, rel=0.05
        ), f"Input FPS {input_fps} does not match expected FPS {framerate}"

    for output_video_ext in [".webm", ".mp4"]:
        output_file = input_file.with_suffix(output_video_ext)
        output_fps = _get_frame_rate(output_file)

        assert output_fps == pytest.approx(
            input_fps, rel=0.05
        ), f"Output FPS {output_fps} does not match expected FPS {input_fps}"
