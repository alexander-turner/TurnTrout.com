"""Compute the size of AVIF files and their PNG equivalents."""

import argparse
import subprocess
from pathlib import Path

import pandas as pd
import tqdm

from .. import utils as script_utils


def get_file_size(path: Path) -> int:
    """Get file size in bytes."""
    return path.stat().st_size


def avif_to_png(avif_path: Path) -> Path | None:
    """Convert AVIF to PNG using ImageMagick."""
    png_path = avif_path.with_suffix(".png")
    magick_executable = script_utils.find_executable("magick")
    try:
        subprocess.run([magick_executable, avif_path, png_path], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error converting {avif_path} to PNG: {e}")
        return None
    return png_path


def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Analyze AVIF compression ratios"
    )
    parser.add_argument(
        "--avif_dir",
        type=Path,
        required=True,
        help="Directory containing AVIF files",
    )
    args = parser.parse_args()

    if not args.avif_dir.is_dir():
        raise NotADirectoryError(f"'{args.avif_dir}' is not a directory")

    # Initialize dataframe
    data = []

    # Process all AVIF files in specified directory
    avif_files = list(args.avif_dir.rglob("*.avif"))

    for avif_path in tqdm.tqdm(avif_files):
        avif_size = get_file_size(avif_path)

        # Convert to PNG and get size
        png_path = avif_to_png(avif_path)
        if png_path is None or not png_path.exists():
            print(f"Error converting {avif_path} to PNG")
            continue
        png_size = get_file_size(png_path)

        # Clean up PNG file
        png_path.unlink()

        # Add to data
        data.append(
            {
                "filename": avif_path.name,
                "avif_size": avif_size,
                "png_size": png_size,
                "compression_ratio": png_size / avif_size,
            }
        )

    # Create dataframe and save
    df = pd.DataFrame(data)
    # skipcq: BAN-B108
    df.to_csv("/tmp/avif_compression_stats.csv", index=False)

    # Print summary statistics
    print("\nSummary Statistics:")
    print(f"Average compression ratio: {df['compression_ratio'].mean():.2f}x")
    print(f"Median compression ratio: {df['compression_ratio'].median():.2f}x")
    print(f"Total AVIF size: {df['avif_size'].sum() / 1024:.2f} KB")
    print(f"Total PNG size: {df['png_size'].sum() / 1024:.2f} KB")


if __name__ == "__main__":
    main()
