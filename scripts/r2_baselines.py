"""
Sync visual-regression baselines between local disk and R2.

Baselines are stored at ``r2:<bucket>/visual-baselines/<filename>.png``
and mirror the on-disk layout under ``tests/visual-baselines/``. The
local directory is gitignored — R2 is the source of truth.

Required environment variables (used to configure rclone):
    - ACCESS_KEY_ID_TURNTROUT_MEDIA
    - SECRET_ACCESS_TURNTROUT_MEDIA
    - S3_ENDPOINT_ID_TURNTROUT_MEDIA
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

R2_BUCKET = "turntrout"
R2_PREFIX = "visual-baselines"
LOCAL_DIR = Path("tests/visual-baselines")

# Wider retry window than rclone's defaults (3 retries, 0s sleep). CI runners
# occasionally hit transient DNS or network flaps reaching R2; with no sleep
# between retries, all 3 attempts can fail inside the same flap. 5 retries
# with 10s sleep gives ~50s of recovery time while still failing fast on a
# real outage.
RCLONE_RETRY_FLAGS = ("--retries=5", "--retries-sleep=10s")

REQUIRED_ENV = (
    "ACCESS_KEY_ID_TURNTROUT_MEDIA",
    "SECRET_ACCESS_TURNTROUT_MEDIA",
    "S3_ENDPOINT_ID_TURNTROUT_MEDIA",
)


def _check_env() -> None:
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


def _write_rclone_config(config_path: Path) -> None:
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


def _rclone(args: list[str], config_path: Path) -> None:
    cmd = ["rclone", f"--config={config_path}", *args]
    subprocess.run(cmd, check=True)


def _remote_path() -> str:
    return f"r2:{R2_BUCKET}/{R2_PREFIX}"


def download(local_dir: Path) -> None:
    """
    Mirror R2 baselines to the local directory.

    Uses ``rclone copy`` (not ``sync``) so locally-generated files (e.g. fresh
    screenshots a regen run is about to upload) aren't deleted.
    """
    local_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "rclone.conf"
        _write_rclone_config(config)
        _rclone(
            [
                "copy",
                _remote_path(),
                str(local_dir),
                "--include=*.png",
                "--checksum",
                "--transfers=16",
                "--checkers=16",
                *RCLONE_RETRY_FLAGS,
            ],
            config,
        )


def upload(local_dir: Path) -> None:
    """
    Mirror the local directory back to R2.

    Uses ``rclone copy`` (additive — never deletes) so a regen run that only
    produced baselines for one platform doesn't wipe the other platform's
    baselines in R2. Pruning orphans (e.g. baselines for deleted tests) is
    intentionally separate; do it with a one-shot ``rclone sync`` from a
    complete local mirror.
    """
    if not local_dir.is_dir():
        raise FileNotFoundError(f"Local dir not found: {local_dir}")
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "rclone.conf"
        _write_rclone_config(config)
        _rclone(
            [
                "copy",
                str(local_dir),
                _remote_path(),
                "--include=*.png",
                "--checksum",
                "--transfers=16",
                "--checkers=16",
                *RCLONE_RETRY_FLAGS,
            ],
            config,
        )


def main(argv: list[str] | None = None) -> int:
    """Sync visual-baselines between the local checkout and Cloudflare R2."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=("download", "upload"),
        help="download mirrors R2 -> local; upload mirrors local -> R2",
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=LOCAL_DIR,
        help=f"Local baseline directory (default: {LOCAL_DIR})",
    )
    args = parser.parse_args(argv)

    _check_env()

    if not shutil.which("rclone"):
        raise RuntimeError("rclone not found in PATH")

    if args.command == "download":
        download(args.dir)
    else:
        upload(args.dir)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
