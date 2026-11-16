#!/usr/bin/env python3
"""
Refuse a sync whose caller still sets its path lists in `env:`.

The reusable sync reads `exclude-paths` and `opt-in-paths` from its inputs. A
caller's own `env:` never reaches a called workflow, so an `EXCLUDE_PATHS` line
a consumer kept from the pre-reusable caller is read by nothing: every path it
froze is synced over again, with no error anywhere. This check turns that into
a red run that names the entries to move under `with:`.

Usage: template-sync-stale-env.py <the caller's template-sync.yaml>
"""

import sys
from pathlib import Path

import yaml

MOVED = {"EXCLUDE_PATHS": "exclude-paths", "OPT_IN_PATHS": "opt-in-paths"}


def stale_entries(caller: Path) -> dict[str, str]:
    """The caller's `env:` keys the reusable workflow never reads, with their
    values."""
    # A caller under another name carries no pre-reusable env block to strand.
    if not caller.is_file():
        return {}
    env = (yaml.safe_load(caller.read_text(encoding="utf-8")) or {}).get("env") or {}
    return {key: str(env[key]) for key in MOVED if key in env}


def main() -> None:
    caller = Path(sys.argv[1])
    stale = stale_entries(caller)
    for key, value in stale.items():
        print(
            f"::error file={caller}::{caller} sets env.{key}, which the reusable sync "
            f"never reads. Move it under the sync job's `with:` as "
            f'`{MOVED[key]}: "{value}"` and delete the env line.'
        )
    if stale:
        sys.exit(1)


if __name__ == "__main__":
    main()
