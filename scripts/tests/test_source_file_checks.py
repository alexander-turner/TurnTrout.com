import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Tuple
from unittest.mock import patch

import git  # type: ignore[import]
import pytest
import requests  # type: ignore[import]

from .. import utils as script_utils

sys.path.append(str(Path(__file__).parent.parent))

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .. import source_file_checks
else:
    import source_file_checks


@pytest.fixture
def valid_metadata() -> Dict[str, str | List[str]]:
    """
    Fixture providing valid metadata that should pass all checks.
    """
    return {
        "title": "Test Title",
        "description": "Test Description",
        "tags": ["test", "example"],
        "permalink": "/test",
        "date_published": "01/01/2024",
        "date_updated": "01/02/2024",
    }


@pytest.mark.parametrize(
    "metadata,expected_errors",
    [
        # Test case 1: Valid metadata should have no errors
        (
            {
                "title": "Test",
                "description": "Test",
                "tags": ["test"],
                "permalink": "/test",
            },
            [],
        ),
        # Test case 2: Empty/missing required fields should be caught
        (
            {
                "title": "",
                "description": "Test",
                "tags": [],
                "permalink": "/test",
            },
            ["Empty title field", "Empty tags field"],
        ),
        # Test case 3: Missing fields should be caught
        (
            {"description": "Test", "tags": ["test"], "permalink": "/test"},
            ["Missing title field"],
        ),
        # Test case 4: No metadata given
        (
            {},
            ["No valid frontmatter found"],
        ),
    ],
)
def test_check_required_fields(
    metadata: Dict[str, str | List[str]], expected_errors: List[str]
) -> None:
    """
    Test the required fields checker with various metadata configurations.

    Args:
        metadata: Test metadata to check
        expected_errors: List of expected error messages
    """
    errors = source_file_checks.check_required_fields(metadata)
    assert set(errors) == set(expected_errors)


def test_main_workflow(tmp_path: Path, monkeypatch) -> None:
    """
    Integration test for the main workflow. Tests both valid and invalid
    markdown files in the content directory.

    Args:
        tmp_path: Pytest fixture providing temporary directory
        monkeypatch: Pytest fixture for mocking
    """
    # Set up test directory structure
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()

    # Initialize git repo
    git.Repo.init(tmp_path)

    # Create test files
    valid_file = content_dir / "valid.md"
    invalid_file = content_dir / "invalid.md"

    # Valid markdown with proper frontmatter
    valid_content = """---
title: Test Title
description: Test Description
tags: [test]
permalink: /test
date_published: 01/01/2024
---
Test content
"""

    # Invalid markdown with missing required fields
    invalid_content = """---
description: Test Description
date_published: 2024-01-01
---
Test content
"""

    valid_file.write_text(valid_content)
    invalid_file.write_text(invalid_content)

    # Mock git root to use our temporary directory
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: tmp_path
    )

    # Main should raise a ValueError due to missing permalink
    with pytest.raises(ValueError):
        source_file_checks.main()


@pytest.mark.parametrize(
    "test_case",
    [
        {
            "files": {
                "file1.md": """---
title: First Post
description: Test Description
permalink: /test
---""",
                "file2.md": """---
title: Second Post
description: Test Description
permalink: /test
---""",
            },
            "should_fail": True,
            "reason": "duplicate permalinks",
        },
        {
            "files": {
                "file1.md": """---
title: First Post
description: Test Description
permalink: /test1
aliases: /test2
---""",
                "file2.md": """---
title: Second Post
description: Test Description
permalink: /test2
---""",
            },
            "should_fail": True,
            "reason": "alias matches permalink",
        },
        {
            "files": {
                "file1.md": """---
title: First Post
description: Test Description
permalink: /test1
aliases: [/test2, /test3]
---""",
                "file2.md": """---
title: Second Post
description: Test Description
permalink: /test4
aliases: /test2
---""",
            },
            "should_fail": True,
            "reason": "duplicate aliases",
        },
        {
            "files": {
                "file1.md": """---
title: First Post
description: Test Description
permalink: /test1
aliases: /test2
tags: [test]
---""",
                "file2.md": """---
title: Second Post
description: Test Description
permalink: /test3
aliases: /test4
tags: [test]
---""",
            },
            "should_fail": False,
            "reason": "all URLs unique",
        },
    ],
)
def test_url_uniqueness(tmp_path: Path, monkeypatch, test_case) -> None:
    """
    Test detection of duplicate URLs (permalinks and aliases).
    """
    # Setup
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()
    git.Repo.init(tmp_path)

    # Create test files
    for filename, content in test_case["files"].items():
        (content_dir / filename).write_text(content)

    # Mock git root to use our temporary directory
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: tmp_path
    )

    if test_case["should_fail"]:
        with pytest.raises(SystemExit, match="1"):
            source_file_checks.main()
    else:
        source_file_checks.main()  # Should not raise


def test_invalid_md_links(tmp_path: Path, monkeypatch) -> None:
    """
    Test detection of invalid markdown links.
    """
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()
    git.Repo.init(tmp_path)

    # Create test file with invalid links
    test_file = content_dir / "test.md"
    content = """---
title: Test Post
description: Test Description
permalink: /test
---
# Valid and Invalid Links

Valid link: [Link](/path/to/page)
Invalid link: [Link](path/to/page)
Another invalid: [Link](page.md)
Valid external: [Link](https://example.com)
"""
    test_file.write_text(content)

    # Mock git root
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: tmp_path
    )

    # Should exit with code 1 due to invalid links
    with pytest.raises(SystemExit, match="1"):
        source_file_checks.main()


