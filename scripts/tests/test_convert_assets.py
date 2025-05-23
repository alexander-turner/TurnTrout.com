import re
import subprocess
import unittest.mock as mock  # Import the mock module
from pathlib import Path

import pytest

from .. import compress, convert_assets
from .. import utils as script_utils

try:
    from . import utils as test_utils

    # ruff: noqa: F401
    from .utils import setup_test_env  # Import the fixture
except ImportError:
    import utils as test_utils  # type: ignore

mock_r2_upload = mock.MagicMock()
mock.patch.dict("sys.modules", {"r2_upload": mock_r2_upload}).start()


@pytest.mark.parametrize("ext", compress.ALLOWED_IMAGE_EXTENSIONS)
def test_image_conversion(ext: str, setup_test_env):
    test_dir = Path(setup_test_env)
    asset_path: Path = test_dir / "quartz/static" / f"asset{ext}"
    avif_path: Path = asset_path.with_suffix(".avif")
    content_path = (
        Path(setup_test_env) / "website_content" / f"{ext.lstrip('.')}.md"
    )

    convert_assets.convert_asset(
        asset_path, md_references_dir=test_dir / "website_content"
    )

    assert avif_path.exists()  # Check if AVIF file was created

    # Check that name conversion occurred
    with open(content_path) as f:
        file_content = f.read()
    assert asset_path.exists()

    target_content: str = "![](static/asset.avif)\n"
    target_content += "[[static/asset.avif]]\n"
    target_content += '<img src="static/asset.avif" alt="shrek"/>\n'
    assert file_content == target_content


