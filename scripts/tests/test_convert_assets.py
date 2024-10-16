import unittest.mock as mock  # Import the mock module
import pytest
from pathlib import Path
from .. import compress
from .. import convert_assets
from . import utils as test_utils
from .. import utils as script_utils
import subprocess
import re


# --- Pytest Fixtures ---
@pytest.fixture(autouse=True)  # Runs before each test automatically
def setup_test_env(tmp_path):
    """Sets up a temporary Git repository and populates it with test assets."""

    # Create the required directories for testing
    for dir_name in ["quartz/static", "scripts", "content"]:
        (tmp_path / dir_name).mkdir(parents=True, exist_ok=True)

    # Create image assets for testing and add reference to markdown file
    for ext in compress.ALLOWED_IMAGE_EXTENSIONS:
        test_utils.create_test_image(
            tmp_path / "quartz/static" / f"asset{ext}", "32x32"
        )

        to_write = f"![](static/asset{ext})\n"
        to_write += f"[[static/asset{ext}]]\n"
        to_write += f'<img src="static/asset{ext}" alt="shrek"/>\n'
        markdown_file = tmp_path / "content" / f"{ext.lstrip('.')}.md"
        markdown_file.write_text(to_write)

    # Create video assets for testing and add references to markdown files
    for ext in compress.ALLOWED_VIDEO_EXTENSIONS:
        test_utils.create_test_video(tmp_path / "quartz/static" / f"asset{ext}")
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


# --- Tests ---


