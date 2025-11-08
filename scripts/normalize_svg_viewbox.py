#!/usr/bin/env python3
"""
Normalize SVG favicon viewBoxes to a standard square 24x24 format.

This script processes SVG files to ensure consistent rendering when used as CSS masks.
It transforms the viewBox to "0 0 24 24" while preserving the visual content by:
1. Calculating the current viewBox dimensions
2. Scaling and centering the content to fit the new square viewBox
3. Preserving aspect ratio by adding padding to the shorter dimension
"""

import argparse
import sys
from pathlib import Path
from typing import Tuple
from xml.etree import ElementTree as ET


def parse_viewbox(viewbox_str: str) -> Tuple[float, float, float, float]:
    """Parse viewBox string into (min_x, min_y, width, height)."""
    parts = viewbox_str.strip().split()
    if len(parts) != 4:
        raise ValueError(f"Invalid viewBox format: {viewbox_str}")
    return tuple(float(p) for p in parts)  # type: ignore


def normalize_svg_viewbox(svg_path: Path, target_size: int = 24) -> None:
    """
    Normalize SVG viewBox to square target_size x target_size.

    Args:
        svg_path: Path to SVG file to normalize
        target_size: Target viewBox dimension (default 24)
    """
    # Register SVG namespace to avoid ns0: prefixes
    ET.register_namespace("", "http://www.w3.org/2000/svg")

    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Get current viewBox
    viewbox_str = root.get("viewBox")
    if not viewbox_str:
        print(f"Warning: {svg_path.name} has no viewBox attribute, skipping")
        return

    min_x, min_y, width, height = parse_viewbox(viewbox_str)

    # If already normalized, skip
    if (min_x, min_y, width, height) == (0, 0, target_size, target_size):
        print(f"✓ {svg_path.name} already normalized")
        return

    # Calculate scale factor (use smaller dimension to ensure content fits)
    max_dimension = max(width, height)
    scale = target_size / max_dimension

    # Calculate translation to center content in new viewBox
    scaled_width = width * scale
    scaled_height = height * scale
    translate_x = (target_size - scaled_width) / 2 - (min_x * scale)
    translate_y = (target_size - scaled_height) / 2 - (min_y * scale)

    # Wrap all existing content in a group with transform
    # Create new group element
    group = ET.Element("g")
    group.set(
        "transform",
        f"translate({translate_x:.3f},{translate_y:.3f}) scale({scale:.6f})",
    )

    # Move all children to the group
    children = list(root)
    for child in children:
        root.remove(child)
        group.append(child)

    root.append(group)

    root.set("viewBox", f"0 0 {target_size} {target_size}")

    # Remove width/height attributes to make it fully scalable
    if "width" in root.attrib:
        del root.attrib["width"]
    if "height" in root.attrib:
        del root.attrib["height"]

    # Write back
    tree.write(svg_path, encoding="utf-8", xml_declaration=True)
    print(
        f"✓ Normalized {svg_path.name}: {width:.1f}x{height:.1f} → {target_size}x{target_size}"
    )


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Normalize SVG viewBoxes to square format for consistent CSS mask rendering"
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

    for svg_path in args.svg_files:
        if not svg_path.exists():
            print(f"Error: {svg_path} does not exist", file=sys.stderr)
            continue

        if not svg_path.suffix.lower() == ".svg":
            print(f"Warning: {svg_path} is not an SVG file, skipping")
            continue

        try:
            if args.dry_run:
                tree = ET.parse(svg_path)
                root = tree.getroot()
                viewbox = root.get("viewBox", "none")
                print(f"Would normalize {svg_path.name}: viewBox={viewbox}")
            else:
                normalize_svg_viewbox(svg_path, args.size)
        except (ET.ParseError, ValueError, OSError) as e:
            print(f"Error processing {svg_path}: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