@pytest.fixture
def scss_scenarios() -> Dict[str, Dict[str, Any]]:
    """
    Fixture providing different SCSS test scenarios.
    """
    return {
        "valid": {
            "website_content": """
                $fonts-dir: '/static/styles/fonts';
                @font-face {
                    font-family: 'ExistingFont';
                    src: url('#{$fonts-dir}/exists.woff2') format('woff2');
                }
            """,
            "files": ["quartz/static/styles/fonts/exists.woff2"],
            "expected_missing": [],
        },
        "missing": {
            "website_content": """
                $fonts-dir: '/static/styles/fonts';
                @font-face {
                    font-family: 'MissingFont';
                    src: url('#{$fonts-dir}/missing.woff2') format('woff2');
                }
            """,
            "files": [],
            "expected_missing": ["/quartz/static/styles/fonts/missing.woff2"],
        },
        "mixed": {
            "website_content": """
                $fonts-dir: '/static/styles/fonts';
                @font-face {
                    font-family: 'ExistingFont';
                    src: url('#{$fonts-dir}/exists.woff2') format('woff2');
                }
                @font-face {
                    font-family: 'MissingFont';
                    src: url('#{$fonts-dir}/missing.woff2') format('woff2');
                }
                @font-face {
                    font-family: 'ExternalFont';
                    src: url('https://example.com/font.woff2') format('woff2');
                }
            """,
            "files": ["quartz/static/styles/fonts/exists.woff2"],
            "expected_missing": ["/quartz/static/styles/fonts/missing.woff2"],
        },
        "scss_error": {
            "website_content": """
                $fonts-dir: '/static/styles/fonts'  // Missing semicolon
                @font-face {
                    font-family: 'TestFont';
                    src: url('#{$fonts-dir}/test.woff2') format('woff2');
                }
            """,
            "files": [],
            "expected_error": "SCSS compilation error",
        },
    }


@pytest.fixture
def setup_font_test(
    tmp_path: Path,
) -> Callable[[str, List[str]], Tuple[Path, Path]]:
    """
    Fixture providing a function to set up font test environment.
    """

    def _setup(scss_content: str, font_files: List[str]) -> Tuple[Path, Path]:
        # Create directory structure
        styles_dir = tmp_path / "quartz" / "styles"
        styles_dir.mkdir(parents=True)

        # Create font files in their full paths
        for font_file in font_files:
            font_path = tmp_path / font_file
            font_path.parent.mkdir(parents=True, exist_ok=True)
            font_path.write_bytes(b"dummy font data")

        # Create and write SCSS file
        fonts_scss = styles_dir / "fonts.scss"
        fonts_scss.write_text(scss_content)

        return fonts_scss, tmp_path

    return _setup


@pytest.mark.parametrize(
    "scenario",
    [
        "valid",
        "missing",
        "mixed",
    ],
)
def test_font_file_scenarios(
    scenario: str,
    scss_scenarios: Dict[str, Dict[str, Any]],
    setup_font_test: Callable,
) -> None:
    """
    Test various font file scenarios.
    """
    test_case = scss_scenarios[scenario]
    fonts_scss, tmp_path = setup_font_test(
        test_case["website_content"], test_case["files"]
    )

    missing_fonts = source_file_checks.check_scss_font_files(
        fonts_scss, tmp_path
    )
    assert missing_fonts == test_case["expected_missing"]


def test_scss_compilation_error(
    scss_scenarios: Dict[str, Dict[str, Any]],
    setup_font_test: Callable,
) -> None:
    """
    Test handling of SCSS compilation errors.
    """
    test_case = scss_scenarios["scss_error"]
    fonts_scss, tmp_path = setup_font_test(test_case["website_content"], [])

    missing_fonts = source_file_checks.check_scss_font_files(
        fonts_scss, tmp_path
    )
    assert len(missing_fonts) == 1
    assert test_case["expected_error"] in missing_fonts[0]