@pytest.mark.parametrize("ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_video_conversion(ext: str, setup_test_env):
    asset_path: Path = (
        Path(setup_test_env) / "quartz" / "static" / f"asset{ext}"
    )
    mp4_path: Path = asset_path.with_suffix(".mp4")
    content_path: Path = (
        Path(setup_test_env) / "website_content" / f"{ext.lstrip('.')}.md"
    )
    with open(content_path) as f:
        file_content: str = f.read()

    convert_assets.convert_asset(
        asset_path,
        md_references_dir=Path(setup_test_env),
        remove_originals=True,
    )

    assert mp4_path.exists()
    with open(content_path) as f:
        file_content = f.read()

    video_tags = f" {convert_assets.GIF_ATTRIBUTES}" if ext == ".gif" else ""

    assert f"<video{video_tags}>" in file_content

    assert (
        '<source src="static/asset.mp4" type="video/mp4; codecs=hvc1">'
        in file_content
    )
    assert '<source src="static/asset.webm" type="video/webm">' in file_content


@pytest.mark.parametrize("remove_originals", [True, False])
def test_remove_source_files(setup_test_env, remove_originals):
    asset_path = Path(setup_test_env) / "quartz" / "static" / "asset.jpg"
    assert asset_path.exists()

    convert_assets.convert_asset(
        asset_path,
        remove_originals=remove_originals,
        md_references_dir=Path(setup_test_env),
    )
    assert asset_path.exists() == (not remove_originals)


def _add_metadata(file_path: Path) -> None:
    subprocess.run(
        [
            "exiftool",
            "-Artist=Test Artist",
            "-Copyright=Test Copyright",
            str(file_path),
        ],
        check=True,
    )


def test_strip_image_metadata(setup_test_env):
    image_path = (
        Path(setup_test_env) / "quartz" / "static" / "asset_with_exif.jpg"
    )
    test_utils.create_test_image(image_path, "32x32")

    _add_metadata(image_path)

    convert_assets.convert_asset(
        image_path,
        strip_metadata=True,
        md_references_dir=Path(setup_test_env),
    )

    # Read the output of exiftool on the AVIF file and assert that no EXIF data is present
    exif_output = subprocess.check_output(
        ["exiftool", image_path.with_suffix(".avif")]
    )
    assert "Test Artist" not in exif_output.decode()
    assert "Test Copyright" not in exif_output.decode()


@pytest.mark.parametrize("ext", [".mp4", ".mov"])
def test_strip_video_metadata(ext: str, setup_test_env):
    asset_path: Path = (
        Path(setup_test_env) / "quartz" / "static" / f"asset{ext}"
    )

    test_utils.create_test_video(asset_path)

    _add_metadata(asset_path)

    convert_assets.convert_asset(
        asset_path,
        strip_metadata=True,
        md_references_dir=Path(setup_test_env),
    )

    for suffix in [".mp4", ".webm"]:
        exif_output = subprocess.check_output(
            ["exiftool", asset_path.with_suffix(suffix)]
        )
        assert "Test Artist" not in exif_output.decode()
        assert "Test Copyright" not in exif_output.decode()


def test_ignores_unsupported_file_types(setup_test_env):
    asset_path = Path(setup_test_env) / "quartz" / "static" / "unsupported.txt"

    with pytest.raises(ValueError):
        convert_assets.convert_asset(
            asset_path,
            md_references_dir=Path(setup_test_env) / "website_content",
        )


def test_file_not_found(setup_test_env):
    non_existent_file = (
        Path(setup_test_env) / "quartz" / "static" / "non_existent.jpg"
    )

    assert not non_existent_file.exists()

    with pytest.raises(FileNotFoundError, match="File .* not found."):
        convert_assets.convert_asset(non_existent_file)


def test_ignores_non_quartz_path(setup_test_env):
    asset_path = Path(setup_test_env) / "file.png"

    with pytest.raises(ValueError, match="quartz.*directory"):
        convert_assets.convert_asset(
            asset_path,
            md_references_dir=Path(setup_test_env) / "website_content",
        )


def test_ignores_non_static_path(setup_test_env):
    asset_path = Path(setup_test_env) / "quartz" / "file.png"

    with pytest.raises(ValueError, match="static.*subdirectory"):
        convert_assets.convert_asset(
            asset_path,
            md_references_dir=Path(setup_test_env) / "website_content",
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
def test_valid_paths(input_path: str, expected_output: str) -> None:
    assert script_utils.path_relative_to_quartz_parent(
        Path(input_path)
    ) == Path(expected_output)


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
def test_invalid_paths(input_path: str, error_message: str) -> None:
    with pytest.raises(ValueError, match=error_message):
        script_utils.path_relative_to_quartz_parent(Path(input_path))


_ASSET_PATTERN = convert_assets.ASSET_STAGING_PATTERN


@pytest.mark.parametrize(
    "input_file, expected_source_pattern, expected_target_pattern",
    [
        (
            Path("animation.gif"),
            rf"\!?\[(?P<markdown_alt_text>.*?)\]\({_ASSET_PATTERN}(?P<link_parens>[^\)\]\"]*)"
            rf"animation\.gif\)|"
            rf"\!?\[\[{_ASSET_PATTERN}(?P<link_brackets>[^\)\]\"]*)"
            rf"animation\.gif\]\]|"
            rf"<img (?P<earlyTagInfo>[^>]*)src=\"{_ASSET_PATTERN}(?P<link_tag>[^\)\]\"]*)"
            rf"animation\.gif\"(?P<tagInfo>[^>]*(?<!/))(?P<endVideoTagInfo>)/?>",
            rf'<video {convert_assets.GIF_ATTRIBUTES} alt="\g<markdown_alt_text>">'
            rf'<source src="\g<link_parens>\g<link_brackets>\g<link_tag>animation.mp4" '
            rf'type="video/mp4; codecs=hvc1">'
            rf'<source src="\g<link_parens>\g<link_brackets>\g<link_tag>animation.webm" '
            rf'type="video/webm"></video>',
        ),
    ]
    + [
        (
            Path(f"video{ext}"),
            rf"\!?\[(?P<markdown_alt_text>.*?)\]\({_ASSET_PATTERN}(?P<link_parens>[^\)\]\"]*)"
            rf"video\{ext}\)|"
            rf"\!?\[\[{_ASSET_PATTERN}(?P<link_brackets>[^\)\]\"]*)"
            rf"video\{ext}\]\]|"
            rf"<video (?P<earlyTagInfo>[^>]*)src=\"{_ASSET_PATTERN}(?P<link_tag>[^\)\]\"]*)"
            rf"video\{ext}\"(?P<tagInfo>[^>]*)(?:type=\"video/"
            + ext.lstrip(".")
            + r"\")?(?P<endVideoTagInfo>[^>]*(?<!/))(?:/>|></video>)",
            r'<video \g<earlyTagInfo>\g<tagInfo>\g<endVideoTagInfo> alt="\g<markdown_alt_text>">'
            r'<source src="\g<link_parens>\g<link_brackets>\g<link_tag>video.mp4" '
            r'type="video/mp4; codecs=hvc1">'
            r'<source src="\g<link_parens>\g<link_brackets>\g<link_tag>video.webm" '
            r'type="video/webm"></video>',
        )
        for ext in [".webm", ".mov", ".avi", ".mp4"]
    ],
)
def test_video_patterns(
    input_file: Path,
    expected_source_pattern: str,
    expected_target_pattern: str,
):
    source_pattern = convert_assets._video_original_pattern(input_file)
    target_pattern = convert_assets._video_replacement_pattern(input_file)

    assert source_pattern == expected_source_pattern
    assert target_pattern == expected_target_pattern


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
    content_dir = test_dir / "website_content"

    test_md = content_dir / "test_video_figure.md"
    test_md.write_text(initial_content)

    dummy_video = test_dir / "quartz/static/test_video.mp4"
    test_utils.create_test_video(dummy_video)

    convert_assets.convert_asset(dummy_video, md_references_dir=content_dir)

    with open(test_md) as f:
        converted_content = f.read()

    expected_pattern = r"</video>\n\nFigure: This is a caption"
    assert re.search(
        expected_pattern, converted_content
    ), f"Expected pattern not found in:\n{converted_content}"

    assert (
        "<br/>" not in converted_content
    ), f"<br/> tag still present in:\n{converted_content}"


def test_asset_staging_path_conversion(setup_test_env) -> None:
    test_dir = Path(setup_test_env)
    asset_path: Path = test_dir / "quartz" / "static" / "asset.jpg"
    avif_path: Path = asset_path.with_suffix(".avif")
    content_path = Path(setup_test_env) / "website_content" / "staging.md"

    # Create a test markdown file with asset_staging paths
    with open(content_path, "w") as f:
        f.write("![](./asset_staging/static/asset.jpg)\n")
        f.write("[[./asset_staging/static/asset.jpg]]\n")
        f.write('<img src="./asset_staging/static/asset.jpg" alt="shrek"/>\n')

    convert_assets.convert_asset(
        asset_path, md_references_dir=test_dir / "website_content"
    )

    assert avif_path.exists()

    with open(content_path) as f:
        file_content = f.read()

    expected_content = (
        "![](static/asset.avif)\n"
        "[[static/asset.avif]]\n"
        '<img src="static/asset.avif" alt="shrek"/>\n'
    )
    assert file_content == expected_content


@pytest.mark.parametrize(
    "input_content,expected_content",
    [
        (
            "![](./static/asset.jpg)",
            "![](static/asset.avif)",
        ),
        (
            "![](./asset_staging/static/asset.jpg)",
            "![](static/asset.avif)",
        ),
        (
            '<img src="./static/asset.jpg"/>',
            '<img src="static/asset.avif"/>',
        ),
        (
            '<img src="./asset_staging/static/asset.jpg"/>',
            '<img src="static/asset.avif"/>',
        ),
        (
            '<img src="/static/asset.jpg"/>',
            '<img src="static/asset.avif"/>',
        ),
    ],
)
def test_path_pattern_variations(
    setup_test_env, input_content: str, expected_content: str
) -> None:
    test_dir = Path(setup_test_env)
    asset_path: Path = test_dir / "quartz/static" / "asset.jpg"
    content_path = Path(setup_test_env) / "website_content" / "variations.md"

    with open(content_path, "w") as f:
        f.write(input_content)

    convert_assets.convert_asset(
        asset_path, md_references_dir=test_dir / "website_content"
    )

    with open(content_path) as f:
        file_content = f.read()

    assert file_content.strip() == expected_content


_TEST_PATH_PREFIXES = ("", ".")


@pytest.mark.parametrize(
    "input_content,expected_content",
    [
        (
            f'<video src="{prefix}/asset_staging/static/video.mp4"></video>',
            '<video><source src="static/video.mp4" type="video/mp4; codecs=hvc1"><source src="static/video.webm" type="video/webm"></video>',
        )
        for prefix in _TEST_PATH_PREFIXES
    ]
    + [
        (
            f'<img src="{prefix}/asset_staging/static/animation.gif"/>',
            rf'<video {convert_assets.GIF_ATTRIBUTES}><source src="static/animation.mp4" type="video/mp4; codecs=hvc1"><source src="static/animation.webm" type="video/webm"></video>',
        )
        for prefix in _TEST_PATH_PREFIXES
    ],
)
def test_video_asset_staging_paths(
    setup_test_env, input_content: str, expected_content: str
) -> None:
    test_dir = Path(setup_test_env)
    asset_path: Path = test_dir / "quartz" / "static" / "video.mp4"
    gif_path: Path = test_dir / "quartz" / "static" / "animation.gif"

    test_utils.create_test_video(asset_path)
    test_utils.create_test_video(gif_path)
    content_path = Path(setup_test_env) / "website_content" / "video_paths.md"

    with open(content_path, "w") as f:
        f.write(input_content)

    if "animation.gif" in input_content:
        convert_assets.convert_asset(
            gif_path, md_references_dir=content_path.parent
        )
    else:
        convert_assets.convert_asset(
            asset_path, md_references_dir=content_path.parent
        )

    with open(content_path) as f:
        file_content = f.read()

    assert file_content.strip() == expected_content


@pytest.mark.parametrize(
    "input_str,expected_groups",
    [
        # Basic self-closing img tag
        (
            '<img src="./asset_staging/static/test.gif"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": "",
                "tagInfo": "",
                "endVideoTagInfo": "",
            },
        ),
        # Video tag with attributes
        (
            '<video src="static/test.mp4" alt="test"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": "",
                "tagInfo": ' alt="test"',
                "endVideoTagInfo": "",
            },
        ),
        # Video tag with attributes and no self-closing slash - shouldn't match
        (
            '<video src="static/test.mp4" alt="test">',
            None,
        ),
        # Video tag with attributes before and after src
        (
            '<video class="test" src="static/test.mp4" alt="test"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": 'class="test" ',
                "tagInfo": ' alt="test"',
                "endVideoTagInfo": "",
            },
        ),
        # Img tag with alt attribute after src
        (
            '<img src="/asset_staging/static/test.gif" alt="test"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": "",
                "tagInfo": ' alt="test"',
                "endVideoTagInfo": "",
            },
        ),
        # Img tag with class attribute before src
        (
            '<img class="test" src="static/test.gif"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": 'class="test" ',
                "tagInfo": "",
                "endVideoTagInfo": "",
            },
        ),
        # Img tag with attributes on both sides
        (
            '<img class="before" src="static/test.gif" alt="after"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": 'class="before" ',
                "tagInfo": ' alt="after"',
                "endVideoTagInfo": "",
            },
        ),
        # Img tag with slashes in attribute values
        (
            '<img data-path="/some/path" src="static/test.gif" alt="test/with/slashes"/>',
            {
                "link_tag": "static/",
                "earlyTagInfo": 'data-path="/some/path" ',
                "tagInfo": ' alt="test/with/slashes"',
                "endVideoTagInfo": "",
            },
        ),
        # Img tag without self-closing slash
        (
            '<img src="static/test.gif">',
            {
                "link_tag": "static/",
                "earlyTagInfo": "",
                "tagInfo": "",
                "endVideoTagInfo": "",
            },
        ),
        # Markdown image syntax
        (
            "![](/asset_staging/static/test.gif)",
            {
                "link_parens": "static/",
                "link_tag": None,
                "earlyTagInfo": None,
                "tagInfo": None,
                "markdown_alt_text": "",
                "endVideoTagInfo": None,
            },
        ),
        # Markdown image syntax with alt text
        (
            "![alt text](/asset_staging/static/test.gif)",
            {
                "markdown_alt_text": "alt text",
                "link_parens": "static/",
                "link_tag": None,
                "earlyTagInfo": None,
                "tagInfo": None,
                "endVideoTagInfo": None,
            },
        ),
        # Wiki-link syntax
        (
            "[[/asset_staging/static/test.gif]]",
            {
                "link_brackets": "static/",
                "link_tag": None,
                "earlyTagInfo": None,
                "tagInfo": None,
                "endVideoTagInfo": None,
            },
        ),
    ],
)
def test_video_pattern_matching(
    input_str: str, expected_groups: dict[str, str]
):
    """Test the regex patterns for video/gif tags directly to verify matching behavior"""
    ext = ".gif" if "gif" in input_str else ".mp4"
    test_file = Path(f"test{ext}")
    original_pattern = convert_assets._video_original_pattern(test_file)

    match = re.match(original_pattern, input_str)
    if expected_groups is None:
        assert match is None, f"Avoided matching with {input_str}"
        return
    assert match is not None, f"Pattern failed to match: {input_str}"

    # Check that each group captured exactly what we expect
    for group_name, expected_value in expected_groups.items():
        actual_value = match.group(group_name)
        assert (
            actual_value == expected_value
        ), f"For {input_str}, group {group_name} captured '{actual_value}' but expected '{expected_value}'\npattern: {original_pattern}"


