"""Tests for scripts/r2_sync.py."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest import mock

import pytest

from scripts import r2_sync


@pytest.fixture
def env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ACCESS_KEY_ID_TURNTROUT_MEDIA", "ak")
    monkeypatch.setenv("SECRET_ACCESS_TURNTROUT_MEDIA", "sk")
    monkeypatch.setenv("S3_ENDPOINT_ID_TURNTROUT_MEDIA", "abc123")


def test_write_rclone_config_wraps_bare_id(
    env_vars: None, tmp_path: Path
) -> None:
    cfg = tmp_path / "rclone.conf"
    r2_sync.write_rclone_config(cfg)
    text = cfg.read_text(encoding="utf-8")
    assert "access_key_id = ak" in text
    assert "secret_access_key = sk" in text
    assert "endpoint = https://abc123.r2.cloudflarestorage.com" in text


def test_write_rclone_config_passthrough_url(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("ACCESS_KEY_ID_TURNTROUT_MEDIA", "ak")
    monkeypatch.setenv("SECRET_ACCESS_TURNTROUT_MEDIA", "sk")
    monkeypatch.setenv("S3_ENDPOINT_ID_TURNTROUT_MEDIA", "https://r2.example")
    cfg = tmp_path / "rclone.conf"
    r2_sync.write_rclone_config(cfg)
    assert "endpoint = https://r2.example" in cfg.read_text(encoding="utf-8")


def test_rclone_invokes_subprocess(tmp_path: Path) -> None:
    cfg = tmp_path / "rclone.conf"
    with mock.patch.object(subprocess, "run") as run:
        r2_sync.rclone(["ls", "r2:bucket"], cfg)
    run.assert_called_once_with(
        ["rclone", f"--config={cfg}", "ls", "r2:bucket"], check=True
    )


def test_rclone_config_context_manager(env_vars: None) -> None:
    with r2_sync.rclone_config() as config:
        assert config.exists()
        assert "[r2]" in config.read_text(encoding="utf-8")
    # The temp dir (and config) is removed on exit.
    assert not config.exists()