def test_integration_with_main(
    scss_scenarios: Dict[str, Dict[str, Any]],
    setup_font_test: Callable,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Integration test including font file checks.
    """
    # Set up test environment with missing fonts scenario
    test_case = scss_scenarios["missing"]
    fonts_scss, tmp_path = setup_font_test(test_case["website_content"], [])

    # Create content directory (needed for main())
    content_dir = tmp_path / "website_content"
    content_dir.mkdir(exist_ok=True)

    # Initialize git repo
    git.Repo.init(tmp_path)

    # Mock git root
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: tmp_path
    )

    # Main should exit with code 1 due to missing font
    with pytest.raises(SystemExit) as exc_info:
        source_file_checks.main()
    assert exc_info.value.code == 1


def test_compile_scss(tmp_path: Path) -> None:
    """
    Test SCSS compilation.
    """
    scss_file = tmp_path / "test.scss"
    scss_file.write_text(
        """
        $color: red;
        body { color: $color; }
    """
    )

    css = source_file_checks.compile_scss(scss_file)
    assert "body" in css
    assert "red" in css


def test_check_font_files(tmp_path: Path) -> None:
    """
    Test font file checking.
    """
    css_content = """
        @font-face {
            font-family: 'TestFont';
            src: url('/static/styles/fonts/test.woff2') format('woff2');
        }
    """

    missing = source_file_checks.check_font_files(css_content, tmp_path)
    assert "/quartz/static/styles/fonts/test.woff2" in missing


def test_check_font_families() -> None:
    """
    Test font family declaration checking.
    """
    css_content = """
        @font-face {
            font-family: 'DeclaredFont';
            src: url('/fonts/test.woff2');
        }
        body {
            --font-test: "UndeclaredFont", serif;
        }
    """

    missing = source_file_checks.check_font_families(css_content)
    assert "Undeclared font family: undeclaredfont" in missing


def test_check_font_families_with_opentype() -> None:
    """
    Test font family checking with OpenType features.
    """
    css_content = """
        @font-face {
            font-family: 'EBGaramond';
            src: url('/fonts/test.woff2');
        }
        body {
            --font-test: "EBGaramond:+swsh", serif;
            --font-other: "EBGaramond:smcp", monospace;
        }
    """

    missing = source_file_checks.check_font_families(css_content)
    assert len(missing) == 0  # Should not report EBGaramond as missing


def test_check_latex_tags(tmp_path: Path) -> None:
    """
    Test detection of LaTeX \tag{} commands in markdown files.
    """
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()
    git.Repo.init(tmp_path)

    # Create test file with LaTeX tags
    test_file = content_dir / "test.md"
    content = """---
title: Test Post
description: Test Description
permalink: /test
---
# Math Content

Valid equation: $x^2 + y^2 = z^2$
Invalid tag: $$x^2 \\tag{1}$$
Another invalid: $\\tag{eq:test}$
"""
    test_file.write_text(content)

    # Test direct function
    errors = source_file_checks.check_latex_tags(content, test_file)
    assert len(errors) == 2
    assert all("LaTeX \\tag{} found at line" in error for error in errors)


@pytest.mark.parametrize(
    "content,expected_count",
    [
        ("No tags here", 0),
        ("One \\tag{1}", 1),
        ("$$x^2 \\tag{1}$$ and \\tag{2}", 2),
        ("Escaped \\\\tag{1}", 0),  # Escaped backslash shouldn't count
        ("```math\n\\tag{1}\n```", 1),  # Should detect in code blocks too
    ],
)
def test_latex_tags_variations(
    tmp_path: Path, content: str, expected_count: int
) -> None:
    """
    Test various scenarios for LaTeX tag detection.

    Args:
        tmp_path: Pytest fixture providing temporary directory
        content: Test content to check
        expected_count: Expected number of tag violations
    """
    test_file = tmp_path / "test.md"
    test_file.write_text(content)

    errors = source_file_checks.check_latex_tags(content, test_file)
    assert len(errors) == expected_count


@pytest.mark.parametrize(
    "test_case",
    [
        # Test case 1: Valid bidirectional relationship
        {
            "posts": {
                "/post1": {"permalink": "/post1", "next-post-slug": "/post2"},
                "/post2": {"permalink": "/post2", "prev-post-slug": "/post1"},
            },
            "check_permalink": "/post1",
            "expected_errors": [],
            "description": "valid bidirectional relationship",
        },
        # Test case 2: Missing reverse relationship
        {
            "posts": {
                "/post1": {"permalink": "/post1", "next-post-slug": "/post2"},
                "/post2": {"permalink": "/post2"},
            },
            "check_permalink": "/post1",
            "expected_errors": [
                "Post /post2 should have prev-post-slug=/post1; currently has "
            ],
            "description": "missing reverse relationship",
        },
        # Test case 3: Invalid reverse relationship
        {
            "posts": {
                "/post1": {"permalink": "/post1", "next-post-slug": "/post2"},
                "/post2": {"permalink": "/post2", "prev-post-slug": "/post3"},
            },
            "check_permalink": "/post1",
            "expected_errors": [
                "Post /post2 should have prev-post-slug=/post1; currently has /post3"
            ],
            "description": "incorrect reverse relationship",
        },
        # Test case 4: Non-existent target post
        {
            "posts": {
                "/post1": {
                    "permalink": "/post1",
                    "next-post-slug": "/nonexistent",
                },
            },
            "check_permalink": "/post1",
            "expected_errors": [
                "Could not find post with permalink /nonexistent"
            ],
            "description": "non-existent target post",
        },
        # Test case 5: Both prev and next relationships valid
        {
            "posts": {
                "/post1": {"permalink": "/post1", "next-post-slug": "/post2"},
                "/post2": {
                    "permalink": "/post2",
                    "prev-post-slug": "/post1",
                    "next-post-slug": "/post3",
                },
                "/post3": {"permalink": "/post3", "prev-post-slug": "/post2"},
            },
            "check_permalink": "/post2",
            "expected_errors": [],
            "description": "valid prev and next relationships",
        },
    ],
)
def test_check_sequence_relationships(test_case: Dict[str, Any]) -> None:
    """
    Test checking bidirectional relationships between posts using next/prev post slugs.

    Args:
        test_case: Dictionary containing test data including:
            - posts: Dictionary of posts with their metadata
            - check_permalink: Permalink of the post to check
            - expected_errors: List of expected error messages
            - description: Description of the test case
    """
    errors = source_file_checks.check_sequence_relationships(
        test_case["check_permalink"], test_case["posts"]
    )
    assert errors == test_case["expected_errors"], (
        f"Failed test case: {test_case['description']}\n"
        f"Expected: {test_case['expected_errors']}\n"
        f"Got: {errors}"
    )


def test_check_sequence_relationships_invalid_input() -> None:
    """
    Test check_sequence_relationships with invalid input.
    """
    # Test with empty permalink
    with pytest.raises(ValueError, match="Invalid permalink"):
        source_file_checks.check_sequence_relationships("", {})

    # Test with non-existent permalink
    with pytest.raises(ValueError, match="Invalid permalink /nonexistent"):
        source_file_checks.check_sequence_relationships(
            "/nonexistent", {"/post1": {"permalink": "/post1"}}
        )


@pytest.mark.parametrize(
    "test_case",
    [
        # Test case 1: Matching titles
        {
            "current": {
                "next-post-title": "Next Post",
                "title": "Current Post",
            },
            "target": {"title": "Next Post"},
            "target_slug": "/next-post",
            "direction": "next",
            "expected_errors": [],
            "description": "matching titles",
        },
        # Test case 2: Mismatched titles
        {
            "current": {
                "next-post-title": "Expected Title",
                "title": "Current Post",
            },
            "target": {"title": "Actual Different Title"},
            "target_slug": "/next-post",
            "direction": "next",
            "expected_errors": [
                "next-post-title mismatch: expected 'Expected Title', but /next-post has title 'Actual Different Title'"
            ],
            "description": "mismatched titles",
        },
        # Test case 3: Missing title field in target
        {
            "current": {
                "prev-post-title": "Previous Post",
                "title": "Current Post",
            },
            "target": {},
            "target_slug": "/prev-post",
            "direction": "prev",
            "expected_errors": [
                "prev-post-title mismatch: expected 'Previous Post', but /prev-post has title ''"
            ],
            "description": "missing title in target",
        },
        # Test case 4: No title field in current post
        {
            "current": {"title": "Current Post"},
            "target": {"title": "Next Post"},
            "target_slug": "/next-post",
            "direction": "next",
            "expected_errors": [],
            "description": "no title field to check",
        },
        # Test case 5: Empty title in target
        {
            "current": {
                "next-post-title": "Expected Title",
                "title": "Current Post",
            },
            "target": {"title": ""},
            "target_slug": "/next-post",
            "direction": "next",
            "expected_errors": [
                "next-post-title mismatch: expected 'Expected Title', but /next-post has title ''"
            ],
            "description": "empty title in target",
        },
    ],
)
def test_check_post_titles(test_case: Dict[str, Any]) -> None:
    """
    Test checking titles between linked posts.

    Args:
        test_case: Dictionary containing test data including:
            - current: Metadata of the current post
            - target: Metadata of the target post
            - target_slug: Permalink of the target post
            - direction: Direction of the link ('next' or 'prev')
            - expected_errors: List of expected error messages
            - description: Description of the test case
    """
    errors = source_file_checks.check_post_titles(
        test_case["current"],
        test_case["target"],
        test_case["target_slug"],
        test_case["direction"],
    )
    assert errors == test_case["expected_errors"], (
        f"Failed test case: {test_case['description']}\n"
        f"Expected: {test_case['expected_errors']}\n"
        f"Got: {errors}"
    )


@pytest.fixture
def create_test_file(tmp_path: Path) -> Callable[[str, str], Path]:
    """
    Fixture providing a function to create test markdown files with given content.
    """

    def _create_file(filename: str, content: str) -> Path:
        file_path = tmp_path / filename
        file_path.write_text(content)
        return file_path

    return _create_file


def test_build_sequence_data_basic(create_test_file: Callable) -> None:
    """
    Test basic functionality of _build_sequence_data with a single file.
    """
    content = """---
title: Test Post
permalink: /test
next-post-slug: /next
prev-post-slug: /prev
next-post-title: Next Post
prev-post-title: Previous Post
---
Test content
"""
    file_path = create_test_file("test.md", content)

    sequence_data = source_file_checks.build_sequence_data([file_path])

    expected_mapping = {
        "/test": {
            "title": "Test Post",
            "next-post-slug": "/next",
            "prev-post-slug": "/prev",
            "next-post-title": "Next Post",
            "prev-post-title": "Previous Post",
        }
    }

    assert sequence_data == expected_mapping


def test_build_sequence_data_with_aliases(create_test_file: Callable) -> None:
    """
    Test _build_sequence_data with a file containing aliases.
    """
    content = """---
title: Test Post
permalink: /test
aliases: [/alias1, /alias2]
next-post-slug: /next
---
Test content
"""
    file_path = create_test_file("test.md", content)

    sequence_data = source_file_checks.build_sequence_data([file_path])

    expected_mapping = {
        "/test": {"title": "Test Post", "next-post-slug": "/next"},
        "/alias1": {"title": "Test Post", "next-post-slug": "/next"},
        "/alias2": {"title": "Test Post", "next-post-slug": "/next"},
    }

    assert sequence_data == expected_mapping


def test_build_sequence_data_multiple_files(
    create_test_file: Callable,
) -> None:
    """
    Test _build_sequence_data with multiple files having different combinations of fields.
    """
    file1_content = """---
title: First Post
permalink: /first
next-post-slug: /second
next-post-title: Second Post
---
"""
    file2_content = """---
title: Second Post
permalink: /second
prev-post-slug: /first
prev-post-title: First Post
aliases: [/second-alias]
---
"""
    file3_content = """---
title: Third Post
permalink: /third
---
"""

    files = [
        create_test_file("first.md", file1_content),
        create_test_file("second.md", file2_content),
        create_test_file("third.md", file3_content),
    ]

    sequence_data = source_file_checks.build_sequence_data(files)

    expected_mapping = {
        "/first": {
            "title": "First Post",
            "next-post-slug": "/second",
            "next-post-title": "Second Post",
        },
        "/second": {
            "title": "Second Post",
            "prev-post-slug": "/first",
            "prev-post-title": "First Post",
        },
        "/second-alias": {
            "title": "Second Post",
            "prev-post-slug": "/first",
            "prev-post-title": "First Post",
        },
        "/third": {"title": "Third Post"},
    }

    assert sequence_data == expected_mapping


def test_build_sequence_data_empty_cases(create_test_file: Callable) -> None:
    """
    Test _build_sequence_data with edge cases like empty metadata and empty aliases.
    """
    # File with empty metadata
    file1_content = """---
---
Content only
"""

    # File with empty alias
    file2_content = """---
title: Test Post
permalink: /test
aliases: [""]
---
"""

    files = [
        create_test_file("empty_meta.md", file1_content),
        create_test_file("empty_alias.md", file2_content),
    ]

    sequence_data = source_file_checks.build_sequence_data(files)

    expected_mapping = {"/test": {"title": "Test Post"}}

    assert sequence_data == expected_mapping


def test_build_sequence_data_no_files() -> None:
    """
    Test _build_sequence_data with an empty list of files.
    """
    sequence_data = source_file_checks.build_sequence_data([])
    assert sequence_data == {}


@pytest.mark.parametrize(
    "metadata,mock_response,expected_errors",
    [
        # Test case 1: No card_image field
        ({}, None, []),
        # Test case 2: Invalid URL (not http/https)
        (
            {"card_image": "invalid-url.jpg"},
            None,
            ["Card image URL 'invalid-url.jpg' must be a remote URL"],
        ),
        # Test case 3: Valid URL with successful response
        (
            {"card_image": "https://example.com/image.jpg"},
            type("Response", (), {"ok": True}),
            [],
        ),
        # Test case 4: Valid URL with error response
        (
            {"card_image": "https://example.com/missing.jpg"},
            type("Response", (), {"ok": False, "status_code": 404}),
            [
                "Card image URL 'https://example.com/missing.jpg' returned status 404"
            ],
        ),
    ],
)
def test_check_card_image(
    metadata: dict, mock_response: Any, expected_errors: List[str]
) -> None:
    """
    Test checking card image URLs in metadata.
    """
    with patch("requests.head") as mock_head:
        if mock_response is not None:
            mock_head.return_value = mock_response

        errors = source_file_checks.check_card_image(metadata)
        assert errors == expected_errors


def test_check_card_image_request_exception() -> None:
    """
    Test handling of request exceptions when checking card image URLs.
    """
    metadata = {"card_image": "https://example.com/image.jpg"}

    with patch("requests.head") as mock_head:
        mock_head.side_effect = requests.RequestException("Connection error")

        errors = source_file_checks.check_card_image(metadata)
        assert errors == [
            "Failed to load card image URL 'https://example.com/image.jpg': Connection error"
        ]


def test_check_card_image_sends_user_agent() -> None:
    """
    Test that check_card_image sends a User-Agent header.
    """
    metadata = {"card_image": "https://example.com/image.jpg"}
    with patch("requests.head") as mock_head:
        mock_head.return_value = type("Response", (), {"ok": True})
        source_file_checks.check_card_image(metadata)
        mock_head.assert_called_once()
        _, kwargs = mock_head.call_args
        assert "headers" in kwargs
        assert "User-Agent" in kwargs["headers"]


@pytest.mark.parametrize(
    "content,expected_errors",
    [
        # Test case 1: No tables
        ("No tables here", []),
        # Test case 2: Table with proper alignments
        (
            """
| Header 1 | Header 2 |
|:---------|:--------:|
| Cell 1   | Cell 2   |
""",
            [],
        ),
        # Test case 3: Table with missing alignments
        (
            """
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
""",
            [
                "Table column at line 3 missing alignment (should be :---, ---:, or :---:)"
            ],
        ),
        # Test case 4: Multiple tables with mixed alignments
        (
            """
| Header 1 | Header 2 |
|:---------|:--------:|
| Cell 1   | Cell 2   |

| Header 3 | Header 4 |
|----------|---------:| 
| Cell 3   | Cell 4   |
""",
            [
                "Table column at line 7 missing alignment (should be :---, ---:, or :---:)"
            ],
        ),
        # Test case 5: Table with partial alignments
        (
            """
| Header 1 | Header 2 | Header 3  |
|--------: |----------|----------:|
| Cell 1   | Cell 2   | Cell 3    |
""",
            [
                "Table column at line 3 missing alignment (should be :---, ---:, or :---:)"
            ],
        ),
        # Test case 6: Table with all alignment types
        (
            """
| Left | Center | Right |
|:-----|:------:|------:|
| 1    | 2      | 3     |
""",
            [],
        ),
        # Test case 7: Table with extra spaces
        (
            """
| Header 1 | Header 2 |
|   ----   |   ----   |
| Cell 1   | Cell 2   |
""",
            [
                "Table column at line 3 missing alignment (should be :---, ---:, or :---:)"
            ],
        ),
        # Test case 8: Table with minimum dashes
        (
            """
| H1 | H2 |
|:--|:--:|
| 1  | 2  |
""",
            [],
        ),
        # Test case 9: Single-width column
        (
            """
| Header 1 | Header 2 |
|-|-|
| Cell 1   | Cell 2   |
""",
            [
                "Table column at line 3 missing alignment (should be :---, ---:, or :---:)"
            ],
        ),
    ],
)
def test_check_table_alignments(
    tmp_path: Path, content: str, expected_errors: List[str]
) -> None:
    """
    Test checking markdown table alignments.

    Args:
        tmp_path: Pytest fixture providing temporary directory
        content: Test content containing tables
        expected_errors: List of expected error messages
    """
    test_file = tmp_path / "test.md"
    test_file.write_text(content)

    errors = source_file_checks.check_table_alignments(content)
    assert errors == expected_errors


def test_check_table_alignments_integration(
    tmp_path: Path, monkeypatch
) -> None:
    """
    Integration test for table alignment checking within the main workflow.
    """
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()
    git.Repo.init(tmp_path)

    # Create test file with invalid table
    test_file = content_dir / "test.md"
    content = """---
title: Test Post
description: Test Description
permalink: /test
---
# Table Test

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
"""
    test_file.write_text(content)

    # Mock git root
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: tmp_path
    )

    # Should exit with code 1 due to missing table alignments
    with pytest.raises(SystemExit, match="1"):
        source_file_checks.main()


@pytest.mark.parametrize(
    "content,expected_errors",
    [
        # No braces
        ("No braces here", []),
        # Escaped braces
        ("Escaped \\{ and \\}", []),
        ("Multiple \\{escaped\\} braces", []),
        # Braces at start/end of line
        ("{start of line", ["Unescaped brace found in: {start of line"]),
        ("end of line}", ["Unescaped brace found in: end of line}"]),
        ("{entire line}", []),
        # Braces inside katex
        ("$x^2 + {y^2}$", []),
        ("$$x^2 + {y^2}$$", []),
        ("$$\n{y^2}\n$$", []),
        (
            """$$
> \\overset{\\text{# of permutations of $u$ for which $f_1>f_2$}}{\\big|\\{u_\\phi \\in {S_d \\cdot u}\\mid f_1(u_\\phi)>f_2(u_\\phi)\\}\\big|} \\geq n \\overset{\\text{# of permutations of $u$ for which $f_1<f_2$}}{\\big|\\{u_\\phi \\in S_d \\cdot u\\mid f_1(u_\\phi)<f_2(u_\\phi)\\}\\big|}.
> $$""",
            [],
        ),
        (
            "$math$ {text} $math$",
            [
                "Unescaped brace found in: {text}",
                "Unescaped brace found in: {text}",
            ],  # Math blocks removed, braces remain
        ),
        # Braces inside code block
        ("```\n{x: 1}\n```", []),
        ("`{inline code}`", []),
        (
            "```\n{code}\n``` {text} text",
            [
                "Unescaped brace found in: {text} text",  # Code block removed
                "Unescaped brace found in: {text} text",
            ],
        ),
        (
            "`{code}` {text} text `code2`",
            [
                "Unescaped brace found in: {text} text",  # Inline code removed
                "Unescaped brace found in: {text} text",
            ],
        ),
        # Unescaped braces
        (
            "Text with {unclosed brace",
            ["Unescaped brace found in: Text with {unclosed brace"],
        ),
        (
            "Text with unclosed} brace",
            ["Unescaped brace found in: Text with unclosed} brace"],
        ),
        (
            "Multiple {braces} in {one} line",
            [
                "Unescaped brace found in: Multiple {braces} in {one} line",
                "Unescaped brace found in: Multiple {braces} in {one} line",
                "Unescaped brace found in: Multiple {braces} in {one} line",
                "Unescaped brace found in: Multiple {braces} in {one} line",
            ],
        ),
        # Multiple lines
        (
            "Line 1 with {brace\nLine 2 with} brace",
            [
                "Unescaped brace found in: Line 1 with {brace",
                "Unescaped brace found in: Line 2 with} brace",
            ],
        ),
        # Mixed content
        (
            """
            $math$ {text} text $math$
            ```python
            {code}
            ```
            """,
            [
                # Math and code blocks removed
                "Unescaped brace found in: {text} text",
                "Unescaped brace found in: {text} text",
            ],
        ),
        # Table with class
        (
            """\n|--|--|\n|Col 1|Col 2|\n\n{.class}""",
            [],
        ),
        # Edge cases
        ("{", ["Unescaped brace found in: {"]),
        ("}", ["Unescaped brace found in: }"]),
        ("\\{text\\}", []),
        ("    {indented}", []),
        ("\t{indented}", []),
        (
            "\\\\{text}",
            [],
        ),
        # Whitespace handling
        (
            "  {text}  ",
            [],
        ),
        (
            "\t{text}\t",
            [],
        ),
        # Unicode characters
        (
            "{你好}",
            [],
        ),
        (
            "你好{text}你好",
            [
                "Unescaped brace found in: 你好{text}你好",
                "Unescaped brace found in: 你好{text}你好",
            ],
        ),
    ],
)
def test_unescaped_braces(
    tmp_path: Path, content: str, expected_errors: List[str]
) -> None:
    """
    Test various scenarios for unescaped braces detection.

    Args:
        tmp_path: Pytest fixture providing temporary directory
        content: Test content to check
        expected_errors: Expected error messages
    """
    test_file = tmp_path / "test.md"
    test_file.write_text(content)

    errors = source_file_checks.check_unescaped_braces(content)
    assert sorted(errors) == sorted(expected_errors)


def test_unescaped_braces_integration(tmp_path: Path, monkeypatch) -> None:
    """
    Integration test for unescaped braces checking within the main workflow.
    """
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()
    git.Repo.init(tmp_path)

    # Create test file with unescaped braces
    test_file = content_dir / "test.md"
    content = """---
title: Test Post
description: Test Description
permalink: /test
---
# Content with Unescaped Braces

This is a {test} with multiple {braces} in the text.

Some math: $x^2 + {y^2}$ and more {text}.

```python
{code}
```
"""
    test_file.write_text(content)

    # Mock git root
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: tmp_path
    )

    # Should exit with code 1 due to unescaped braces
    with pytest.raises(SystemExit, match="1"):
        source_file_checks.main()


@pytest.mark.parametrize(
    "input_text,expected_output",
    [
        # Basic cases
        ("Plain text without code or math", "Plain text without code or math"),
        # Inline code blocks
        ("This is `code` block", "This is  block"),
        ("Multiple `code` `blocks`", "Multiple  "),
        ("`code at start` and end", " and end"),
        ("start and `code at end`", "start and "),
        ("`entire line is code`", ""),
        # Math blocks
        ("This is $math$ block", "This is  block"),
        ("Multiple $math$ $blocks$", "Multiple  "),
        ("$math at start$ and end", " and end"),
        ("start and $math at end$", "start and "),
        ("$entire line is math$", ""),
        # Mixed code and math
        ("Both `code` and $math$", "Both  and "),
        ("`code` with $math$ inside", " with  inside"),
        # Empty patterns
        ("Empty code ``", "Empty code "),
        ("Empty math $$", "Empty math "),
        # Block code and math
        ("$$\nMulti-line\nmath\n$$", ""),
        (
            "```\nMulti-line\ncode\n```",
            "",
        ),
        # Edge cases
        ("`code` at the `end`", " at the "),
        ("$math$ at the $end$", " at the "),
        ("Text with \\$escaped\\$ symbols", "Text with \\$escaped\\$ symbols"),
        ("Text with \\`escaped\\` symbols", "Text with \\`escaped\\` symbols"),
        # Unclosed delimiters
        ("Unclosed `code", "Unclosed `code"),
        ("Unclosed $math", "Unclosed $math"),
        # Multiple lines with mixed content
        (
            "Line with `code`\nAnother line with $math$",
            "Line with \nAnother line with ",
        ),
    ],
)
def test_remove_code_and_math(input_text: str, expected_output: str) -> None:
    """
    Test stripping code and math elements from text.

    Args:
        input_text: Input text with code/math elements
        expected_output: Expected text after stripping
    """
    result = source_file_checks.remove_code_and_math(input_text)
    assert (
        result == expected_output
    ), f"Failed to strip code and math from: {input_text}"


@pytest.mark.parametrize(
    "input_text,expected_output",
    [
        ("$x^2$", source_file_checks._REPLACEMENT_CHAR),
        ("`x^2`", source_file_checks._REPLACEMENT_CHAR),
        (
            "```python\nprint('Hello, world!')\n```",
            source_file_checks._REPLACEMENT_CHAR,
        ),
        # Intermingled with other text
        (
            "This is a test of $x^2$ and `x^2`",
            "This is a test of {} and {}".format(
                source_file_checks._REPLACEMENT_CHAR,
                source_file_checks._REPLACEMENT_CHAR,
            ),
        ),
    ],
)
def test_remove_code_and_math_with_replacement_character(
    input_text: str, expected_output: str
) -> None:
    """
    Test removing code and math elements with the replacement character.
    """
    result = source_file_checks.remove_code_and_math(
        input_text, mark_boundaries=True
    )
    assert result == expected_output


def test_remove_code_and_math_with_fenced_blocks() -> None:
    """
    Test stripping fenced code blocks specifically, which should be handled by
    regex with the DOTALL flag.
    """
    # Current implementation doesn't handle fenced code blocks
    input_text = """
    Normal text.
    
    ```python
    def example():
        return "This is code"
    ```
    
    More text.
    """

    result = source_file_checks.remove_code_and_math(input_text)

    assert "```" not in result
    assert "def example():" not in result
    assert "More text." in result


@pytest.mark.parametrize(
    "input_text,expected_output",
    [
        ("Normal text.", "Normal text."),
        (
            "$$f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x} \\,d\\xi$$",
            "",
        ),
        # Test case with internal $ signs
        (
            """$$
            > \\overset{\\text{# of permutations of $u$ for which $f_1>f_2$}}{\\big|\\{u_\\phi \\in {S_d \\cdot u}\\mid f_1(u_\\phi)>f_2(u_\\phi)\\}\\big|}
            $$""",
            "",
        ),
        # Quoted code block
        (
            """```typescript
>     new RegExp(`\\b(?<!\\.)((?:p\\.?)?\\d+${chr}?)-(${chr}?\\d+)(?!\\.\\d)\\b`, "g"),
> ```""",
            "",
        ),
    ],
)
def test_remove_code_and_math_with_block_math(
    input_text: str, expected_output: str
) -> None:
    """
    Test stripping multi-line math blocks.
    """
    result = source_file_checks.remove_code_and_math(input_text)
    assert result == expected_output


@pytest.mark.parametrize(
    "slug,metadata,expected",
    [
        # Test case 1: Slug matches permalink
        ("/test", {"permalink": "/test"}, True),
        # Test case 2: Slug matches an alias
        (
            "/alias",
            {"permalink": "/test", "aliases": ["/alias", "/other"]},
            True,
        ),
        # Test case 3: Slug doesn't match permalink or any alias
        (
            "/notfound",
            {"permalink": "/test", "aliases": ["/alias", "/other"]},
            False,
        ),
        # Test case 4: Aliases field doesn't exist
        ("/alias", {"permalink": "/test"}, False),
        # Test case 5: Aliases field is empty
        ("/alias", {"permalink": "/test", "aliases": []}, False),
        # Test case 6: Permalink doesn't match but exists
        ("/notfound", {"permalink": "/test"}, False),
        # Test case 7: Slug matches an alias in a string (not list) aliases field
        ("/alias", {"permalink": "/test", "aliases": "/alias"}, True),
        # Test case 8: Slug doesn't match the string alias
        ("/notfound", {"permalink": "/test", "aliases": "/alias"}, False),
    ],
)
def test_slug_in_metadata(slug: str, metadata: dict, expected: bool) -> None:
    """
    Test the _slug_in_metadata function with various combinations of slug and metadata.

    Args:
        slug: The slug to check for
        metadata: The metadata dictionary to check in
        expected: Whether the slug is expected to be found in the metadata
    """
    result = source_file_checks._slug_in_metadata(slug, metadata)
    assert (
        result == expected
    ), f"Expected {expected} but got {result} for slug '{slug}' in metadata {metadata}"


@pytest.mark.parametrize(
    "video_tag, should_raise",
    [
        # Valid tags (should not raise)
        ("<video autoplay muted></video>", False),
        ('<video controls alt="Test"></video>', False),
        ("<video></video>", False),
        # Invalid tags (should raise ValueError)
        ('<video src="path/to/video.mp4"></video>', True),
        ('<video type="video/webm"></video>', True),
        ('<video controls src="vid.mov" alt="Test"></video>', True),
        ('<video type="video/mp4" autoplay></video>', True),
        # Check spacing variations
        ('<video   src="vid.mp4"></video>', True),
        ('<video type = "video/avi"></video>', True),
        # Ensure it doesn't match src/type in attribute values
        ('<video data-source="src=value"></video>', False),
        ('<video alt="type=something"></video>', False),
    ],
)
def test_validate_video_tag(video_tag: str, should_raise: bool):
    """Tests the validate_video_tags function."""
    with tempfile.NamedTemporaryFile(
        "w", suffix=".md", delete=False
    ) as tmp_file:
        tmp_file.write(video_tag)
    tmp_path = Path(tmp_file.name)

    try:
        issues = source_file_checks.validate_video_tags(video_tag)
    finally:
        tmp_path.unlink()  # Clean up the temporary file

    if should_raise:
        assert issues, f"Expected errors for tag: {video_tag}, but got none."
        assert "forbidden 'src' or 'type' attribute" in issues[0]
    else:
        assert (
            not issues
        ), f"Expected no errors for tag: {video_tag}, but got: {issues}"


@pytest.mark.parametrize(
    "text, expected_errors",
    [
        ('This is a test. "This is a test."', []),
        ('Test " .', ['Forbidden pattern found: " .']),
        ('Test " f', []),
        ('Test "".', []),
        ('Test ."', []),
        ('$Ignore in math mode" .$', []),
        ('" $Ignore in math mode$.', []),  # Don't collapse around math mode
        ('Ignore in code block: ```python\nprint("Hello, world!" .)\n```', []),
        (
            "This is a test) . Betley et al.",
            ["Forbidden pattern found: ) ."],
        ),
    ],
)
def test_check_no_forbidden_patterns(text: str, expected_errors: List[str]):
    """Test the check_no_forbidden_patterns function."""
    errors = source_file_checks.check_no_forbidden_patterns(text)
    assert errors == expected_errors


@pytest.mark.parametrize(
    "text, expected_errors",
    [
        ("This is normal text without any commands.", []),
        (
            "This has a stray command \\test.",
            ["Stray LaTeX command found: \\test"],
        ),
        (
            "This has another \\alpha and \\beta.",
            [
                "Stray LaTeX command found: \\alpha",
                "Stray LaTeX command found: \\beta",
            ],
        ),
        # Should be ignored inside math blocks
        ("This should be ignored: $ \\alpha $.", []),
        ("This should be ignored: $$ \\beta $$", []),
        ("This should be ignored: ` \\gamma `", []),
        ("This should be ignored: ```\n \\delta \n```", []),
        # Mixed content
        (
            "A stray \\command here, but not $ \\ignored $ or ` \\alsoignored `.",
            ["Stray LaTeX command found: \\command"],
        ),
        # The user's regex is r" (\\\w+)". It requires a leading space.
        ("No space before\\command", []),
        (
            " Punctuation before \\command.",
            ["Stray LaTeX command found: \\command"],
        ),
        ("A windows path C:\\Users\\test", []),
        ("A double backslash \\\\alpha should be ignored", []),
    ],
)
def test_check_stray_katex(text: str, expected_errors: List[str]):
    """Test the check_stray_katex function."""
    errors = source_file_checks.check_stray_katex(text)
    assert sorted(errors) == sorted(expected_errors)
