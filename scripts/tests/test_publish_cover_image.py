"""Tests for scripts/publish_cover_image.py."""

import sys
import unittest.mock as mock
from pathlib import Path

import pytest

from .. import publish_cover_image
from .. import utils as script_utils
from .utils import create_markdown_file

_R2_ENV_VALUES = {
    "ACCESS_KEY_ID_TURNTROUT_MEDIA": "test-access-key",
    "SECRET_ACCESS_TURNTROUT_MEDIA": "test-secret-key",
    "S3_ENDPOINT_ID_TURNTROUT_MEDIA": "test-account-id",
}

_FAKE_R2_URL = (
    "https://assets.turntrout.com/static/images/card_images/asset.jpg"
)


@pytest.fixture
def r2_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Populate the R2 credential environment variables."""
    for key, value in _R2_ENV_VALUES.items():
        monkeypatch.setenv(key, value)


@pytest.fixture
def no_r2_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all R2 credential environment variables."""
    for key in _R2_ENV_VALUES:
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def fake_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Point ``Path.home()`` at a temporary directory."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    return home


@pytest.fixture
def post_setup(mock_git_root: Path) -> dict[str, Path]:
    """Create a post with frontmatter and a local source image."""
    md_file = create_markdown_file(
        mock_git_root / script_utils.CONTENT_DIR_NAME / "post.md",
        frontmatter={"title": "Test Post"},
        content="Post body.",
    )
    source_image = mock_git_root / "asset.png"
    source_image.write_bytes(b"png-bytes")
    return {"git_root": mock_git_root, "md": md_file, "image": source_image}


def _fake_convert(
    input_path: Path, output_path: Path, max_size_kb: int | None = None
) -> None:
    """Stand-in for convert_to_jpeg: write a small fake JPEG."""
    assert input_path.is_file()
    assert max_size_kb is None
    output_path.write_bytes(b"jpeg-bytes")


def _rclone_conf_path(home: Path) -> Path:
    return home / ".config" / "rclone" / "rclone.conf"


@pytest.mark.parametrize(
    "existing_content",
    [
        None,  # no config file at all
        "[other-remote]\ntype = s3\n",  # config without an [r2] remote
    ],
)
def test_ensure_r2_remote_writes_missing_remote(
    fake_home: Path, r2_env, existing_content: str | None
) -> None:
    conf = _rclone_conf_path(fake_home)
    if existing_content is not None:
        conf.parent.mkdir(parents=True, exist_ok=True)
        conf.write_text(existing_content, encoding="utf-8")

    publish_cover_image.ensure_r2_remote()

    written = conf.read_text(encoding="utf-8")
    assert "[r2]" in written
    assert "test-access-key" in written
    assert (
        "endpoint = https://test-account-id.r2.cloudflarestorage.com" in written
    )
    if existing_content is not None:
        assert written.startswith(existing_content)


def test_ensure_r2_remote_keeps_existing_remote(
    fake_home: Path, no_r2_env
) -> None:
    """An existing [r2] remote is left untouched (no env vars needed)."""
    conf = _rclone_conf_path(fake_home)
    conf.parent.mkdir(parents=True, exist_ok=True)
    original = "[r2]\ntype = s3\naccess_key_id = preexisting\n"
    conf.write_text(original, encoding="utf-8")

    publish_cover_image.ensure_r2_remote()

    assert conf.read_text(encoding="utf-8") == original


def test_rejects_markdown_outside_content_dir(
    mock_git_root: Path, tmp_path: Path
) -> None:
    md_file = create_markdown_file(
        tmp_path / "elsewhere" / "post.md", frontmatter={"title": "Nope"}
    )
    with pytest.raises(ValueError, match="is not in the"):
        publish_cover_image.publish_cover_image(
            "image.png", md_file, dry_run=True
        )


def test_rejects_markdown_without_frontmatter(mock_git_root: Path) -> None:
    md_file = create_markdown_file(
        mock_git_root / script_utils.CONTENT_DIR_NAME / "bare.md",
        frontmatter=None,
        content="No frontmatter here.",
    )
    with pytest.raises(ValueError, match="No YAML frontmatter"):
        publish_cover_image.publish_cover_image(
            "image.png", md_file, dry_run=True
        )


def test_rejects_missing_local_image(post_setup) -> None:
    with pytest.raises(FileNotFoundError, match="Image file not found"):
        publish_cover_image.publish_cover_image(
            str(post_setup["git_root"] / "nope.png"),
            post_setup["md"],
            dry_run=True,
        )


@pytest.mark.parametrize("suffix", [".gif", ".txt", ".svg"])
def test_rejects_unconvertible_extension(post_setup, suffix: str) -> None:
    bad_image = post_setup["git_root"] / f"asset{suffix}"
    bad_image.write_bytes(b"data")
    with pytest.raises(ValueError, match="Cannot convert"):
        publish_cover_image.publish_cover_image(
            str(bad_image), post_setup["md"], dry_run=True
        )


