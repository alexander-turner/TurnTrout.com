"""
Generate per-section visual-regression fixtures from ``test-page.md``.

The monolithic test page is the single human-edited source of truth. This
script slices it on top-level (``# ``) headings and writes one fixture page per
section under ``website_content/fixtures/test-sections/``. Each section becomes
its own page so a Playwright screenshot of one section is unaffected by edits to
any other section (and by section reordering, since fixture names derive from the
heading slug, not position).

Run via ``uv run python scripts/split_test_page_sections.py``. The visual test
suite re-runs this and asserts the output matches what is committed, so the
fixtures can never drift from ``test-page.md``.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "website_content" / "test-page.md"
OUTPUT_DIR = REPO_ROOT / "website_content" / "fixtures" / "test-sections"

# Sections whose markdown references other sections (self-transclusion,
# cross-section footnotes) and therefore cannot render standalone. They stay on
# the integration page (test-page.md) only.
SKIP_HEADINGS: frozenset[str] = frozenset({"Transclusion"})

H1_PATTERN = re.compile(r"^# (?!#)(.*)$", re.MULTILINE)
FOOTNOTE_DEF_PATTERN = re.compile(r"^\[\^([^\]]+)\]:")
FOOTNOTE_REF_PATTERN = re.compile(r"\[\^([^\]]+)\]")


def _is_continuation(line: str) -> bool:
    """A blank line or a 4-space/tab-indented line continues a footnote def."""
    return (
        line.strip() == "" or line.startswith("    ") or line.startswith("\t")
    )


def extract_footnote_defs(content: str) -> tuple[str, dict[str, str]]:
    """
    Strip footnote definitions from ``content``, returning (stripped, defs).

    A definition spans its ``[^label]:`` line plus following indented/blank lines
    up to the next non-indented line. Trailing blank lines are not absorbed.
    """
    lines = content.split("\n")
    kept: list[str] = []
    defs: dict[str, str] = {}
    index = 0
    while index < len(lines):
        match = FOOTNOTE_DEF_PATTERN.match(lines[index])
        if not match:
            kept.append(lines[index])
            index += 1
            continue
        start = index
        cursor = index + 1
        last_content = index
        while cursor < len(lines) and _is_continuation(lines[cursor]):
            if lines[cursor].strip() != "":
                last_content = cursor
            cursor += 1
        defs[match.group(1)] = "\n".join(
            lines[start : last_content + 1]
        ).rstrip()
        index = cursor
    return "\n".join(kept), defs


def referenced_footnotes(section: str, defs: dict[str, str]) -> list[str]:
    """Return the def blocks ``section`` references, including nested refs."""
    needed: list[str] = []
    seen: set[str] = set()
    queue = [
        label
        for label in FOOTNOTE_REF_PATTERN.findall(section)
        if label in defs
    ]
    while queue:
        label = queue.pop(0)
        if label in seen:
            continue
        seen.add(label)
        block = defs[label]
        needed.append(block)
        queue.extend(
            ref for ref in FOOTNOTE_REF_PATTERN.findall(block) if ref in defs
        )
    return needed


def slugify(heading: str) -> str:
    """Reduce a heading to a stable URL slug (drop markdown, keep word
    chars)."""
    text = re.sub(r"`([^`]*)`", r"\1", heading)  # inline code
    text = re.sub(r"[*_]", "", text)  # emphasis markers
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def split_sections(body: str) -> list[tuple[str, str]]:
    """Return ``(heading, section_markdown)`` pairs for each top-level
    heading."""
    matches = list(H1_PATTERN.finditer(body))
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = (
            matches[index + 1].start()
            if index + 1 < len(matches)
            else len(body)
        )
        sections.append((match.group(1).strip(), body[start:end].strip()))
    return sections


def fixture_frontmatter(heading: str, slug: str) -> str:
    """Return the YAML frontmatter block for a section fixture page."""
    return (
        "---\n"
        f'title: "Test section: {heading}"\n'
        f"permalink: test-section-{slug}\n"
        'no_dropcap: "true"\n'
        "avoidIndexing: true\n"
        "tags:\n  - website\n"
        f"description: Auto-generated isolated section fixture ({heading}) for "
        "per-section visual regression testing. Edit website_content/test-page.md "
        "and regenerate; do not edit by hand.\n"
        "hideSubscriptionLinks: true\n"
        "date_published: 2024-12-04\n"
        "date_updated: 2024-12-04\n"
        "---\n"
    )


def build_fixtures(source_markdown: str) -> dict[str, str]:
    """
    Return ``{filename: file_contents}`` for every section fixture.

    Pure function (no filesystem writes) so the drift test can compare against
    the committed fixtures.
    """
    _, _, after_frontmatter = source_markdown.partition("---\n")
    _, _, content = after_frontmatter.partition("\n---\n")
    content, footnote_defs = extract_footnote_defs(content)

    fixtures: dict[str, str] = {}
    for heading, section in split_sections(content):
        if heading in SKIP_HEADINGS:
            continue
        slug = slugify(heading)
        needed_defs = referenced_footnotes(section, footnote_defs)
        if needed_defs:
            section = f"{section}\n\n" + "\n\n".join(needed_defs)
        fixtures[f"{slug}.md"] = (
            f"{fixture_frontmatter(heading, slug)}\n{section}\n"
        )
    return fixtures


def generate() -> list[str]:
    """Write all section fixtures to OUTPUT_DIR, replacing any stale ones."""
    fixtures = build_fixtures(SOURCE.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUTPUT_DIR.glob("*.md"):
        stale.unlink()
    for filename, contents in fixtures.items():
        (OUTPUT_DIR / filename).write_text(contents, encoding="utf-8")
    return list(fixtures)


if __name__ == "__main__":
    names = generate()
    print(
        f"Wrote {len(names)} section fixtures to {OUTPUT_DIR.relative_to(REPO_ROOT)}"
    )
    for name in names:
        print(f"  {name}")
