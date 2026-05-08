"""
Claude-assisted triage for unresolved rendered-text spellcheck warnings.

Why this exists: the possessive auto-expansion in
``scripts/augment_spellcheck_wordlist.sh`` covers the ``KaTeX`` →
``KaTeX's`` failure class, but new proper nouns still need to land in
``config/spellcheck/.wordlist.txt`` by hand. This script asks Claude
to classify remaining unknowns as "obviously legitimate" (auto-added)
or "needs human judgment" (printed with source context for review).

Usage::

    uv run python scripts/spellcheck_triage.py --public public/

Requires ``ANTHROPIC_API_KEY``. Uses Claude Haiku 4.5 for short
classification calls.
"""

# pylint: disable=protected-access

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from scripts import built_site_checks

_MODEL = "claude-haiku-4-5-20251001"
_MAX_TOKENS = 2048
_SYSTEM_PROMPT = """\
Triage unknown words from a custom-dictionary spellchecker on a \
personal blog about AI alignment, math, and programming. The blog \
uses American English exclusively — British spellings (e.g. \
"colour", "organise", "behaviour") are typos, not valid words.

For each word return one of:
  - "add": Obviously a legitimate proper noun, established technical \
term, common acronym, or well-known product/paper name with American \
spelling. Zero doubt. Examples: "OpenAI", "KaTeX", "arXiv", "PyTorch".
  - "defer": Possible typos (including British spellings), invented \
words, rare names, ambiguous strings. Default to "defer" when uncertain.

Return ONLY valid JSON, no prose, no markdown fences:

  {"decisions": [{"word": "...", "action": "add"|"defer", \
"reason": "brief rationale"}, ...]}
"""

_WARNING_RE = re.compile(
    r"\[(?P<source>[^\]]+)\].*?warning\s+`(?P<word>[^`]+)`"
)
_CONTEXT_MAX = 400


@dataclass(frozen=True)
class UnknownWord:
    """A word flagged by spellcheck plus its source file and context."""

    word: str
    source: str
    context: str


@dataclass(frozen=True)
class Decision:
    """Model's classification of a single unknown word."""

    word: str
    action: str  # "add" | "defer"
    reason: str


def _context_for(paragraphs: list[str], word: str) -> str:
    for para in paragraphs:
        if word in para:
            text = para.strip()
            return (
                text if len(text) <= _CONTEXT_MAX else text[:_CONTEXT_MAX] + "…"
            )
    return ""


def collect_unknown_words(public_dir: Path) -> list[UnknownWord]:
    """Run the rendered-text spellcheck and parse unknown-word warnings."""
    paragraph_map: dict[str, list[str]] = {}
    for file_path in public_dir.rglob("*.html"):
        built_site_checks._collect_paragraphs_for_spellcheck(
            file_path.name, file_path, public_dir, paragraph_map
        )
    issues = built_site_checks._spellcheck_flattened_paragraphs(paragraph_map)

    out: dict[tuple[str, str], UnknownWord] = {}
    for issue in issues:
        m = _WARNING_RE.search(issue)
        if not m:
            continue
        key = (m["word"], m["source"])
        if key in out:
            continue
        out[key] = UnknownWord(
            word=m["word"],
            source=m["source"],
            context=_context_for(paragraph_map.get(m["source"], []), m["word"]),
        )
    return list(out.values())


def _parse_decisions(text: str) -> list[Decision]:
    """Extract decisions from the model's JSON response."""
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError(f"No JSON object in model response: {text!r}")
    data = json.loads(match.group(0))
    return [
        Decision(
            word=item["word"],
            action=item["action"],
            reason=item.get("reason", ""),
        )
        for item in data.get("decisions", [])
        if item.get("action") in ("add", "defer")
    ]


def classify(
    unknowns: list[UnknownWord], *, client: object | None = None
) -> list[Decision]:
    """Ask Claude to classify each unknown word; returns a decision list."""
    if not unknowns:
        return []
    if client is None:
        import anthropic  # pylint: disable=import-outside-toplevel

        client = anthropic.Anthropic()

    payload = json.dumps({"words": [u.__dict__ for u in unknowns]})
    response = client.messages.create(  # type: ignore[attr-defined]
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": payload}],
    )
    text = "".join(
        b.text for b in response.content if getattr(b, "type", None) == "text"
    )
    return _parse_decisions(text)


def apply_additions(
    decisions: list[Decision], wordlist_path: Path
) -> list[str]:
    """Insert ``add`` decisions into the wordlist; return the words added."""
    existing = set(wordlist_path.read_text(encoding="utf-8").splitlines())
    new = {d.word for d in decisions if d.action == "add"} - existing
    if not new:
        return []
    merged = sorted(existing | new, key=lambda w: (w.lower(), w))
    wordlist_path.write_text("\n".join(merged) + "\n", encoding="utf-8")
    return sorted(new)


def _format_deferrals(
    decisions: list[Decision], lookup: dict[str, UnknownWord]
) -> str:
    """Pretty-print deferred decisions with source context for human review."""
    rows = []
    for d in decisions:
        if d.action != "defer":
            continue
        u = lookup.get(d.word)
        rows.append(
            f"- {d.word}  ({u.source if u else '?'})\n"
            f"    reason: {d.reason}\n"
            f"    context: {u.context if u else ''}"
        )
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point; see module docstring for usage."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", type=Path, default=Path("public"))
    parser.add_argument(
        "--wordlist",
        type=Path,
        default=Path("config/spellcheck/.wordlist.txt"),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print decisions without modifying the wordlist",
    )
    args = parser.parse_args(argv)

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "ANTHROPIC_API_KEY not set — skipping Claude triage.",
            file=sys.stderr,
        )
        return 1

    unknowns = collect_unknown_words(args.public)
    if not unknowns:
        print("No unknown words flagged — nothing to triage.")
        return 0

    decisions = classify(unknowns)
    if args.dry_run:
        print(json.dumps([d.__dict__ for d in decisions], indent=2))
        return 0

    added = apply_additions(decisions, args.wordlist)
    if added:
        print(f"Added {len(added)} word(s) to {args.wordlist}:")
        for w in added:
            print(f"  + {w}")
    else:
        print("No words auto-added.")

    deferred = _format_deferrals(decisions, {u.word: u for u in unknowns})
    if deferred:
        print("\nDeferred to your judgment:")
        print(deferred)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