def test_dry_run_local_image_needs_no_credentials(
    post_setup, no_r2_env, capsys: pytest.CaptureFixture
) -> None:
    """Dry run converts locally: no creds, no upload, no frontmatter write."""
    md_before = post_setup["md"].read_text(encoding="utf-8")

    with (
        mock.patch.object(
            publish_cover_image.convert_markdown_yaml,
            "convert_to_jpeg",
            side_effect=_fake_convert,
        ),
        mock.patch.object(
            publish_cover_image.r2_upload, "upload_to_r2"
        ) as mock_upload,
    ):
        publish_cover_image.publish_cover_image(
            str(post_setup["image"]), post_setup["md"], dry_run=True
        )

    mock_upload.assert_not_called()
    assert post_setup["md"].read_text(encoding="utf-8") == md_before

    local_jpeg = (
        post_setup["git_root"]
        / "quartz"
        / "static"
        / "images"
        / "card_images"
        / "asset.jpg"
    )
    assert local_jpeg.read_bytes() == b"jpeg-bytes"

    output = capsys.readouterr().out
    assert str(local_jpeg) in output
    assert _FAKE_R2_URL in output


@pytest.mark.parametrize("overwrite_existing", [True, False])
def test_publish_uploads_and_updates_frontmatter(
    post_setup, r2_env, fake_home: Path, overwrite_existing: bool
) -> None:
    with (
        mock.patch.object(
            publish_cover_image.convert_markdown_yaml,
            "convert_to_jpeg",
            side_effect=_fake_convert,
        ),
        mock.patch.object(
            publish_cover_image.r2_upload,
            "upload_to_r2",
            return_value=_FAKE_R2_URL,
        ) as mock_upload,
    ):
        publish_cover_image.publish_cover_image(
            str(post_setup["image"]),
            post_setup["md"],
            overwrite_existing=overwrite_existing,
        )

    local_jpeg = (
        post_setup["git_root"]
        / "quartz"
        / "static"
        / "images"
        / "card_images"
        / "asset.jpg"
    )
    mock_upload.assert_called_once_with(
        local_jpeg, verbose=True, overwrite_existing=overwrite_existing
    )

    updated = post_setup["md"].read_text(encoding="utf-8")
    assert f"card_image: {_FAKE_R2_URL}" in updated
    assert "title: Test Post" in updated
    assert updated.endswith("Post body.")

    # The rclone remote was configured from the env vars.
    assert "[r2]" in _rclone_conf_path(fake_home).read_text(encoding="utf-8")


def test_publish_downloads_url_source(post_setup, no_r2_env) -> None:
    url = "https://example.com/images/remote-pic.png"

    def fake_download(image_url: str, output_path: Path) -> None:
        assert image_url == url
        output_path.write_bytes(b"downloaded-png")

    with (
        mock.patch.object(
            publish_cover_image.convert_markdown_yaml,
            "download_image",
            side_effect=fake_download,
        ) as mock_download,
        mock.patch.object(
            publish_cover_image.convert_markdown_yaml,
            "convert_to_jpeg",
            side_effect=_fake_convert,
        ),
    ):
        publish_cover_image.publish_cover_image(
            url, post_setup["md"], dry_run=True
        )

    mock_download.assert_called_once()
    local_jpeg = (
        post_setup["git_root"]
        / "quartz"
        / "static"
        / "images"
        / "card_images"
        / "remote-pic.jpg"
    )
    assert local_jpeg.read_bytes() == b"jpeg-bytes"


def test_publish_fails_fast_without_credentials(post_setup, no_r2_env) -> None:
    """A non-dry run checks credentials before any download or conversion."""
    with (
        mock.patch.object(
            publish_cover_image.convert_markdown_yaml, "convert_to_jpeg"
        ) as mock_convert,
        pytest.raises(RuntimeError, match="Missing R2 credentials"),
    ):
        publish_cover_image.publish_cover_image(
            str(post_setup["image"]), post_setup["md"]
        )
    mock_convert.assert_not_called()


@pytest.mark.parametrize(
    "extra_argv, expected_kwargs",
    [
        ([], {"dry_run": False, "overwrite_existing": False}),
        (["--dry-run"], {"dry_run": True, "overwrite_existing": False}),
        (
            ["--overwrite-existing"],
            {"dry_run": False, "overwrite_existing": True},
        ),
        (
            ["--dry-run", "--overwrite-existing"],
            {"dry_run": True, "overwrite_existing": True},
        ),
    ],
)
def test_main_forwards_arguments(
    monkeypatch: pytest.MonkeyPatch,
    extra_argv: list[str],
    expected_kwargs: dict[str, bool],
) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        ["publish_cover_image.py", "image.png", "post.md", *extra_argv],
    )
    with mock.patch.object(
        publish_cover_image, "publish_cover_image"
    ) as mock_publish:
        publish_cover_image.main()

    mock_publish.assert_called_once_with(
        "image.png", Path("post.md"), **expected_kwargs
    )
