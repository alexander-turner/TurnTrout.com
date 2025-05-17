"""
Test the utilities used for running the tests :)
"""

import subprocess
from pathlib import Path
from typing import Optional
from unittest import mock

import git
import pytest
from bs4 import BeautifulSoup

from .. import utils as script_utils


def test_git_root_is_ancestor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Test that the found git root is an ancestor of the current file.
    """
    monkeypatch.setattr(script_utils, "get_git_root", lambda: tmp_path)
    current_file_path = tmp_path / "tests" / "test_utils.py"
    current_file_path.parent.mkdir(parents=True)
    current_file_path.touch()

    git_root = script_utils.get_git_root()
    assert git_root is not None
    assert current_file_path.is_relative_to(git_root)


def test_find_git_root(monkeypatch: pytest.MonkeyPatch) -> None:
    expected_output = "/path/to/git/root"

    def mock_subprocess_run(*args, **_kwargs) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=args,
            returncode=0,
            stdout=expected_output,
        )

    monkeypatch.setattr(script_utils.subprocess, "run", mock_subprocess_run)
    assert script_utils.get_git_root() == Path(expected_output)


def test_get_git_root_raises_error():
    def mock_subprocess_run(*args, **_kwargs) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=args,
            returncode=1,
            stdout="",
        )

    with mock.patch.object(
        script_utils.subprocess, "run", mock_subprocess_run
    ):
        with pytest.raises(RuntimeError):
            script_utils.get_git_root()


@pytest.mark.parametrize(
    "input_path,expected_output,should_raise",
    [
        (
            "/home/user/quartz/static/images/test.png",
            Path("quartz/static/images/test.png"),
            False,
        ),
        ("/home/user/projects/other/file.txt", None, True),
        ("/home/user/quartz/website_content/notes.md", None, True),
        (
            "/home/user/quartz/static/deeply/nested/folder/image.jpg",
            Path("quartz/static/deeply/nested/folder/image.jpg"),
            False,
        ),
        (
            "/quartz/static/root-level.png",
            Path("quartz/static/root-level.png"),
            False,
        ),
        (
            "/path/to/quartz/static/videos/demo.mp4",
            Path("quartz/static/videos/demo.mp4"),
            False,
        ),
        (
            "/path/to/quartz/static/documents/report.pdf",
            Path("quartz/static/documents/report.pdf"),
            False,
        ),
        (
            "/path/to/quartz/not-static/image.png",
            None,
            True,
        ),
        (
            "/path/to/not-quartz/static/image.png",
            None,
            True,
        ),
        (
            "/home/user/quartz/static",
            None,
            True,
        ),
        (
            "relative/path/quartz/static/image.png",
            Path("quartz/static/image.png"),
            False,
        ),
    ],
)
def test_path_relative_to_quartz(
    input_path: str, expected_output: Optional[Path], should_raise: bool
) -> None:
    """
    Test path_relative_to_quartz_parent with various input paths.

    Args:
        input_path: The input path to test
        expected_output: The expected output Path, or None if should raise
        should_raise: Whether the function should raise a ValueError
    """
    if should_raise:
        with pytest.raises(ValueError):
            script_utils.path_relative_to_quartz_parent(Path(input_path))
    else:
        assert (
            script_utils.path_relative_to_quartz_parent(Path(input_path))
            == expected_output
        )


def test_get_files_no_dir():
    """
    Test when no directory is provided.
    """
    result = script_utils.get_files()
    assert isinstance(result, tuple)
    assert not result  # Empty tuple since no directory was given


@pytest.mark.parametrize(
    "file_paths, expected_files",
    [
        (["test.md", "test.txt"], ["test.md"]),
        (
            ["subdir1/test1.md", "subdir1/test1.txt", "subdir2/test2.md"],
            ["subdir1/test1.md", "subdir2/test2.md"],
        ),
        (
            ["test.md", "test.txt", "image.jpg", "document.pdf"],
            ["test.md", "test.txt"],
        ),
    ],
)
def test_get_files_specific_dir(tmp_path, file_paths, expected_files):
    """
    Test file discovery by inferring structure from file paths.
    """
    # Create test files and directories
    for file_path in file_paths:
        file: Path = tmp_path / file_path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.touch()  # Just create empty files

    # Get files based on the file extensions in the file paths
    filetypes_to_match = list({p.suffix for p in map(Path, expected_files)})
    result = script_utils.get_files(
        dir_to_search=tmp_path,
        filetypes_to_match=filetypes_to_match,
        use_git_ignore=False,
    )

    # Normalize file paths and compare
    result = [str(p.relative_to(tmp_path)) for p in result]
    assert sorted(result) == sorted(expected_files)


def test_get_files_gitignore(tmp_path):
    """
    Test with a .gitignore file.
    """
    try:
        # Create a git repository in tmp_path
        repo = git.Repo.init(tmp_path)
        (tmp_path / ".gitignore").write_text("*.txt\n")  # Ignore text files

        md_file = tmp_path / "test.md"
        txt_file = tmp_path / "test.txt"
        md_file.write_text("Markdown content")
        txt_file.write_text("Text content")
        repo.index.add([".gitignore", "test.md", "test.txt"])
        repo.index.commit("Initial commit")

        # Test getting files with gitignore
        result = script_utils.get_files(dir_to_search=tmp_path)
        assert len(result) == 1
        assert result[0] == md_file
    except git.GitCommandError:
        pytest.skip("Git not installed or not in PATH")


def test_get_files_ignore_dirs(tmp_path):
    """
    Test that specified directories are ignored.
    """
    # Create test directory structure
    templates_dir = tmp_path / "templates"
    regular_dir = tmp_path / "regular"
    nested_templates = tmp_path / "docs" / "templates"

    # Create directories
    for dir_path in [templates_dir, regular_dir, nested_templates]:
        dir_path.mkdir(parents=True, exist_ok=True)

    # Create test files
    test_files = [
        templates_dir / "template.md",
        regular_dir / "regular.md",
        nested_templates / "nested.md",
        tmp_path / "root.md",
    ]

    for file in test_files:
        file.write_text("test content")

    # Get files, ignoring 'templates' directories
    result = script_utils.get_files(
        dir_to_search=tmp_path,
        filetypes_to_match=(".md",),
        ignore_dirs=["templates"],
        use_git_ignore=False,
    )

    # Convert results to set of strings for easier comparison
    result_paths = {str(p.relative_to(tmp_path)) for p in result}

    # Expected files (only files not in 'templates' directories)
    expected_paths = {"regular/regular.md", "root.md"}

    assert result_paths == expected_paths


@pytest.mark.parametrize(
    "md_contents,expected_map",
    [
        # Basic permalink
        (
            {
                "test1.md": """---