@pytest.mark.parametrize("ext", compress.ALLOWED_VIDEO_EXTENSIONS)
def test_markdown_video_with_alt_text(ext: str, setup_test_env):
    test_dir = Path(setup_test_env)
    content_dir = test_dir / "website_content"
    asset_name = "prune_still-easy_trajectories"
    asset_filename = f"{asset_name}{ext}"
    dummy_video_path: Path = test_dir / "quartz" / "static" / asset_filename
    test_md_path: Path = content_dir / "test_alt_text.md"

    alt_text = "The baseline RL policy makes a big mess while the AUP policy cleanly destroys the red pellets and finishes the level."
    input_markdown = f"![{alt_text}]({asset_filename})"

    test_utils.create_test_video(dummy_video_path)
    test_md_path.write_text(input_markdown)

    convert_assets.convert_asset(
        dummy_video_path, md_references_dir=content_dir
    )

    with open(test_md_path) as f:
        converted_content = f.read()

    tags_to_use = f" {convert_assets.GIF_ATTRIBUTES}" if ext == ".gif" else ""
    expected_html = (
        f'<video{tags_to_use} alt="{alt_text}">'
        f'<source src="{asset_name}.mp4" type="video/mp4; codecs=hvc1">'
        f'<source src="{asset_name}.webm" type="video/webm">'
        "</video>"
    )

    assert converted_content.strip() == expected_html


