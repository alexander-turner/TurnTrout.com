"""
Tests for the per-section fixture generator.

The fixtures are not tracked in git (CI regenerates them from test-page.md via
the generate-fixtures job), so these tests cover the generator itself rather
than any committed output.
"""

from pathlib import Path

import pytest

from .. import split_test_page_sections
from ..split_test_page_sections import (
    SOURCE,
    build_fixtures,
    extract_footnote_defs,
    generate,
    referenced_footnotes,
    slugify,
)


def test_generate_writes_what_build_fixtures_returns(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``generate()`` writes exactly the files ``build_fixtures()`` returns."""
    monkeypatch.setattr(split_test_page_sections, "OUTPUT_DIR", tmp_path)
    written = generate()
    expected = build_fixtures(SOURCE.read_text(encoding="utf-8"))
    assert set(written) == set(expected)
    on_disk = {
        p.name: p.read_text(encoding="utf-8") for p in tmp_path.glob("*.md")
    }
    assert on_disk == expected


def test_generate_clears_stale_fixtures(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A regenerate removes stale fixtures while writing the current ones."""
    monkeypatch.setattr(split_test_page_sections, "OUTPUT_DIR", tmp_path)
    stale = tmp_path / "no-longer-a-section.md"
    stale.write_text("stale", encoding="utf-8")
    written = generate()
    assert not stale.exists()
    assert written
    assert {p.name for p in tmp_path.glob("*.md")} == set(written)


def test_footnote_defs_extracted_with_nested_refs() -> None:
    content = (
        "Ref.[^a]\n\n"
        "[^a]:\n    Body referencing [^b].\n\n"
        "[^b]: Nested.\n\n"
        "Tail paragraph.\n"
    )
    stripped, defs = extract_footnote_defs(content)
    assert "[^a]:" not in stripped and "[^b]: Nested." not in stripped
    assert "Tail paragraph." in stripped
    needed = referenced_footnotes("Ref.[^a]", defs)
    assert any("Nested." in block for block in needed), (
        "nested footnote must travel"
    )


def test_slugify_strips_markdown() -> None:
    assert slugify("Header 1 (`inline_code`)") == "header-1-inlinecode"
    assert slugify("What are your timelines?") == "what-are-your-timelines"


def test_fixtures_are_self_contained_for_footnotes() -> None:
    """No fixture may reference a footnote whose definition it lacks."""
    import re

    for filename, contents in build_fixtures(
        SOURCE.read_text(encoding="utf-8")
    ).items():
        defs = set(re.findall(r"^\[\^([^\]]+)\]:", contents, re.MULTILINE))
        refs = set(re.findall(r"\[\^([^\]]+)\](?!:)", contents)) - defs
        assert refs <= defs, (
            f"{filename} references undefined footnotes: {refs - defs}"
        )