permalink: /test-page
title: Test Page
---
# Content"""
            },
            {"test-page": "test1.md"},
        ),
        # Multiple files with permalinks
        (
            {
                "test1.md": """---
permalink: /test-page
title: Test Page
---
# Content""",
                "test2.md": """---
permalink: /other-page/
title: Other Page
---
# Content""",
            },
            {"test-page": "test1.md", "other-page": "test2.md"},
        ),
        # File without permalink should be skipped
        (
            {
                "test3.md": """---
title: No Permalink
---
# Content"""
            },
            {},
        ),
        # Files in drafts directory
        (
            {
                "test1.md": """---
permalink: /page
---
# Content""",
                "drafts/draft1.md": """---
permalink: /draft
---
# Content""",
            },
            {
                "page": "test1.md",
                "draft": "drafts/draft1.md",
            },
        ),
        # Invalid YAML should be skipped
        (
            {
                "invalid.md": """---
permalink: /test
title: "Unclosed quote
---
# Content"""
            },
            {},
        ),
        # Empty front matter should be skipped
        (
            {
                "empty.md": """---
---
# Content"""
            },
            {},
        ),
        # Mixed valid and invalid files
        (
            {
                "valid.md": """---
permalink: /valid-page
---
# Content""",
                "invalid.md": "No front matter",
            },
            {"valid-page": "valid.md"},
        ),
        # Test permalink appearing in aliases
        (
            {
                "test1.md": """---
permalink: /test-page
aliases: [/test-page, /other-alias]
title: Test Page
---
# Content"""
            },
            {"test-page": "test1.md"},
        ),
        # Test permalink as only alias
        (
            {
                "test2.md": """---
permalink: /test-page
aliases: /test-page
title: Test Page
---
# Content"""
            },
            {"test-page": "test2.md"},
        ),
        # Test permalink in list of aliases
        (
            {
                "test3.md": """---
permalink: /test-page
aliases: [/first-alias, /test-page, /last-alias]
title: Test Page
---
# Content"""
            },
            {"test-page": "test3.md"},
        ),
    ],
)
def test_build_permalink_map(
    tmp_path: Path, md_contents: dict[str, str], expected_map: dict[str, str]
) -> None:
    """
    Test building the permalink to markdown file mapping.

    Args:
        tmp_path: Temporary directory for testing
        md_contents: Dictionary mapping file paths to their contents
        expected_map: Expected mapping of permalinks to file paths
    """
    # Create test files
    for file_path, content in md_contents.items():
        full_path = tmp_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)

    # Build the permalink map
    result = script_utils.build_html_to_md_map(tmp_path)

    # Convert the result paths to be relative to tmp_path for comparison
    result_relative = {
        permalink: str(path.relative_to(tmp_path))
        for permalink, path in result.items()
    }

    assert result_relative == expected_map


