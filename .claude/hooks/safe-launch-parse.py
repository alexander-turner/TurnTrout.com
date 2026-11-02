"""
Extract tool_name and absolute target path from a PreToolUse payload.

Used by safe-launch.sh when the wrapped hook fails to parse, to decide
whether the in-flight tool call is a self-repair edit on a hook file.

Reads the PreToolUse JSON from stdin and prints two lines: tool_name,
then the absolute file path (or an empty line if none). safe-launch reads
those BY LINE, so a value holding a newline would split into fields of its
own: a Write to ".claude/hooks/x\\n/../../../target" would hand safe-launch
the hook-dir half as the path. Such a value, or one that is not a string,
prints nothing. On any parse failure, or if the parsed JSON is not an
object, it also prints nothing, so safe-launch falls through to the
fail-safe "ask" default.
"""

import json
import os
import sys


<<<<<<< local
def _extract_path(tool_input: dict, name: str) -> str:
    path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if path or name != "MultiEdit":
        return path
    # MultiEdit carries an array of edits; use the first entry's file_path.
    edits = tool_input.get("edits") or []
    if edits and isinstance(edits, list) and isinstance(edits[0], dict):
        return edits[0].get("file_path") or ""
    return ""
=======
def _string(value: object) -> str:
    return value if isinstance(value, str) else ""
>>>>>>> template


def main() -> int:
    if len(sys.argv) != 2:
        return 0
    project_dir = sys.argv[1]
    try:
<<<<<<< local
        data = json.load(sys.stdin)
    except ValueError:
        return 0
    name = data.get("tool_name", "") or ""
    tool_input = data.get("tool_input", {}) or {}
    path = _extract_path(tool_input, name)
=======
        data = json.loads(sys.stdin.read())
    except ValueError:
        return 0
    if not isinstance(data, dict):
        return 0
    name = _string(data.get("tool_name"))
    tool_input = data.get("tool_input")
    tool_input = tool_input if isinstance(tool_input, dict) else {}
    path = _string(tool_input.get("file_path") or tool_input.get("notebook_path"))
    # MultiEdit carries an array of edits; use the first entry's file_path.
    if not path and name == "MultiEdit":
        edits = tool_input.get("edits")
        if isinstance(edits, list) and edits and isinstance(edits[0], dict):
            path = _string(edits[0].get("file_path"))
>>>>>>> template
    if path and not os.path.isabs(path):
        path = os.path.join(project_dir, path)
    # This refusal is what stops a newline-split path from passing safe-launch's
    # containment check on its first half.
    if any(c in name or c in path for c in ("\n", "\r")):
        return 0
    print(name)
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
