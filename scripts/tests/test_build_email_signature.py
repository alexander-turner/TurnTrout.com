"""Tests for the email-signature page builder."""

import base64
import re
from pathlib import Path

import pytest
from fontTools.ttLib import TTFont  # type: ignore[import-untyped]

from .. import build_email_signature
from ..build_email_signature import (
    DARK_RULES,
    FONT_SPECS,
    OUTPUT_PATH,
    SCRIPT_PATH,
    TEMPLATE_PATH,
    FontSpec,
    build_font_faces,
    build_page,
    collect_font_text,
    render_dark_rules,
    render_font_face,
    subset_font,
)

_SERIF_SPEC = FONT_SPECS[0]
_MONO_SPEC = FONT_SPECS[1]


def test_repo_files_exist() -> None:
    for path in (TEMPLATE_PATH, SCRIPT_PATH, OUTPUT_PATH):
        assert path.is_file()
    for spec in FONT_SPECS:
        assert spec.source.is_file()


def test_collect_font_text_concatenates_per_key() -> None:
    html = (
        '<p data-tt-font="serif">Alex</p>'
        '<p data-tt-font="serif"> Turner</p>'
        '<span data-tt-font="mono">turntrout.com</span>'
    )
    assert collect_font_text(html) == {
        "serif": "Alex Turner",
        "mono": "turntrout.com",
    }


def test_collect_font_text_ignores_untagged_elements() -> None:
    assert collect_font_text("<p>plain</p>") == {}


@pytest.mark.parametrize(
    ("spec", "text"),
    [(_SERIF_SPEC, "Alex Turner"), (_MONO_SPEC, "turntrout.com")],
)
def test_subset_font_keeps_only_requested_characters(
    spec: FontSpec, text: str, tmp_path: Path
) -> None:
    payload = subset_font(spec, text)
    assert payload[:4] == b"wOF2"

    font = _load_woff2(payload, tmp_path)
    codepoints = set(font.getBestCmap())
    assert {ord(character) for character in text} <= codepoints
    assert ord("Z") not in codepoints
    # Subsets this small must stay inlinable as a data URL.
    assert len(payload) < 8192


def test_subset_font_pins_variable_axes(tmp_path: Path) -> None:
    """The mono face ships variable; the subset must be a static instance."""
    assert "fvar" not in _load_woff2(
        subset_font(_MONO_SPEC, "turntrout.com"), tmp_path
    )


def test_render_font_face_inlines_a_decodable_data_url() -> None:
    payload = b"not-really-a-font"
    rule = render_font_face(_SERIF_SPEC, payload)

    assert f"font-family: {_SERIF_SPEC.family};" in rule
    encoded = re.search(r'base64,([^"]+)"', rule)
    assert encoded is not None
    assert base64.b64decode(encoded.group(1)) == payload


def test_build_font_faces_emits_one_rule_per_spec() -> None:
    faces = build_font_faces(TEMPLATE_PATH.read_text(encoding="utf-8"))
    assert faces.count("@font-face") == len(FONT_SPECS)
    for spec in FONT_SPECS:
        assert f"font-family: {spec.family};" in faces


def test_build_font_faces_rejects_a_template_missing_a_face() -> None:
    with pytest.raises(ValueError, match="mono"):
        build_font_faces('<p data-tt-font="serif">Alex Turner</p>')


def test_render_dark_rules_scopes_with_prefix() -> None:
    unscoped = render_dark_rules()
    scoped = render_dark_rules(".card.dark ")

    assert len(unscoped.splitlines()) == len(DARK_RULES)
    for class_name, declarations in DARK_RULES:
        assert f".{class_name} {{ {declarations} }}" in unscoped
        assert f".card.dark .{class_name} {{ {declarations} }}" in scoped


def test_build_page_substitutes_every_placeholder() -> None:
    page = build_page(
        TEMPLATE_PATH.read_text(encoding="utf-8"), "const marker = 1"
    )

    assert "{{" not in page
    assert "data-tt-font" not in page
    assert "const marker = 1" in page
    assert "@media (prefers-color-scheme: dark)" in page
    assert page.count("@font-face") == len(FONT_SPECS)


def test_checked_in_output_matches_a_fresh_build() -> None:
    expected = build_page(
        TEMPLATE_PATH.read_text(encoding="utf-8"),
        SCRIPT_PATH.read_text(encoding="utf-8"),
    )
    assert OUTPUT_PATH.read_text(encoding="utf-8") == expected


def test_main_writes_the_page(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    destination = tmp_path / "signature.html"
    monkeypatch.setattr(build_email_signature, "OUTPUT_PATH", destination)

    build_email_signature.main()

    assert "@font-face" in destination.read_text(encoding="utf-8")


def _load_woff2(payload: bytes, tmp_path: Path) -> TTFont:
    """FontTools infers the WOFF2 flavor from the file extension, so round-
    trip."""
    path = tmp_path / "subset.woff2"
    path.write_bytes(payload)
    return TTFont(path)