def test_build_permalink_map_nested_directories(tmp_path: Path) -> None:
    """
    Test the build_permalink_map function with markdown files in drafts directory.
    """
    # Create directories
    drafts_dir = tmp_path / "drafts"
    drafts_dir.mkdir()

    # Create markdown files
    md_files = {
        tmp_path
        / "post1.md": """---
permalink: /posts/post1/
title: "Post 1"
---
# Content of Post 1.
""",
        drafts_dir
        / "draft1.md": """---
permalink: /drafts/draft1/
title: "Draft 1"
---
# Content of Draft 1.
""",
    }

    # Write the markdown files
    for file_path, content in md_files.items():
        file_path.write_text(content)

    # Run the build_permalink_map function
    result = script_utils.build_html_to_md_map(tmp_path)

    # Expected result
    expected_result = {
        "posts/post1": tmp_path / "post1.md",
        "drafts/draft1": drafts_dir / "draft1.md",
    }

    # Normalize permalinks
    expected_result = {k.strip("/"): v for k, v in expected_result.items()}

    # Assert that the resulting mapping matches the expected result
    assert result == expected_result


def test_build_permalink_map_handles_errors_gracefully(
    tmp_path: Path, capsys
) -> None:
    """
    Test that the build_permalink_map function handles errors gracefully and continues processing other files.
    """
    # Create markdown files with one valid and one invalid file
    md_files = {
        "valid.md": """---
permalink: /valid/
title: "Valid"
---
# Valid content.
""",
        "invalid.md": """---
title: "Invalid"
malformed_yaml: [unclosed list
---
# Invalid content.
""",
        "no_front_matter.md": """# No front matter here.
""",
    }

    # Write the markdown files
    for filename, content in md_files.items():
        file_path = tmp_path / filename
        file_path.write_text(content)

    # Run the build_permalink_map function
    result = script_utils.build_html_to_md_map(tmp_path)

    # Expected result
    expected_result = {
        "valid": tmp_path / "valid.md",
    }

    # Assert that the resulting mapping matches the expected result
    assert result == expected_result

    # Capture stdout to check for error messages
    captured = capsys.readouterr()
    assert "Error parsing YAML in" in captured.out
    assert "Unexpected error" not in captured.out


def test_build_permalink_map_with_extra_delimiters(tmp_path: Path) -> None:
    """
    Test that the build_permalink_map function correctly parses files with extra delimiters in the front matter.
    """
    md_content = """---
permalink: /extra-delimiter/
title: "Extra Delimiter"
---
---
# Content with extra delimiter.
"""

    file_path = tmp_path / "extra.md"
    file_path.write_text(md_content)

    # Run the build_permalink_map function
    result = script_utils.build_html_to_md_map(tmp_path)

    # Expected result
    expected_result = {
        "extra-delimiter": file_path,
    }

    # Normalize permalinks
    expected_result = {k.strip("/"): v for k, v in expected_result.items()}

    # Assert that the resulting mapping matches the expected result
    assert result == expected_result


def test_parse_html_file(tmp_path: Path) -> None:
    """
    Test parsing an HTML file into a BeautifulSoup object.
    """
    # Create a test HTML file
    html_content = "<html><body><h1>Test</h1></body></html>"
    test_file = tmp_path / "test.html"
    test_file.write_text(html_content)

    # Parse the file
    soup = script_utils.parse_html_file(test_file)

    # Verify the parsed content
    assert soup.find("h1") is not None


