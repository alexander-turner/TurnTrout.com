"""
Compute the size of WEBM files and their MP4 equivalents.
"""

import argparse
import tempfile
from pathlib import Path

import pandas as pd
import tqdm


def get_file_size(path: Path) -> int | None:
    """
    Get file size in bytes. Returns None if file does not exist.
    """
    if not path.exists():
        return None
    return path.stat().st_size


def main() -> None:  # noqa: PY-R1000
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Analyze video compression ratios"
    )
    parser.add_argument(
        "--video_dir",
        type=Path,
        required=True,
        help="Directory containing video files (WEBM and MP4)",
    )
    args = parser.parse_args()

    if not args.video_dir.is_dir():
        raise NotADirectoryError(f"'{args.video_dir}' is not a directory")

    # Initialize dataframe
    data = []
    video_files: dict[str, dict[str, Path]] = {}

    # Find all video files and group by base name
    print("Scanning for video files...")
    for video_path in tqdm.tqdm(list(args.video_dir.rglob("*.*"))):
        if video_path.suffix.lower() in [".webm", ".mp4"]:
            base_name = video_path.stem
            extension = video_path.suffix.lower()[1:]  # Remove dot
            if base_name not in video_files:
                video_files[base_name] = {}
            video_files[base_name][extension] = video_path

    print(f"Found {len(video_files)} unique video base names.")

    # Process grouped video files
    print("Calculating file sizes...")
    for base_name, paths in tqdm.tqdm(video_files.items()):
        webm_path = paths.get("webm")
        mp4_path = paths.get("mp4")

        webm_size = get_file_size(webm_path) if webm_path else None
        mp4_size = get_file_size(mp4_path) if mp4_path else None

        if webm_size is None and mp4_size is None:
            print(f"Warning: No files found for base name {base_name}")
            continue
        elif webm_size is None:
            print(f"Warning: WEBM file missing for {base_name}")
        elif mp4_size is None:
            print(f"Warning: MP4 file missing for {base_name}")

        # Calculate ratio only if both sizes are available
        ratio = None
        if webm_size is not None and mp4_size is not None and webm_size > 0:
            ratio = mp4_size / webm_size

        # Add to data
        data.append(
            {
                "filename_base": base_name,
                "webm_size": webm_size,
                "mp4_size": mp4_size,
                "mp4_to_webm_ratio": ratio,
            }
        )

    if not data:
        print("No video pairs found to analyze.")
        return

    # Create dataframe and save
    df = pd.DataFrame(data)
    output_path = Path(tempfile.gettempdir()) / "video_compression_stats.csv"
    df.to_csv(output_path, index=False)
    print(f"Results saved to {output_path}")

    # Calculate and print summary statistics
    df_complete = df.dropna(subset=["mp4_to_webm_ratio"])

    print("Summary Statistics (where both WEBM and MP4 exist):")
    if not df_complete.empty:
        print(
            f"Average MP4/WEBM ratio: {df_complete['mp4_to_webm_ratio'].mean():.2f}x"
        )
        print(
            f"Median MP4/WEBM ratio: {df_complete['mp4_to_webm_ratio'].median():.2f}x"
        )
    else:
        print("No pairs with both WEBM and MP4 found for ratio calculation.")

    print("Total Sizes (all found files):")
    print(f"Total WEBM size: {df['webm_size'].sum() / (1024*1024):.2f} MB")
    print(f"Total MP4 size: {df['mp4_size'].sum() / (1024*1024):.2f} MB")


if __name__ == "__main__":
    main()
