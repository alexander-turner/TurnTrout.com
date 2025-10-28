"""Utility functions for scripts/ directory."""

import shutil
import subprocess
from pathlib import Path
from typing import Collection, Dict, Optional, Set

import git
from bs4 import BeautifulSoup, NavigableString, Tag
from ruamel.yaml import YAML, YAMLError

_executable_cache: Dict[str, str] = {}


def find_executable(name: str) -> str:
    """
    Find and cache the absolute path of an executable.

    Args:
        name: The name of the executable to find.

    Returns:
        The absolute path to the executable.

    Raises:
        FileNotFoundError: If the executable cannot be found.
    """
    if name in _executable_cache:
        return _executable_cache[name]

    executable_path = shutil.which(name)
    if not executable_path:
        raise FileNotFoundError(
            f"Executable '{name}' not found. Please ensure it is in your PATH."
        )

    _executable_cache[name] = executable_path
    return executable_path


def get_git_root(starting_dir: Optional[Path] = None) -> Path:
    """
    Returns the absolute path to the top-level directory of the Git repository.

    Args:
        starting_dir: Directory from which to start searching for the Git root.

    Returns:
        Path: Absolute path to the Git repository root.

    Raises:
        RuntimeError: If Git root cannot be determined.
    """
    git_executable = find_executable("git")
    completed_process = subprocess.run(
        [git_executable, "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
        cwd=starting_dir if starting_dir else Path.cwd(),
    )
    if completed_process.returncode == 0:
        return Path(completed_process.stdout.strip())
    raise RuntimeError("Failed to get Git root")


def get_files(
    dir_to_search: Optional[Path] = None,
    filetypes_to_match: Collection[str] = (".md",),
    use_git_ignore: bool = True,
    ignore_dirs: Optional[Collection[str]] = None,
) -> tuple[Path, ...]:
    """
    Returns a tuple of all files in the specified directory of the Git
    repository.

    Args:
        dir_to_search: A directory to search for files.
        filetypes_to_match: A collection of file types to search for.
        use_git_ignore: Whether to exclude files based on .gitignore.
        ignore_dirs: Directory names to ignore.

    Returns:
        tuple[Path, ...]: A tuple of all matching files.
    """
    files: list[Path] = []
    if dir_to_search is not None:
        for filetype in filetypes_to_match:
            files.extend(dir_to_search.rglob(f"*{filetype}"))

        # Filter out ignored directories
        if ignore_dirs:
            files = [
                f
                for f in files
                if not any(ignore_dir in f.parts for ignore_dir in ignore_dirs)
            ]

        if use_git_ignore:
            try:
                root = get_git_root(starting_dir=dir_to_search)
                repo = git.Repo(root)
                # Convert file paths to paths relative to the git root
                relative_files = [file.relative_to(root) for file in files]
                # Filter out ignored files
                files = [
                    file
                    for file, rel_file in zip(files, relative_files)
                    if not repo.ignored(rel_file)
                ]
            except (
                git.GitCommandError,
                ValueError,
                RuntimeError,
                subprocess.CalledProcessError,
            ):
                # If Git operations fail, continue without Git filtering
                pass
    return tuple(files)


def path_relative_to_quartz_parent(input_file: Path) -> Path:
    """Get the path relative to the parent 'quartz' directory."""
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
        return input_file.relative_to(quartz_dir.parent)
    except StopIteration as e:
        raise ValueError(
            "The path must be within a 'quartz' directory."
        ) from e


def split_yaml(file_path: Path, verbose: bool = False) -> tuple[dict, str]:
    """
    Split a markdown file into its YAML frontmatter and content.

    Args:
        file_path: Path to the markdown file
        verbose: Whether to print error messages

    Returns:
        Tuple of (metadata dict, content string)
    """
    yaml = YAML(
        typ="rt"
    )  # 'rt' means round-trip, preserving comments and formatting
    yaml.preserve_quotes = True  # Preserve quote style

    with file_path.open("r", encoding="utf-8") as f:
        content = f.read()

    # Split frontmatter and content
    parts = content.split("---", 2)
    if len(parts) < 3:
        if verbose:
            print(f"Skipping {file_path}: No valid frontmatter found")
        return {}, ""

    try:
        metadata = yaml.load(parts[1])
        if not metadata:
            metadata = {}
    except YAMLError as e:
        print(f"Error parsing YAML in {file_path}: {str(e)}")
        return {}, ""

    return metadata, parts[2]


def build_html_to_md_map(md_dir: Path) -> Dict[str, Path]:
    """
    Build a mapping of permalinks to markdown file paths by extracting and
    parsing the YAML front matter of each markdown file.

    Args:
        md_dir: Path to the directory containing markdown files

    Returns:
        Dictionary mapping permalinks to their corresponding markdown file paths
    """
    html_to_md_path: Dict[str, Path] = {}

    md_files = list(md_dir.glob("*.md")) + list(md_dir.glob("drafts/*.md"))

    for md_file in md_files:
        front_matter, _ = split_yaml(md_file, verbose=False)
        permalink = front_matter.get("permalink")
        if permalink:
            permalink = permalink.strip("/")
            html_to_md_path[permalink] = md_file

    return html_to_md_path


def collect_aliases(md_dir: Path) -> Set[str]:
    """Collect all aliases from the markdown files."""
    aliases: Set[str] = set()
    for md_file in get_files(
        md_dir, filetypes_to_match=(".md",), use_git_ignore=True
    ):
        front_matter, _ = split_yaml(md_file, verbose=True)
        if front_matter:
            aliases_list = front_matter.get("aliases", [])
            if isinstance(aliases_list, list):
                aliases.update(str(alias) for alias in aliases_list)

            # The permalink is not an "alias"
            permalink = front_matter.get("permalink")
            if permalink and permalink in aliases:
                aliases.remove(permalink)
    return aliases


def is_redirect(soup: BeautifulSoup) -> bool:
    """Check if the page is a redirect by looking for a meta refresh tag."""
    meta = soup.find(
        "meta",
        attrs={
            "http-equiv": lambda x: x is not None and x.lower() == "refresh",
            "content": lambda x: x is not None and "url=" in x.lower(),
        },
    )
    return meta is not None


def body_is_empty(soup: BeautifulSoup) -> bool:
    """
    Check if the body is empty.

    Looks for children of the body tag.
    """
    body = soup.find("body")
    return (
        not body
        or not isinstance(body, Tag)
        or len(body.find_all(recursive=False)) == 0
    )


def parse_html_file(file_path: Path) -> BeautifulSoup:
    """Parse an HTML file and return a BeautifulSoup object."""
    if not file_path.resolve().is_relative_to(get_git_root() / "public"):
        raise ValueError(
            f"File path {file_path} is not in the public directory."
        )
    with open(file_path, encoding="utf-8") as file:
        return BeautifulSoup(file.read(), "html.parser")


_SLUGS_WITHOUT_MD_PATH = ("404", "all-tags", "recent", "all-posts")


def should_have_md(file_path: Path) -> bool:
    """Whether there should be a markdown file for this html file."""
    return (
        "tags" not in file_path.parts
        and file_path.stem not in _SLUGS_WITHOUT_MD_PATH
        and not is_redirect(parse_html_file(file_path))
    )


_PRIVATE_UNICODE_CHAR = ""


def get_non_code_text(
    soup_or_tag: BeautifulSoup | Tag, replace_with_placeholder: bool = False
) -> str:
    """
    Extract all text from BeautifulSoup object, excluding code blocks and KaTeX
    elements.

    Args:
        soup_or_tag: BeautifulSoup object or Tag to extract text from
        replace_with_placeholder: If True, replace code with
            _PRIVATE_UNICODE_CHAR instead of removing it
            (preserves text positions)

    Returns:
        String containing all non-code, non-KaTeX text
    """
    temp_soup = BeautifulSoup(str(soup_or_tag), "html.parser")

    elements_to_remove = temp_soup.find_all(
        ["code", "pre", "script", "style"]
    ) + temp_soup.find_all(class_=["katex", "katex-display"])
    for element_to_remove in elements_to_remove:
        if replace_with_placeholder:
            element_to_remove.replace_with(
                NavigableString(_PRIVATE_UNICODE_CHAR)
            )
        else:
            element_to_remove.decompose()

    return temp_soup.get_text()


# pylint: disable=missing-function-docstring
def get_classes(tag: Tag) -> list[str]:
    class_attr_value = tag.get("class")
    if isinstance(class_attr_value, list):
        return [str(c) for c in class_attr_value]
    if class_attr_value is None:
        return []
    raise ValueError("Invalid class attribute value")