def test_is_redirect() -> None:
    """
    Test detection of redirect pages.
    """
    # Test a redirect page
    redirect_html = """
    <html>
        <head>
            <meta http-equiv="refresh" content="0; url=target.html">
        </head>
        <body>Redirecting...</body>
    </html>
    """
    redirect_soup = BeautifulSoup(redirect_html, "html.parser")
    assert script_utils.is_redirect(redirect_soup) is True

    # Test a non-redirect page
    normal_html = """
    <html>
        <head><title>Normal Page</title></head>
        <body>Content</body>
    </html>
    """
    normal_soup = BeautifulSoup(normal_html, "html.parser")
    assert script_utils.is_redirect(normal_soup) is False


@pytest.mark.parametrize(
    "file_path,expected_result",
    [
        (Path("public/test.html"), True),  # Regular page needs markdown
        (Path("public/404.html"), False),  # Special pages don't need markdown
        (Path("public/all-tags.html"), False),
        (Path("public/recent.html"), False),
        # Tag pages don't need markdown
        (Path("public/tags/test-tag.html"), False),
        # Tags index doesn't need markdown
        (Path("public/tags/index.html"), False),
        # Tags directory itself doesn't need markdown
        (Path("public/tags/"), False),
        (Path("public/index.html"), True),  # Main index needs markdown
    ],
)
def test_should_have_md(
    tmp_path: Path, file_path: Path, expected_result: bool
) -> None:
    """
    Test determination of whether an HTML file should have a corresponding markdown file.
    """
    # Create the test HTML file
    full_path = tmp_path / file_path
    full_path.parent.mkdir(parents=True, exist_ok=True)

    # Create normal HTML content
    html_content = """
    <html>
        <head><title>Test</title></head>
        <body>Content</body>
    </html>
    """
    full_path.write_text(html_content)

    with mock.patch("scripts.utils.parse_html_file") as mock_parse:
        mock_parse.return_value = BeautifulSoup(html_content, "html.parser")
        assert script_utils.should_have_md(file_path) == expected_result


def test_md_for_html_with_redirect(tmp_path: Path) -> None:
    """
    Test that redirect pages are correctly identified as not needing markdown files.
    """
    test_file = tmp_path / "test.html"
    redirect_html = """
    <html>
        <head>
            <meta http-equiv="refresh" content="0; url=target.html">
        </head>
        <body>Redirecting...</body>
    </html>
    """
    test_file.write_text(redirect_html)

    assert script_utils.should_have_md(test_file) is False


def test_parse_html_file_errors(tmp_path: Path) -> None:
    """
    Test error handling in parse_html_file.
    """
    # Test non-existent file
    non_existent = tmp_path / "nonexistent.html"
    with pytest.raises(FileNotFoundError):
        script_utils.parse_html_file(non_existent)

    # Test invalid HTML
    invalid_file = tmp_path / "invalid.html"
    invalid_file.write_text("<<<invalid>html>")
    soup = script_utils.parse_html_file(invalid_file)
    assert soup is not None  # BeautifulSoup handles invalid HTML gracefully

    # Test different encodings
    utf8_content = "<html><body><p>UTF-8 content: 你好</p></body></html>"
    utf8_file = tmp_path / "utf8.html"
    utf8_file.write_text(utf8_content, encoding="utf-8")
    soup = script_utils.parse_html_file(utf8_file)
    assert "你好" in soup.text


@pytest.mark.parametrize(
    "html_content,expected_result",
    [
        # Standard refresh meta tag with URL
        ("""<meta http-equiv="refresh" content="0; url=target.html">""", True),
        # Refresh without URL (not a redirect)
        ("""<meta http-equiv="refresh" content="5">""", False),
        # Case insensitive checks
        ("""<meta HTTP-EQUIV="REFRESH" CONTENT="0; URL=target.html">""", True),
        # Multiple meta tags
        (
            """<meta name="description"><meta http-equiv="refresh" content="0; url=target.html">""",
            True,
        ),
        # Non-refresh meta
        ("""<meta http-equiv="content-type" content="text/html">""", False),
        # Empty meta
        ("""<meta>""", False),
        # Other meta tags
        ("""<meta name="description"><meta name="keywords">""", False),
    ],
)
def test_is_redirect_variations(
    html_content: str, expected_result: bool
) -> None:
    """
    Test various forms of meta refresh tags for redirect detection.
    """
    html = f"<html><head>{html_content}</head><body>Content</body></html>"
    soup = BeautifulSoup(html, "html.parser")
    assert script_utils.is_redirect(soup) == expected_result


