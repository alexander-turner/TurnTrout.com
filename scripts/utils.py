"""Utility functions for scripts/ directory."""

import copy
import functools
import io
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable, Collection
from pathlib import Path
from typing import NoReturn
from urllib.parse import urlparse

import git
import requests
from bs4 import BeautifulSoup, Tag
from bs4.element import NavigableString
from requests.adapters import HTTPAdapter
from ruamel.yaml import YAML, YAMLError
from urllib3.util.retry import Retry

# Shared constants — single source of truth: config/constants.json.
_CONSTANTS_JSON_PATH = (
    Path(__file__).resolve().parent.parent / "config" / "constants.json"
)
with open(_CONSTANTS_JSON_PATH, encoding="utf-8") as _f:
    _CONSTANTS = json.load(_f)
_UNICODE_TYPO = _CONSTANTS["unicodeTypography"]

NBSP: str = _UNICODE_TYPO["nbsp"]
LEFT_SINGLE_QUOTE: str = _UNICODE_TYPO["leftSingleQuote"]
RIGHT_SINGLE_QUOTE: str = _UNICODE_TYPO["rightSingleQuote"]
LEFT_DOUBLE_QUOTE: str = _UNICODE_TYPO["leftDoubleQuote"]
RIGHT_DOUBLE_QUOTE: str = _UNICODE_TYPO["rightDoubleQuote"]
ELLIPSIS: str = _UNICODE_TYPO["ellipsis"]
ZERO_WIDTH_SPACE: str = _UNICODE_TYPO["zeroWidthSpace"]

# Asset CDN: full URL and bare hostname. Hostname is derived so the
# bare-string and URL forms can't drift.
CDN_BASE_URL: str = _CONSTANTS["cdnBaseUrl"]
CDN_HOSTNAME: str = CDN_BASE_URL.split("://", 1)[1].split("/", 1)[0]
TWEMOJI_BASE_URL: str = _CONSTANTS["twemojiBaseUrl"]

# R2/Cloudflare credentials shared by scripts/r2_baselines.py and
# scripts/r2_upload.py. Populated by ``envchain cloudflare`` in normal
# use; the GitHub Actions runner injects them as secrets.
R2_REQUIRED_ENV: tuple[str, ...] = (
    "ACCESS_KEY_ID_TURNTROUT_MEDIA",
    "SECRET_ACCESS_TURNTROUT_MEDIA",
    "S3_ENDPOINT_ID_TURNTROUT_MEDIA",
)


def check_r2_env() -> None:
    """Raise RuntimeError if any R2 credential env var is missing."""
    missing = [k for k in R2_REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise RuntimeError(
            "Missing R2 credentials in environment: "
            f"{', '.join(missing)}. "
            "Run via `envchain cloudflare ...` so rclone can authenticate."
        )


# Top-level content directory (Markdown source). Mirrors the TS-side
# `contentDirName` export.
CONTENT_DIR_NAME: str = _CONSTANTS["contentDirName"]
ZERO_WIDTH_NBSP: str = _UNICODE_TYPO["zeroWidthNbsp"]
WORD_JOINER: str = _UNICODE_TYPO["wordJoiner"]
LEFT_GUILLEMET: str = _UNICODE_TYPO["leftGuillemet"]
RIGHT_GUILLEMET: str = _UNICODE_TYPO["rightGuillemet"]
GERMAN_OPEN_QUOTE: str = _UNICODE_TYPO["germanOpenQuote"]

# Dark-mode invert pipeline. Shared between scripts/label_invert.py (the
# interactive labeler) and scripts/built_site_checks.py (the validator).
# Tuples (not sets) so we can pass directly to ``str.endswith``.
INVERT_RASTER_EXTENSIONS: tuple[str, ...] = (
    ".avif",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
)
# Inline looping muted videos (GIF-replacements). Each format is its own URL on
# R2; the rendered ``<video>`` tries each ``<source>`` in order, but we ask the
# labeler for a verdict per URL.
INVERT_VIDEO_EXTENSIONS: tuple[str, ...] = (".mp4", ".webm", ".mov")
# Vector images served as ``<img src="...svg">``. Treated like raster for the
# build transformer and built-site validator, but the labeler skips luminance
# auto-classification — PIL can't rasterize SVG, and chart-on-white SVGs are
# rare enough to label manually.
INVERT_SVG_EXTENSIONS: tuple[str, ...] = (".svg",)
INVERT_LABELABLE_EXTENSIONS: tuple[str, ...] = (
    INVERT_RASTER_EXTENSIONS + INVERT_VIDEO_EXTENSIONS + INVERT_SVG_EXTENSIONS
)
# Every ``<img>`` extension the build pipeline treats as labelable (raster +
# SVG). Videos use their own tuple because validation hits a different DOM
# selector.
INVERT_IMG_EXTENSIONS: tuple[str, ...] = (
    INVERT_RASTER_EXTENSIONS + INVERT_SVG_EXTENSIONS
)
# URL path segments whose media bypass invert-labeling (favicons, emoji, etc.).
INVERT_EXCLUDED_SEGMENTS: frozenset[str] = frozenset(
    {
        "external-favicons",
        "twemoji",
        "turntrout-favicons",
        "card_images",
        "avatars",
    }
)


def http_session(
    retries: int = 3,
    backoff_factor: float = 1,
    status_forcelist: tuple[int, ...] = (502, 503, 504),
) -> requests.Session:
    """
    Create a requests Session with automatic retry on transient failures.

    Retries on connection errors, timeouts, and the given HTTP status codes with
    exponential backoff (1s, 2s, 4s by default).
    """
    retry = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=list(status_forcelist),
        allowed_methods=["HEAD", "GET"],
    )
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def load_shared_constants() -> dict:
    """
    Return the shared constants from config/constants.json.

    The file is read once at import into ``_CONSTANTS``; callers receive an
    independent deep copy so mutating the result cannot corrupt the cache.
    """
    return copy.deepcopy(_CONSTANTS)


