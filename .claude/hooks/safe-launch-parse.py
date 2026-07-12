"""Extract tool_name and absolute target path from a PreToolUse payload.

Used by safe-launch.sh when the wrapped hook fails to parse, to decide
whether the in-flight tool call is a self-repair edit on a hook file.

Reads the PreToolUse JSON from stdin and prints two lines: tool_name,
then the absolute file path (or an empty line if none). On any parse
failure, exits 0 with empty output so safe-launch falls through to the
fail-safe "ask" default.
"""

import json
import os
import sys


def _extract_path(tool_input: dict, name: str) -> str:
    path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if path or name != "MultiEdit":
        return path
    # MultiEdit carries an array of edits; use the first entry's file_path.
    edits = tool_input.get("edits") or []
    if edits and isinstance(edits, list) and isinstance(edits[0], dict):
        return edits[0].get("file_path") or ""
    return ""


def main() -> int:
    if len(sys.argv) != 2:
        return 0
    project_dir = sys.argv[1]
    try:
        data = json.load(sys.stdin)
    except ValueError:
        return 0
    name = data.get("tool_name", "") or ""
    tool_input = data.get("tool_input", {}) or {}
    path = _extract_path(tool_input, name)
    if path and not os.path.isabs(path):
        path = os.path.join(project_dir, path)
    print(name)
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