def test_convert_asset_not_a_directory(setup_test_env):
    asset_path = Path(setup_test_env) / "quartz" / "static" / "asset.jpg"
    with pytest.raises(NotADirectoryError):
        convert_assets.convert_asset(
            asset_path, md_references_dir=Path(setup_test_env) / "made-up"
        )


def test_main_runs(setup_test_env):
    """Verify that the main function runs and calls convert_asset."""
    test_dir = Path(setup_test_env)
    asset_dir = test_dir / "quartz" / "static"
    asset_path = asset_dir / "main_test.jpg"
    test_utils.create_test_image(asset_path, size="100x100")

    mock_args = mock.Mock()
    mock_args.remove_originals = False
    mock_args.strip_metadata = False
    mock_args.asset_directory = str(asset_dir)
    mock_args.ignore_files = None

    with (
        mock.patch(
            "argparse.ArgumentParser.parse_args", return_value=mock_args
        ),
        mock.patch("scripts.convert_assets.convert_asset") as mock_convert,
        mock.patch(
            "scripts.utils.get_files",
            return_value=[asset_path],
        ),
    ):
        convert_assets.main()

    # Ensure convert_asset was called with the correct asset path
    mock_convert.assert_called_once_with(
        asset_path,
        remove_originals=False,
        strip_metadata=False,
        md_references_dir=Path("website_content/"),
    )


