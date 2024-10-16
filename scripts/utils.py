import git
from pathlib import Path
import subprocess
from typing import Optional, Collection

# pyright: reportPrivateImportUsage = false


def get_git_root() -> Path | None:
    """Returns the absolute path to the top-level directory of the Git repository."""
    completed_process = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    return (
        Path(completed_process.stdout.strip())
        if completed_process.returncode == 0
        else None
    )


def get_files(
    dir_to_search: Optional[Path] = None,
    filetypes_to_match: Collection[str] = (".md",),
    use_git_ignore: bool = True,
) -> tuple[Path, ...]:
    """Returns a tuple of all files in the content directory of the Git
    repository.

    Args:
        replacement_dir (Path): A directory to search for files.
        filetypes_to_match (Collection[str]): A collection of file types to
            search for.

    Returns:
        tuple[Path, ...]: A tuple of all matching files in the content directory of the
            Git repository. Filters out ignored files if a Git repository is found.
    """
    files: list[Path] = []
    if dir_to_search is not None:
        for filetype in filetypes_to_match:
            files.extend(dir_to_search.rglob(f"*{filetype}"))
        if use_git_ignore:
            try:
                root = get_git_root()
                repo = git.Repo(root)
                files = list(filter(lambda file: not file in repo.ignored(file), files))
            except git.GitCommandError:
                pass  # Ignore errors
    return tuple(files)


def path_relative_to_quartz(input_file: Path) -> Path:
    try:
        # Find the 'quartz' directory in the path
        quartz_dir = next(
            parent for parent in input_file.parents if parent.name == "quartz"
        )
        # Check if the path is within the 'static' subdirectory
        if not any(
            parent.name == "static"
            for parent in input_file.parents
            if parent != quartz_dir
        ):
            raise ValueError(
                "The path must be within the 'static' subdirectory of 'quartz'."
            )
        # Get the path relative to quartz
        return input_file.relative_to(quartz_dir.parent)
    except StopIteration:
        raise ValueError("The path must be within a 'quartz' directory.")
