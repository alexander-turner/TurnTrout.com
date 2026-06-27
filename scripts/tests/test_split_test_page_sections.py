"""Guards that committed section fixtures stay in sync with test-page.md."""

from ..split_test_page_sections import (
    OUTPUT_DIR,
    SOURCE,
    build_fixtures,
    extract_footnote_defs,
    referenced_footnotes,
    slugify,
)


def test_committed_fixtures_match_generator() -> None:
    """Re-running the generator must reproduce the committed fixtures
    exactly."""
    expected = build_fixtures(SOURCE.read_text(encoding="utf-8"))
    committed = {
        p.name: p.read_text(encoding="utf-8") for p in OUTPUT_DIR.glob("*.md")
    }
    assert committed == expected, (
        "Section fixtures are stale. Run "
        "`uv run python scripts/split_test_page_sections.py` and commit the result."
    )


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
