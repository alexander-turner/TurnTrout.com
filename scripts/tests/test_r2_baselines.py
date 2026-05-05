"""Tests for scripts/r2_baselines.py."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest import mock

import pytest

from scripts import r2_baselines


@pytest.fixture
def env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ACCESS_KEY_ID_TURNTROUT_MEDIA", "ak")
    monkeypatch.setenv("SECRET_ACCESS_TURNTROUT_MEDIA", "sk")
    monkeypatch.setenv("S3_ENDPOINT_ID_TURNTROUT_MEDIA", "https://r2.example")


def test_check_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in r2_baselines.REQUIRED_ENV:
        monkeypatch.delenv(var, raising=False)
    with pytest.raises(RuntimeError, match="Missing required"):
        r2_baselines._check_env()


def test_check_env_present(env_vars: None) -> None:
    r2_baselines._check_env()  # no raise


def test_write_rclone_config(env_vars: None, tmp_path: Path) -> None:
    cfg = tmp_path / "rclone.conf"
    r2_baselines._write_rclone_config(cfg)
    text = cfg.read_text()
    assert "[r2]" in text
    assert "type = s3" in text
    assert "provider = Cloudflare" in text
    assert "access_key_id = ak" in text
    assert "secret_access_key = sk" in text
    assert "endpoint = https://r2.example" in text


def test_remote_path() -> None:
    assert r2_baselines._remote_path() == "r2:turntrout/visual-baselines"


def test_rclone_invokes_subprocess(tmp_path: Path) -> None:
    cfg = tmp_path / "rclone.conf"
    cfg.write_text("[r2]\n")
    with mock.patch.object(subprocess, "run") as run:
        r2_baselines._rclone(["ls", "r2:bucket"], cfg)
    run.assert_called_once_with(
        ["rclone", f"--config={cfg}", "ls", "r2:bucket"], check=True
    )


def test_download_invokes_rclone_copy(env_vars: None, tmp_path: Path) -> None:
    target = tmp_path / "baselines"
    with mock.patch.object(r2_baselines, "_rclone") as rclone:
        r2_baselines.download(target)
    assert target.is_dir()
    rclone.assert_called_once()
    args = rclone.call_args.args[0]
    assert args[0] == "copy"
    assert args[1] == r2_baselines._remote_path()
    assert args[2] == str(target)
    assert "--include=*.png" in args
    for flag in r2_baselines.RCLONE_RETRY_FLAGS:
        assert flag in args


def test_upload_invokes_rclone_copy(env_vars: None, tmp_path: Path) -> None:
    src = tmp_path / "baselines"
    src.mkdir()
    (src / "a.png").write_bytes(b"x")
    with mock.patch.object(r2_baselines, "_rclone") as rclone:
        r2_baselines.upload(src)
    rclone.assert_called_once()
    args = rclone.call_args.args[0]
    assert args[0] == "copy"
    assert args[1] == str(src)
    assert args[2] == r2_baselines._remote_path()
    for flag in r2_baselines.RCLONE_RETRY_FLAGS:
        assert flag in args


def test_upload_missing_dir(env_vars: None, tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        r2_baselines.upload(tmp_path / "does-not-exist")


def test_main_download(env_vars: None, tmp_path: Path) -> None:
    target = tmp_path / "baselines"
    with (
        mock.patch("shutil.which", return_value="/usr/bin/rclone"),
        mock.patch.object(r2_baselines, "download") as dl,
    ):
        rc = r2_baselines.main(["download", "--dir", str(target)])
    assert rc == 0
    dl.assert_called_once_with(target)


def test_main_upload(env_vars: None, tmp_path: Path) -> None:
    target = tmp_path / "baselines"
    with (
        mock.patch("shutil.which", return_value="/usr/bin/rclone"),
        mock.patch.object(r2_baselines, "upload") as up,
    ):
        rc = r2_baselines.main(["upload", "--dir", str(target)])
    assert rc == 0
    up.assert_called_once_with(target)


def test_main_no_rclone(env_vars: None) -> None:
    with (
        mock.patch("shutil.which", return_value=None),
        pytest.raises(RuntimeError, match="rclone not found"),
    ):
        r2_baselines.main(["download"])