@pytest.mark.parametrize(
    "html_content,description",
    [
        ("<<<invalid>html>", "malformed HTML"),
        ("", "empty file"),
        ("   \n   \t   ", "whitespace-only file"),
    ],
)
def test_md_for_html_error_handling(
    tmp_path: Path, html_content: str, description: str
) -> None:
    """
    Test error handling in md_for_html function with various problematic inputs.
    """
    test_file = tmp_path / "test.html"
    test_file.write_text(html_content)

    # Should handle all error cases gracefully by returning True
    assert (
        script_utils.should_have_md(test_file) is True
    ), f"Failed to handle {description}"


@pytest.mark.parametrize(
    "html,expected",
    [
        ("<html><body></body></html>", True),
        ("<html><body><div>Content</div></body></html>", False),
        ("<html></html>", True),
    ],
)
def test_body_is_empty(html, expected):
    soup = BeautifulSoup(html, "html.parser")
    result = script_utils.body_is_empty(soup)
    assert result == expected


@pytest.fixture
def sample_html_for_get_non_code_text() -> str:
    """Provides a sample HTML string for testing get_non_code_text."""
    return """
    <div>
        <p id="test-paragraph">
            Visible Text.
            <span class="katex">KaTeX stuff</span>
            <code>code stuff</code>
            More Visible Text.
        </p>
        <p id="another-paragraph">
            Even more text <a href="#">link</a>
        </p>
    </div>
    """


def test_get_non_code_text_does_not_modify_original_tag(
    sample_html_for_get_non_code_text,
):
    """
    Test that get_non_code_text does not modify the original Tag object
    passed to it, by comparing its string representation.
    """
    soup = BeautifulSoup(sample_html_for_get_non_code_text, "html.parser")
    paragraph_tag = soup.find("p", id="test-paragraph")
    assert paragraph_tag is not None, "Test paragraph not found"

    original_tag_str_before = str(paragraph_tag)
    script_utils.get_non_code_text(paragraph_tag)
    original_tag_str_after = str(paragraph_tag)

    assert original_tag_str_before == original_tag_str_after, (
        "Tag was modified by get_non_code_text. "
        f"Before:\n{original_tag_str_before}\nAfter:\n{original_tag_str_after}"
    )


def test_get_non_code_text_does_not_modify_original_soup_object(
    sample_html_for_get_non_code_text,
):
    """
    Test that get_non_code_text does not modify the original BeautifulSoup
    object passed to it, by comparing its string representation.
    """
    original_soup = BeautifulSoup(
        sample_html_for_get_non_code_text, "html.parser"
    )

    original_soup_str_before = str(original_soup)
    script_utils.get_non_code_text(original_soup)
    original_soup_str_after = str(original_soup)

    assert original_soup_str_before == original_soup_str_after, (
        "BeautifulSoup object was modified by get_non_code_text. "
        f"Before:\n{original_soup_str_before}\nAfter:\n{original_soup_str_after}"
    )


def test_get_non_code_text_returns_correct_text_for_tag(
    sample_html_for_get_non_code_text,
):
    """
    Test that get_non_code_text returns the correctly stripped text when
    given a Tag object.
    """
    soup = BeautifulSoup(sample_html_for_get_non_code_text, "html.parser")
    paragraph_tag = soup.find("p", id="test-paragraph")
    assert paragraph_tag is not None

    stripped_text = script_utils.get_non_code_text(paragraph_tag)
    expected_text = "Visible Text. More Visible Text."
    assert " ".join(stripped_text.split()) == " ".join(expected_text.split())


def test_get_non_code_text_returns_correct_text_for_soup_object(
    sample_html_for_get_non_code_text,
):
    """
    Test that get_non_code_text returns the correctly stripped text when
    given a BeautifulSoup object.
    """
    soup = BeautifulSoup(sample_html_for_get_non_code_text, "html.parser")

    stripped_text = script_utils.get_non_code_text(soup)
    expected_text = "Visible Text. More Visible Text. Even more text link"
    assert " ".join(stripped_text.split()) == " ".join(expected_text.split())