@pytest.mark.parametrize("ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_image_conversion(ext: str, setup_test_env):
    test_dir = Path(setup_test_env)
    asset_path: Path = test_dir / "quartz/static" / f"asset{ext}"
    avif_path: Path = asset_path.with_suffix(".avif")
    content_path = Path(setup_test_env) / "content" / f"{ext.lstrip('.')}.md"

    convert_assets.convert_asset(asset_path, md_replacement_dir=test_dir / "content")

    assert avif_path.exists()  # Check if AVIF file was created

    # Check that name conversion occurred
    with open(content_path, "r") as f:
        file_content = f.read()
    assert asset_path.exists()

    target_content: str = "![](static/asset.avif)\n"
    target_content += "[[static/asset.avif]]\n"
    target_content += '<img src="static/asset.avif" alt="shrek"/>\n'
    assert file_content == target_content


@pytest.mark.parametrize("ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_video_conversion(ext: str, setup_test_env):
    asset_path: Path = Path(setup_test_env) / "quartz/static" / f"asset{ext}"
    mp4_path: Path = asset_path.with_suffix(".mp4")
    content_path: Path = Path(setup_test_env) / "content" / f"{ext.lstrip('.')}.md"
    with open(content_path, "r") as f:
        file_content: str = f.read()

    convert_assets.convert_asset(
        asset_path, md_replacement_dir=Path(setup_test_env), remove_originals=True
    )

    assert mp4_path.exists()
    with open(content_path, "r") as f:
        file_content = f.read()

    video_tags = "autoplay loop muted playsinline " if ext == ".gif" else ""
    for alt_tag in ("", 'alt="shrek" '):  # The source-tag had an alt
        assert (
            f'<video {video_tags}src="static/asset.mp4" {alt_tag}type="video/mp4"><source src="static/asset.mp4" type="video/mp4"></video>'
            in file_content
        )


# Test that it keeps or removes source files
@pytest.mark.parametrize("remove_originals", [True, False])
def test_remove_source_files(setup_test_env, remove_originals):
    asset_path = Path(setup_test_env) / "quartz" / "static" / "asset.jpg"
    assert asset_path.exists()

    convert_assets.convert_asset(
        asset_path,
        remove_originals=remove_originals,
        md_replacement_dir=Path(setup_test_env),
    )
    assert asset_path.exists() == (not remove_originals)


def test_strip_metadata(setup_test_env):
    dummy_image: Path = Path(setup_test_env) / "quartz/static/asset_with_exif.jpg"
    test_utils.create_test_image(dummy_image, "32x32")

    # Simulate adding metadata using exiftool
    with mock.patch("subprocess.run") as mock_exiftool:
        mock_exiftool.return_value = subprocess.CompletedProcess(args=[], returncode=0)
        subprocess.run(
            [
                "exiftool",
                "-Artist=Test Artist",
                "-Copyright=Test Copyright",
                str(dummy_image),
            ],
            check=True,
        )

    # Convert the image to AVIF
    convert_assets.convert_asset(
        dummy_image,
        strip_metadata=True,
        md_replacement_dir=Path(setup_test_env),
    )

    # Read the output of exiftool on the AVIF file and assert that no EXIF data is present
    with mock.patch("subprocess.check_output") as mock_check_output:
        mock_check_output.return_value = b""  # No EXIF data should be returned
        exif_output = subprocess.check_output(
            ["exiftool", dummy_image.with_suffix(".avif")]
        )
        assert "Test Artist" not in exif_output.decode()  # Check for a specific tag
        assert "Test Copyright" not in exif_output.decode()


def test_ignores_unsupported_file_types(setup_test_env):
    asset_path = Path(setup_test_env) / "quartz/static/unsupported.txt"

    with pytest.raises(ValueError):
        convert_assets.convert_asset(
            asset_path, md_replacement_dir=Path(setup_test_env) / "content"
        )


def test_file_not_found(setup_test_env):
    # Create a path to a non-existent file
    non_existent_file = Path(setup_test_env) / "quartz/static/non_existent.jpg"

    # Ensure the file doesn't actually exist
    assert not non_existent_file.exists()

    # Try to convert the non-existent file and expect a FileNotFoundError
    with pytest.raises(FileNotFoundError, match="File .* not found."):
        convert_assets.convert_asset(non_existent_file)


def test_ignores_non_quartz_path(setup_test_env):
    asset_path = Path(setup_test_env) / "file.png"

    with pytest.raises(ValueError, match="quartz.*directory"):
        convert_assets.convert_asset(
            asset_path, md_replacement_dir=Path(setup_test_env) / "content"
        )


def test_ignores_non_static_path(setup_test_env):
    asset_path = Path(setup_test_env) / "quartz" / "file.png"

    with pytest.raises(ValueError, match="static.*subdirectory"):
        convert_assets.convert_asset(
            asset_path, md_replacement_dir=Path(setup_test_env) / "content"
        )


@pytest.mark.parametrize(
    "input_path,expected_output",
    [
        (
            "/home/user/projects/quartz/static/images/test.jpg",
            "quartz/static/images/test.jpg",
        ),
        (
            "/home/user/quartz/projects/quartz/static/css/style.css",
            "quartz/static/css/style.css",
        ),
        ("/quartz/static/js/script.js", "quartz/static/js/script.js"),
    ],
)
def test_valid_paths(input_path, expected_output):
    assert script_utils.path_relative_to_quartz(Path(input_path)) == Path(
        expected_output
    )


@pytest.mark.parametrize(
    "input_path,error_message",
    [
        (
            "/home/user/projects/other/file.txt",
            "The path must be within a 'quartz' directory.",
        ),
        (
            "/home/user/projects/quartz/other/file.txt",
            "The path must be within the 'static' subdirectory of 'quartz'.",
        ),
    ],
)
def test_invalid_paths(input_path, error_message):
    with pytest.raises(ValueError, match=error_message):
        script_utils.path_relative_to_quartz(Path(input_path))


@pytest.mark.parametrize(
    "input_file, expected_source_pattern, expected_target_pattern",
    [
        (
            Path("animation.gif"),
            r"\!?\[\]\((?P<link_parens>[^\)]*)animation\.gif\)|"
            r"\!?\[\[(?P<link_brackets>[^\)]*)animation\.gif\]\]|"
            r'<img (?P<earlyTagInfo>[^>]*)src="(?P<link_tag>[^\)]*)animation\.gif"(?P<tagInfo>[^>]*)(?P<endVideoTagInfo>)/?>',
            r'<video autoplay loop muted playsinline src="\g<link_parens>\g<link_brackets>\g<link_tag>animation.mp4"\g<earlyTagInfo>\g<tagInfo> type="video/mp4"\g<endVideoTagInfo>><source src="\g<link_parens>\g<link_brackets>\g<link_tag>animation.mp4" type="video/mp4"></video>',
        ),
    ]
    + [
        (
            Path(f"video{ext}"),
            rf"\!?\[\]\((?P<link_parens>[^\)]*)video\{ext}\)|"
            rf"\!?\[\[(?P<link_brackets>[^\)]*)video\{ext}\]\]|"
            r'<video (?P<earlyTagInfo>[^>]*)src="(?P<link_tag>[^\)]*)video'
            + ext
            + '"(?P<tagInfo>[^>]*)(?:type="video/'
            + ext.lstrip(".")
            + '")?(?P<endVideoTagInfo>[^>]*(?=/))/?>',
            r'<video src="\g<link_parens>\g<link_brackets>\g<link_tag>video.mp4"\g<earlyTagInfo>\g<tagInfo> type="video/mp4"\g<endVideoTagInfo>><source src="\g<link_parens>\g<link_brackets>\g<link_tag>video.mp4" type="video/mp4"></video>',
        )
        for ext in [".webm", ".mov", ".avi", ".mp4"]
    ],
)
def test_video_patterns(
    input_file: Path, expected_source_pattern: str, expected_target_pattern: str
):
    source_pattern, target_pattern = convert_assets._video_patterns(input_file)

    assert source_pattern == expected_source_pattern
    assert target_pattern == expected_target_pattern


# Test that newlines are added after video tag when it's followed by a figure caption
import pytest


@pytest.mark.parametrize(
    "initial_content",
    [
        """
    Some content before
    
    </video>
    <br/>Figure: This is a caption
    
    Some content after
    """,
        """
    Some content before
    
    </video>
    Figure: This is a caption
    
    Some content after
    """,
    ],
)
def test_video_figure_caption_formatting(setup_test_env, initial_content):
    test_dir = Path(setup_test_env)
    content_dir = test_dir / "content"

    # Create a test markdown file with the pattern we want to change
    test_md = content_dir / "test_video_figure.md"
    test_md.write_text(initial_content)

    # Create a dummy video file
    dummy_video = test_dir / "quartz/static/test_video.mp4"
    test_utils.create_test_video(dummy_video)

    # Run the conversion
    convert_assets.convert_asset(dummy_video, md_replacement_dir=content_dir)

    # Read the content of the file after conversion
    with open(test_md, "r") as f:
        converted_content = f.read()

    # Check if the pattern has been correctly modified
    expected_pattern = r"</video>\n\nFigure: This is a caption"
    assert re.search(
        expected_pattern, converted_content
    ), f"Expected pattern not found in:\n{converted_content}"

    # Additional check to ensure there's no <br/> tag left
    assert (
        "<br/>" not in converted_content
    ), f"<br/> tag still present in:\n{converted_content}"
