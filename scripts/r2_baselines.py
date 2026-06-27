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
import shutil
import sys
import tempfile
from pathlib import Path

try:
    from . import r2_sync
    from . import utils as script_utils
except ImportError:
    import r2_sync
    import utils as script_utils

R2_PREFIX = "visual-baselines"
LOCAL_DIR = Path("tests/visual-baselines")


def _write_rclone_config(config_path: Path) -> None:
    """Thin alias for the shared rclone-config writer (see ``r2_sync``)."""
    r2_sync.write_rclone_config(config_path)


def _rclone(args: list[str], config_path: Path) -> None:
    r2_sync.rclone(args, config_path)


def _remote_path() -> str:
    return f"r2:{r2_sync.R2_BUCKET}/{R2_PREFIX}"


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

    script_utils.check_r2_env()

    if not shutil.which("rclone"):
        raise RuntimeError("rclone not found in PATH")

    if args.command == "download":
        download(args.dir)
    else:
        upload(args.dir)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