@pytest.mark.parametrize(
    "md_contents, expected_aliases",
    [
        # Basic cases
        (
            {
                "test.md": """---
title: Test
aliases: [/alias1, /alias2]
---
# Content
"""
            },
            {"/alias1", "/alias2"},
        ),
        (
            {
                "test1.md": """---
title: Test 1
aliases: [/alias1, /alias2]
---
# Content
""",
                "test2.md": """---
title: Test 2
aliases: [/alias3, /alias4]
---
# Content
""",
            },
            {"/alias1", "/alias2", "/alias3", "/alias4"},
        ),
        # No aliases
        (
            {
                "test.md": """---
title: Test
---
# Content
"""
            },
            set(),
        ),
        # Permalink removal
        (
            {
                "test.md": """---
title: Test
permalink: /test
aliases: [/alias1, /test, /alias2]
---
# Content
"""
            },
            {"/alias1", "/alias2"},
        ),
        # String alias (ignored)
        (
            {
                "test.md": """---
title: Test
aliases: /single-alias
---
# Content
"""
            },
            set(),
        ),
        # Mixed files
        (
            {
                "with_aliases.md": """---
title: With Aliases
aliases: [alias1, alias2]
---
# Content
""",
                "without_aliases.md": """---
title: Without Aliases
---
# Content
""",
            },
            {"alias1", "alias2"},
        ),
        # Invalid YAML (skipped)
        (
            {
                "invalid.md": """---
title: "Unclosed quote
aliases: [/alias1, /alias2]
---
# Content
"""
            },
            set(),
        ),
        # Nested directories
        (
            {
                "root.md": """---
title: Root
aliases: [/root-alias1, /root-alias2]
---
# Content
""",
                "nested/nested.md": """---
title: Nested
aliases: [/nested-alias1, /nested-alias2]
---
# Content
""",
            },
            {
                "/root-alias1",
                "/root-alias2",
                "/nested-alias1",
                "/nested-alias2",
            },
        ),
        # Empty front matter
        (
            {
                "empty.md": """---
---
# Content
"""
            },
            set(),
        ),
        # No front matter
        (
            {
                "no_front_matter.md": """# Content without front matter
"""
            },
            set(),
        ),
    ],
)
def test_collect_aliases(
    tmp_path: Path, md_contents: dict[str, str], expected_aliases: set[str]
) -> None:
    """
    Test collect_aliases with various file contents and structures.
    """
    # Create test files and directories
    for file_path_str, content in md_contents.items():
        file_path = tmp_path / file_path_str
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)

    result = script_utils.collect_aliases(tmp_path)

    assert result == expected_aliases


def test_get_classes_string_attribute():
    """Test get_classes with a string class attribute."""
    html = '<div class="class1 class2"></div>'
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    assert script_utils.get_classes(tag) == ["class1", "class2"]


def test_get_classes_list_attribute():
    """Test get_classes with a list class attribute."""
    # BeautifulSoup typically stores multi-valued attributes like class as a list
    html = '<div class="class1 class2"></div>'
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    # Simulate how BS might present it if it were a list internally
    tag["class"] = ["class1", "class2", "class3"]
    assert script_utils.get_classes(tag) == ["class1", "class2", "class3"]


def test_get_classes_list_attribute_with_non_string():
    """Test get_classes with a list class attribute containing non-strings."""
    html = "<div></div>"
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    tag["class"] = ["class1", 123, "class3", True]
    assert script_utils.get_classes(tag) == ["class1", "123", "class3", "True"]


def test_get_classes_missing_attribute():
    """Test get_classes when the class attribute is missing."""
    html = "<div></div>"
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    assert script_utils.get_classes(tag) == []


def test_get_classes_empty_string_attribute():
    """Test get_classes with an empty string class attribute."""
    html = '<div class=""></div>'
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    assert script_utils.get_classes(tag) == []


def test_get_classes_empty_list_attribute():
    """Test get_classes with an empty list class attribute."""
    html = "<div></div>"  # Start with no class
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    tag["class"] = []
    assert script_utils.get_classes(tag) == []


def test_get_classes_attribute_is_none():
    """Test get_classes when the class attribute is explicitly None."""
    html = "<div></div>"
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("div")
    assert tag is not None
    tag["class"] = None  # type: ignore
    assert script_utils.get_classes(tag) == []
