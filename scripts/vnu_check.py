"""
Validate the built site's HTML against the Nu HTML checker (vnu).

Runs the modern Nu validator (bundled by the ``vnu-jar`` npm package) over the
emitted ``public/`` tree and fails when any conformance error survives the
allowlist in ``config/vnu_allowlist.json``. The allowlist covers only KaTeX's
MathML/HTML output, which the validator rejects but which is inherent to
KaTeX's accessibility layer; every other invalid-HTML error is a real defect to
fix at the source.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import TypedDict

sys.path.append(str(Path(__file__).parent.parent))
# skipcq: FLK-E402
from scripts import utils as script_utils  # noqa: E402

_GIT_ROOT = script_utils.get_git_root()
_PUBLIC_DIR = _GIT_ROOT / "public"
_ALLOWLIST_PATH = _GIT_ROOT / "config" / "vnu_allowlist.json"

# Candidate locations of the runnable vnu fat jar shipped by the `vnu-jar`
# package. pnpm may expose it either through the top-level symlink or the
# content-addressed `.pnpm` store, so both are probed.
_JAR_CANDIDATES = (
    "node_modules/vnu-jar/build/dist/vnu.jar",
    "node_modules/.pnpm/vnu-jar@*/node_modules/vnu-jar/build/dist/vnu.jar",
)


class VnuMessage(TypedDict, total=False):
    """A single message object from vnu's JSON output."""

    type: str
    url: str
    message: str
    extract: str
    lastLine: int
    firstColumn: int


def resolve_vnu_jar(git_root: Path = _GIT_ROOT) -> Path:
    """
    Locate the runnable vnu jar, raising if it is not installed.

    Raises:
        FileNotFoundError: if no jar is found (``pnpm install`` has not run).
    """
    for candidate in _JAR_CANDIDATES:
        if "*" in candidate:
            matches = sorted(git_root.glob(candidate))
            if matches:
                return matches[0]
        else:
            path = git_root / candidate
            if path.is_file():
                return path
    raise FileNotFoundError(
        "vnu jar not found; run `pnpm install` to install the vnu-jar package."
    )


def load_allowlist(path: Path = _ALLOWLIST_PATH) -> list[re.Pattern[str]]:
    """Load and compile the allowlist regex patterns."""
    data = json.loads(path.read_text(encoding="utf-8"))
    return [re.compile(entry["pattern"]) for entry in data["allow"]]


def run_vnu(public_dir: Path, jar: Path) -> list[VnuMessage]:
    """
    Run vnu over ``public_dir`` and return its parsed error messages.

    vnu writes its JSON report to stderr. Java's ``JAVA_TOOL_OPTIONS`` banner
    (emitted by some sandboxes) is stripped by seeking to the first ``{``.
    """
    java = shutil.which("java")
    if java is None:
        raise FileNotFoundError(
            "java executable not found; the Nu validator requires a JRE."
        )
    result = subprocess.run(  # noqa: S603
        [
            java,
            "-jar",
            str(jar),
            "--format",
            "json",
            "--errors-only",
            "--skip-non-html",
            str(public_dir),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    payload = result.stderr
    brace = payload.find("{")
    if brace == -1:
        # No JSON at all: surface stderr so a launch failure is not silent.
        raise RuntimeError(f"vnu produced no JSON report. stderr:\n{payload}")
    return json.loads(payload[brace:]).get("messages", [])


def is_allowlisted(
    message: VnuMessage, patterns: list[re.Pattern[str]]
) -> bool:
    """Whether a vnu message matches any allowlist pattern."""
    text = message.get("message", "")
    return any(pattern.search(text) for pattern in patterns)


def filter_messages(
    messages: list[VnuMessage], patterns: list[re.Pattern[str]]
) -> list[VnuMessage]:
    """Drop allowlisted messages, keeping only real conformance errors."""
    return [
        message
        for message in messages
        if message.get("type") == "error"
        and not is_allowlisted(message, patterns)
    ]


def format_message(message: VnuMessage) -> str:
    """Render a single vnu message as a one-line, file-relative string."""
    url = message.get("url", "")
    name = url.rsplit("/", 1)[-1] if url else "?"
    line = message.get("lastLine", "?")
    extract = (message.get("extract") or "").strip()
    return f"  [{name}:{line}] {message.get('message', '')}\n      {extract}"


def check(public_dir: Path = _PUBLIC_DIR) -> list[VnuMessage]:
    """
    Validate ``public_dir`` and return the non-allowlisted error messages.

    An empty list means the built site is HTML-conformant modulo KaTeX.
    """
    jar = resolve_vnu_jar()
    patterns = load_allowlist()
    messages = run_vnu(public_dir, jar)
    return filter_messages(messages, patterns)


def main() -> None:
    """CLI entry point: exit non-zero when real conformance errors remain."""
    parser = argparse.ArgumentParser(
        description="Validate built HTML with the Nu validator (vnu)."
    )
    parser.add_argument(
        "--public-dir",
        type=Path,
        default=_PUBLIC_DIR,
        help="Directory of built HTML to validate (default: public/).",
    )
    args = parser.parse_args()

    remaining = check(args.public_dir)
    if remaining:
        print(
            f"Nu HTML validator found {len(remaining)} conformance "
            f"error(s) not covered by config/vnu_allowlist.json:\n"
        )
        for message in remaining:
            print(format_message(message))
        raise SystemExit(1)
    print(
        "Nu HTML validator: no conformance errors (KaTeX MathML allowlisted)."
    )


if __name__ == "__main__":
    main()
