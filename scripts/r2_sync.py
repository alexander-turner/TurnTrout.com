"""
Shared rclone primitives for talking to Cloudflare R2.

Several scripts mirror a local directory to (or from) an R2 prefix. They all
need the same thing: a throwaway rclone config built from the
``*_TURNTROUT_MEDIA`` environment variables, and a thin wrapper around the
``rclone`` executable. This module owns both so the logic lives in one place.

Required environment variables:
    - ACCESS_KEY_ID_TURNTROUT_MEDIA
    - SECRET_ACCESS_TURNTROUT_MEDIA
    - S3_ENDPOINT_ID_TURNTROUT_MEDIA
"""

import contextlib
import os
import subprocess
import tempfile
from collections.abc import Iterator, Sequence
from pathlib import Path

R2_BUCKET = "turntrout"


def write_rclone_config(config_path: Path) -> None:
    """
    Write a minimal rclone config pointing the ``r2`` remote at the bucket
    described by the ``*_TURNTROUT_MEDIA`` env vars.

    ``S3_ENDPOINT_ID_TURNTROUT_MEDIA`` is a bare Cloudflare account ID (matching
    the convention in ``.claude/hooks/session-setup.sh``). If the value already
    looks like a URL we pass it through; otherwise we wrap it as
    ``https://<id>.r2.cloudflarestorage.com``.
    """
    endpoint_id = os.environ["S3_ENDPOINT_ID_TURNTROUT_MEDIA"]
    if "://" in endpoint_id:
        endpoint = endpoint_id
    else:
        endpoint = f"https://{endpoint_id}.r2.cloudflarestorage.com"
    access_key = os.environ["ACCESS_KEY_ID_TURNTROUT_MEDIA"]
    secret_key = os.environ["SECRET_ACCESS_TURNTROUT_MEDIA"]
    config_path.write_text(
        "[r2]\n"
        "type = s3\n"
        "provider = Cloudflare\n"
        f"access_key_id = {access_key}\n"
        f"secret_access_key = {secret_key}\n"
        f"endpoint = {endpoint}\n"
        "no_check_bucket = true\n",
        encoding="utf-8",
    )


def rclone(args: Sequence[str], config_path: Path) -> None:
    """Run ``rclone`` with the given config and arguments, raising on
    failure."""
    cmd = ["rclone", f"--config={config_path}", *args]
    subprocess.run(cmd, check=True)


@contextlib.contextmanager
def rclone_config() -> Iterator[Path]:
    """Yield the path to a freshly-written, temporary rclone config."""
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "rclone.conf"
        write_rclone_config(config)
        yield config