def test_main_ignores_files(setup_test_env):
    """Verify that the main function ignores specified files."""
    test_dir = Path(setup_test_env)
    asset_dir = test_dir / "quartz" / "static"
    ignored_asset_name = "ignored_asset.png"
    converted_asset_name = "converted_asset.jpg"
    ignored_asset_path = asset_dir / ignored_asset_name
    converted_asset_path = asset_dir / converted_asset_name

    test_utils.create_test_image(ignored_asset_path, size="100x100")
    test_utils.create_test_image(converted_asset_path, size="100x100")

    mock_args = mock.Mock()
    mock_args.remove_originals = False
    mock_args.strip_metadata = False
    mock_args.asset_directory = str(asset_dir)
    mock_args.ignore_files = [ignored_asset_name]

    with (
        mock.patch(
            "argparse.ArgumentParser.parse_args", return_value=mock_args
        ),
        mock.patch("scripts.convert_assets.convert_asset") as mock_convert,
        mock.patch(
            "scripts.utils.get_files",
            return_value=[ignored_asset_path, converted_asset_path],
        ),
    ):
        convert_assets.main()

    mock_convert.assert_called_once_with(
        converted_asset_path,
        remove_originals=False,
        strip_metadata=False,
        md_references_dir=Path("website_content/"),
    )

    # Verify it wasn't called for the ignored asset
    for call in mock_convert.call_args_list:
        assert call.args[0] != ignored_asset_path


