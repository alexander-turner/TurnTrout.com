#!/usr/bin/env python3
"""Normalize SVG favicon viewBoxes to a standard square 24x24 format with
content filling the space."""

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as xml_etree

from defusedxml import ElementTree as ET

# Use xml.etree for Element creation and namespace registration
# while using defusedxml for parsing (security)
Element = xml_etree.Element


def check_inkscape() -> bool:
    """Check if Inkscape is available."""
    return shutil.which("inkscape") is not None


def is_already_normalized(svg_path: Path, target_size: int) -> bool:
    """Check if SVG is already normalized to target_size."""
    try:
        content = svg_path.read_text(encoding="utf-8")

        # Check for square viewBox matching target size
        if not re.search(
            rf'viewBox=["\']0\s+0\s+{target_size}\s+{target_size}["\']',
            content,
        ):
            return False

        # Check that root <svg> tag has no width/height attributes
        svg_tag_match = re.search(r"<svg[^>]*>", content, re.IGNORECASE)
        if svg_tag_match and re.search(
            r"\b(width|height)\s*=", svg_tag_match.group(0), re.IGNORECASE
        ):
            return False

        return True
    except (OSError, UnicodeDecodeError):
        return False


def fix_svg_viewbox(svg_path: Path, target_size: int) -> None:
    """Set viewBox to square target_size, scale content to fill, and remove
    width/height attributes."""
    xml_etree.register_namespace("", "http://www.w3.org/2000/svg")
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Get current viewBox to calculate scale
    viewbox = root.get("viewBox", "0 0 100 100")
    current_width = float(viewbox.split()[2])
    current_height = float(viewbox.split()[3])

    # Calculate scale to fill target size (scale to larger dimension)
    scale = target_size / max(current_width, current_height)

    # Calculate translation to center content in square viewBox
    scaled_width = current_width * scale
    scaled_height = current_height * scale
    translate_x = (target_size - scaled_width) / 2
    translate_y = (target_size - scaled_height) / 2

    # Wrap all children in a scaled and translated group
    children = list(root)
    if children:
        group = Element("g")
        group.set(
            "transform",
            f"translate({translate_x:.6f},{translate_y:.6f})"
            f"scale({scale:.6f})",
        )
        for child in children:
            root.remove(child)
            group.append(child)
        root.append(group)

    if "width" in root.attrib:
        del root.attrib["width"]
    if "height" in root.attrib:
        del root.attrib["height"]

    # Set square viewBox
    root.set("viewBox", f"0 0 {target_size} {target_size}")

    tree.write(svg_path, encoding="utf-8", xml_declaration=True)


def normalize_svg_viewbox(svg_path: Path, target_size: int = 24) -> None:
    """
    Normalize SVG to square target_size x target_size with content filling the
    viewBox.

    Args:
        svg_path: Path to SVG file to normalize
        target_size: Target viewBox dimension (default 24)
    """
    if not check_inkscape():
        raise RuntimeError(
            "Inkscape not found. Install with: brew install inkscape"
        )

    # Use Inkscape to crop to content bounds and export
    inkscape_path = shutil.which("inkscape")
    if not inkscape_path:
        raise RuntimeError("Inkscape executable not found in PATH")
    subprocess.run(
        [
            inkscape_path,
            str(svg_path),
            "--export-type=svg",
            "--export-plain-svg",
            f"--export-filename={svg_path}",
            "--export-area-drawing",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    # Fix viewBox to be square and strip width/height attributes
    fix_svg_viewbox(svg_path, target_size)

    print(f"✓ Normalized {svg_path.name}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Normalize SVG viewBoxes to square format for"
        "consistent CSS mask rendering."
    )
    parser.add_argument(
        "svg_files",
        nargs="+",
        type=Path,
        help="SVG files to normalize",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=24,
        help="Target viewBox size (default: 24)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without modifying files",
    )

    args = parser.parse_args()

    if not check_inkscape():
        print(
            "Error: Inkscape not found. Install with: brew install inkscape",
            file=sys.stderr,
        )
        return 1

    for svg_path in args.svg_files:
        if not svg_path.exists():
            print(f"Error: {svg_path} does not exist", file=sys.stderr)
            continue

        if not svg_path.suffix.lower() == ".svg":
            print(f"Warning: {svg_path} is not an SVG file, skipping")
            continue

        try:
            if is_already_normalized(svg_path, args.size):
                print(f"⊘ Already normalized: {svg_path.name}")
                continue

            if args.dry_run:
                print(f"Would normalize {svg_path.name}")
            else:
                normalize_svg_viewbox(svg_path, args.size)
        except RuntimeError as e:
            print(f"Error processing {svg_path}: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