def load_json_object(path: Path) -> dict:
    """
    Load a top-level JSON object from *path* (empty dict if the file is absent).

    Raises ``ValueError`` if the file's top-level JSON value is not an object,
    so a corrupted cache fails loudly rather than defaulting silently.
    """
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def atomic_write_json(
    data: object, path: Path, *, sort_keys: bool = False
) -> None:
    """
    Atomically write *data* to *path* as pretty-printed JSON.

    Creates parent directories as needed, writes to a tempfile, then
    ``os.replace``s it into place. Any failure deletes the partial tempfile
    before re-raising.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=str(path.parent)
    )
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(
                data, fh, ensure_ascii=False, indent=2, sort_keys=sort_keys
            )
            fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


_executable_cache: dict[str, str] = {}


@functools.lru_cache(maxsize=1)
def _get_imagemagick_version() -> int:
    """
    Detect ImageMagick version (6 or 7).

    Defaults to 6 if unclear.
    """
    magick_path = shutil.which("magick")
    if not magick_path:
        return 6

    result = subprocess.run(
        [magick_path, "-version"], capture_output=True, text=True, check=False
    )
    return 7 if "ImageMagick 7" in result.stdout else 6


def get_imagemagick_command(operation: str) -> list[str]:
    """Get ImageMagick command for an operation (handles IM6 vs IM7)."""
    if _get_imagemagick_version() == 7:
        # In IM7, "magick convert" is deprecated; just "magick" is equivalent.
        if operation == "convert":
            return [find_executable("magick")]
        return [find_executable("magick"), operation]

    operation_path = shutil.which(operation)
    if not operation_path:
        raise FileNotFoundError(f"ImageMagick '{operation}' not found.")
    return [operation_path]


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


def get_git_root(starting_dir: Path | None = None) -> Path:
    """
    Returns the absolute path to the top-level directory of the Git repository.

    Args:
        starting_dir: Directory from which to start searching for the Git root.

    Returns:
        Path: Absolute path to the Git repository root.

    Raises:
        CalledProcessError: If Git root cannot be determined.
    """
    git_executable = find_executable("git")
    completed_process = subprocess.run(
        [git_executable, "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
        cwd=starting_dir if starting_dir else Path.cwd(),
    )
    return Path(completed_process.stdout.strip())


def get_files(
    dir_to_search: Path | None = None,
    filetypes_to_match: Collection[str] = (".md",),
    use_git_ignore: bool = True,
    ignore_dirs: Collection[str] | None = None,
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
                # ``repo.ignored`` shells out to ``git check-ignore``; pass all
                # paths in one call instead of spawning a subprocess per file.
                ignored = (
                    frozenset(repo.ignored(*relative_files))
                    if relative_files
                    else frozenset()
                )
                files = [
                    file
                    for file, rel_file in zip(files, relative_files)
                    if str(rel_file) not in ignored
                ]
            except (
                git.GitCommandError,
                ValueError,
                RuntimeError,
                subprocess.CalledProcessError,
            ) as exc:
                logging.debug(
                    "Git filtering failed, continuing without it: %s", exc
                )
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
        raise ValueError("The path must be within a 'quartz' directory.") from e


def get_yaml_parser() -> YAML:
    """
    Return a round-trip ruamel.yaml parser configured for markdown frontmatter.

    Preserves quotes and comments; sets the indentation used across this
    project. ``width`` is large so long URLs do not get wrapped onto multiple
    lines.
    """
    parser = YAML(typ="rt")
    parser.preserve_quotes = True
    parser.indent(mapping=2, sequence=2, offset=2)
    parser.width = 4096
    return parser


def write_yaml_frontmatter(
    file_path: Path,
    metadata: dict,
    content: str,
    parser: YAML | None = None,
) -> None:
    """
    Write *metadata* as YAML frontmatter followed by *content* to *file_path*.

    A new :func:`get_yaml_parser` instance is used if *parser* is not given.
    """
    yaml_parser = parser if parser is not None else get_yaml_parser()
    stream = io.StringIO()
    yaml_parser.dump(metadata, stream)
    with file_path.open("w", encoding="utf-8") as f:
        f.write("---\n")
        f.write(stream.getvalue())
        f.write("---\n")
        f.write(content)


def update_markdown_file(
    file_path: Path, transform_fn: Callable[[str], str]
) -> bool:
    """
    Read *file_path*, apply *transform_fn* to its contents, write back if
    changed.

    Returns True when the file was modified.
    """
    original = file_path.read_text(encoding="utf-8")
    updated = transform_fn(original)
    if updated == original:
        return False
    file_path.write_text(updated, encoding="utf-8")
    return True


def extract_filename_from_url(url: str) -> str:
    """
    Return the trailing filename of *url* (everything after the final ``/``).

    Raises:
        ValueError: When the URL has no filename component.
    """
    filename = os.path.basename(urlparse(url).path)
    if not filename:
        raise ValueError(f"URL has no filename component: {url}")
    return filename


def error_exit(message: str, code: int = 1) -> NoReturn:
    """Print *message* to stderr and exit with *code*."""
    print(message, file=sys.stderr)
    sys.exit(code)


# Closing frontmatter fence: a line containing only `---` (with optional
# trailing spaces/tabs). Line-anchored so a `---` inside a value isn't matched.
_CLOSING_FENCE_RE = re.compile(r"^---[ \t]*$", re.MULTILINE)


def split_yaml(file_path: Path, verbose: bool = False) -> tuple[dict, str]:
    """
    Split a markdown file into its YAML frontmatter and content.

    Args:
        file_path: Path to the markdown file
        verbose: Whether to print error messages

    Returns:
        Tuple of (metadata dict, content string)
    """
    yaml = get_yaml_parser()

    with file_path.open("r", encoding="utf-8") as f:
        content = f.read()

    # Frontmatter is a leading YAML block fenced by `---` lines: an opening
    # `---\n` at the very start of the file and a closing `---` on its own
    # line. The closing fence must be line-anchored so a `---` inside a YAML
    # value (or a `---` rule in the body) isn't mistaken for the delimiter.
    fence_match = (
        _CLOSING_FENCE_RE.search(content, 4)
        if content.startswith("---\n")
        else None
    )
    if fence_match is None:
        if verbose:
            print(f"Skipping {file_path}: No valid frontmatter found")
        return {}, ""

    front_matter_text = content[4 : fence_match.start()]
    body = content[fence_match.end() :]

    try:
        metadata = yaml.load(front_matter_text)
        # YAML front matter that's a scalar (string, number, null) parses
        # to a non-dict — coerce so callers can always rely on .get/.items.
        if not isinstance(metadata, dict):
            metadata = {}
    except YAMLError as e:
        print(f"Error parsing YAML in {file_path}: {str(e)}")
        return {}, ""

    return metadata, body


def build_html_to_md_map(md_dir: Path) -> dict[str, Path]:
    """
    Build a mapping of permalinks to markdown file paths by extracting and
    parsing the YAML front matter of each markdown file.

    Args:
        md_dir: Path to the directory containing markdown files

    Returns:
        Dictionary mapping permalinks to their corresponding markdown file paths
    """
    html_to_md_path: dict[str, Path] = {}

    md_files = list(md_dir.glob("*.md")) + list(md_dir.glob("drafts/*.md"))

    for md_file in md_files:
        front_matter, _ = split_yaml(md_file, verbose=False)
        permalink = front_matter.get("permalink")
        if permalink:
            permalink = permalink.strip("/")
            html_to_md_path[permalink] = md_file

    return html_to_md_path


def collect_aliases(md_dir: Path) -> set[str]:
    """Collect all aliases from the markdown files."""
    aliases: set[str] = set()
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