def test_main_skips_hidden_files(setup_test_env):
    """Verify that the main function skips hidden files (starting with '.')."""
    test_dir = Path(setup_test_env)
    asset_dir = test_dir / "quartz" / "static"
    hidden_asset_name = ".hidden_asset.png"
    converted_asset_name = "converted_asset.jpg"
    hidden_asset_path = asset_dir / hidden_asset_name
    converted_asset_path = asset_dir / converted_asset_name

    # Create dummy files
    test_utils.create_test_image(hidden_asset_path, size="10x10")
    test_utils.create_test_image(converted_asset_path, size="10x10")

    mock_args = mock.Mock()
    mock_args.remove_originals = False
    mock_args.strip_metadata = False
    mock_args.asset_directory = str(asset_dir)
    mock_args.ignore_files = None  # No specific ignores for this test

    with (
        mock.patch(
            "argparse.ArgumentParser.parse_args", return_value=mock_args
        ),
        mock.patch("scripts.convert_assets.convert_asset") as mock_convert,
        # Ensure get_files returns both hidden and regular assets
        mock.patch(
            "scripts.utils.get_files",
            return_value=[hidden_asset_path, converted_asset_path],
        ),
    ):
        convert_assets.main()

    # Assert convert_asset was called ONLY for the non-hidden file
    mock_convert.assert_called_once_with(
        converted_asset_path,
        remove_originals=False,
        strip_metadata=False,
        md_references_dir=Path("website_content/"),
    )

    # Verify it wasn't called for the hidden asset
    for call in mock_convert.call_args_list:
        assert call.args[0] != hidden_asset_path


def test_video_conversion_long_html(setup_test_env):
    test_dir = Path(setup_test_env)
    content_dir = test_dir / "website_content"
    asset_name = "prune_still-easy_trajectories"
    asset_filename = f"{asset_name}.mp4"
    dummy_video_path = test_dir / "quartz" / "static" / asset_filename

    test_md_path = content_dir / "test_absolute_url.md"
    input_html = '<video autoplay muted loop playsinline src="/asset_staging/static/prune_still-easy_trajectories.mp4" alt="The baseline RL policy makes a big mess while the AUP policy cleanly destroys the red pellets and finishes the level."></video>'
    test_md_path.write_text(input_html)

    test_utils.create_test_video(dummy_video_path)
    convert_assets.convert_asset(
        dummy_video_path, md_references_dir=content_dir
    )

    with open(test_md_path) as f:
        converted_content = f.read()

    expected_html = '<video autoplay muted loop playsinline alt="The baseline RL policy makes a big mess while the AUP policy cleanly destroys the red pellets and finishes the level."><source src="static/prune_still-easy_trajectories.mp4" type="video/mp4; codecs=hvc1"><source src="static/prune_still-easy_trajectories.webm" type="video/webm"></video>'
    assert converted_content == expected_html


def test_multiple_bracket_video_links(setup_test_env):
    """Test that multiple ![[...]] video links on separate lines are handled correctly."""
    test_dir = Path(setup_test_env)
    content_dir = test_dir / "website_content"

    video1_path = (
        test_dir / "quartz" / "static" / "images" / "posts" / "cls.mp4"
    )
    video2_path = (
        test_dir / "quartz" / "static" / "images" / "posts" / "no-cls.mp4"
    )

    video1_path.parent.mkdir(parents=True, exist_ok=True)
    video2_path.parent.mkdir(parents=True, exist_ok=True)

    test_utils.create_test_video(video1_path)
    test_utils.create_test_video(video2_path)

    test_md_path = content_dir / "test_multiple_brackets.md"
    input_content = """![[asset_staging/static/images/posts/cls.mp4]]

![[asset_staging/static/images/posts/no-cls.mp4]]"""
    test_md_path.write_text(input_content)

    convert_assets.convert_asset(video1_path, md_references_dir=content_dir)
    convert_assets.convert_asset(video2_path, md_references_dir=content_dir)

    with open(test_md_path) as f:
        converted_content = f.read()

    expected_content = """<video><source src="static/images/posts/cls.mp4" type="video/mp4; codecs=hvc1"><source src="static/images/posts/cls.webm" type="video/webm"></video>

<video><source src="static/images/posts/no-cls.mp4" type="video/mp4; codecs=hvc1"><source src="static/images/posts/no-cls.webm" type="video/webm"></video>"""

    assert converted_content == expected_content
