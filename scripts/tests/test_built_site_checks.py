import pytest
from bs4 import BeautifulSoup
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..built_site_checks import *
else:
    from built_site_checks import *


@pytest.fixture
def sample_html():
    return """
    <html>
    <body>
        <a href="http://localhost:8000">Localhost Link</a>
        <a href="https://turntrout.com">Turntrout Link</a>
        <a href="/other-page#invalid-anchor">Turntrout Link with Anchor</a>
        <a href="#valid-anchor">Valid Anchor</a>
        <a href="#invalid-anchor">Invalid Anchor</a>
        <div id="valid-anchor">Valid Anchor Content</div>
        <p>Normal paragraph</p>
        <p>Table: This is a table description</p>
        <p>This is a delayed-paragraph Table: </p>
        <p>Figure: This is a figure caption</p>
        <p>Code: This is a code snippet</p>
        <img src="existing-image.jpg" alt="Existing Image">
        <img src="missing-image.png" alt="Missing Image">
        <video src="existing-video.mp4"></video>
        <svg src="missing-svg.svg"></svg>
    </body>
    </html>
    """


@pytest.fixture
def sample_html_with_katex_errors():
    return """
    <html>
    <body>
        <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord text" style="color:#cc0000;"><span class="mord" style="color:#cc0000;">\\rewavcxx</span></span></span></span></span>
    </body>
    </html>
    """


@pytest.fixture
def sample_soup(sample_html):
    return BeautifulSoup(sample_html, "html.parser")


@pytest.fixture
def temp_site_root(tmp_path):
    return tmp_path


@pytest.fixture
def sample_html_with_assets():
    return """
    <html>
    <head>
        <link rel="stylesheet" href="/styles/main.css">
        <link rel="preload" href="./index.css" as="style" onload="this.rel='stylesheet'">
        <script src="/js/script.js"></script>
    </head>
    <body>
        <img src="../images/photo.jpg">
    </body>
    </html>
    """


@pytest.fixture
def sample_soup_with_assets(sample_html_with_assets):
    return BeautifulSoup(sample_html_with_assets, "html.parser")


def test_check_localhost_links(sample_soup):
    result = check_localhost_links(sample_soup)
    assert result == ["http://localhost:8000"]


def test_check_invalid_anchors(sample_soup, temp_site_root):
    result = check_invalid_anchors(
        sample_soup, temp_site_root / "test.html", temp_site_root
    )
    assert set(result) == {"#invalid-anchor", "/other-page#invalid-anchor"}


def test_check_problematic_paragraphs(sample_soup):
    result = check_problematic_paragraphs(sample_soup)
    assert len(result) == 3
    assert "Table: This is a table description" in result
    assert "Figure: This is a figure caption" in result
    assert "Code: This is a code snippet" in result
    assert "Normal paragraph" not in result
    assert "This is a delayed-paragraph Table: " not in result


def test_check_katex_elements_for_errors(sample_html_with_katex_errors):
    html = BeautifulSoup(sample_html_with_katex_errors, "html.parser")
    result = check_katex_elements_for_errors(html)
    assert result == ["\\rewavcxx"]


def test_parse_html_file(tmp_path):
    file_path = tmp_path / "test.html"
    file_path.write_text("<html><body><p>Test</p></body></html>")
    result = parse_html_file(file_path)
    assert isinstance(result, BeautifulSoup)
    assert result.find("p").text == "Test"


def test_check_local_media_files(sample_soup, temp_site_root):
    # Create an existing image file
    (temp_site_root / "existing-image.jpg").touch()
    (temp_site_root / "existing-video.mp4").touch()

    result = check_local_media_files(
        sample_soup, temp_site_root / "test.html", temp_site_root
    )
    assert set(result) == {"missing-image.png", "missing-svg.svg"}


def test_check_file_for_issues(tmp_path):
    file_path = tmp_path / "test.html"
    file_path.write_text(
        """
    <html>
    <body>
        <a href="https://localhost:8000">Localhost Link</a>
        <a href="#invalid-anchor">Invalid Anchor</a>
        <p>Table: Test table</p>
        <img src="missing-image.jpg" alt="Missing Image">
        <img src="https://example.com/image.png" alt="External Image">
        <blockquote>This is a blockquote</blockquote>
        <blockquote>This is a problematic blockquote ></blockquote>
    </body>
    </html>
    """
    )
    issues = check_file_for_issues(file_path, tmp_path)
    assert issues["localhost_links"] == ["https://localhost:8000"]
    assert issues["invalid_anchors"] == ["#invalid-anchor"]
    assert issues["problematic_paragraphs"] == ["Table: Test table"]
    assert issues["missing_media_files"] == ["missing-image.jpg"]
    assert issues["trailing_blockquotes"] == ["This is a problematic blockquote >"]


complicated_blockquote = """
<blockquote class="callout quote" data-callout="quote">
<div class="callout-title"><div class="callout-icon"></div><div class="callout-title-inner"> <a href="https://www.lesswrong.com/posts/2JJtxitp6nqu6ffak/basic-facts-about-language-models-during-training-1#Residual_stream_outliers_grow_rapidly_then_stabilize_and_decline" class="external alias" target="_blank">Basic facts about language models during trai<span style="white-space:nowrap;">ning<img src="https://assets.turntrout.com/static/images/external-favicons/lesswrong_com.avif" class="favicon" alt=""></span></a> &gt; <img src="https://assets.turntrout.com/static/images/posts/m1uteifqbbyox6qp9xnx.avif" alt="" loading="lazy"></div></div>
</blockquote>
"""


def test_complicated_blockquote(tmp_path):
    file_path = tmp_path / "test.html"
    file_path.write_text(complicated_blockquote)
    issues = check_file_for_issues(file_path, tmp_path)
    assert issues["trailing_blockquotes"] == [
        "Basic facts about language models during trai ning..."
    ]


@pytest.mark.parametrize(
    "html,expected",
    [
        ('<img src="local.jpg">', ["local.jpg"]),
        ('<img src="https://example.com/image.png">', []),
        ('<video src="video.mp4"></video>', ["video.mp4"]),
        ('<svg src="icon.svg"></svg>', ["icon.svg"]),
        ('<img src="existing.png">', []),
    ],
)
def test_check_local_media_files_parametrized(html, expected, temp_site_root):
    soup = BeautifulSoup(html, "html.parser")
    (temp_site_root / "existing.png").touch()
    result = check_local_media_files(soup, temp_site_root / "test.html", temp_site_root)
    assert result == expected


def test_check_asset_references_all_missing(sample_soup_with_assets, temp_site_root):
    file_path = temp_site_root / "test.html"

    result = check_asset_references(sample_soup_with_assets, file_path, temp_site_root)

    expected = {
        "/styles/main.css (resolved to styles/main.css)",
        "./index.css (resolved to index.css)",
        "/js/script.js (resolved to js/script.js)",
    }
    assert set(result) == expected


def test_check_asset_references_absolute_paths(temp_site_root):
    html = """
    <html>
    <head>
        <link rel="stylesheet" href="/absolute/path/style.css">
        <script src="/another/absolute/path/script.js"></script>
    </head>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")
    file_path = temp_site_root / "test.html"

    result = check_asset_references(soup, file_path, temp_site_root)

    expected = {
        "/absolute/path/style.css (resolved to absolute/path/style.css)",
        "/another/absolute/path/script.js (resolved to another/absolute/path/script.js)",
    }
    assert set(result) == expected


def test_check_asset_references_ignore_external(temp_site_root):
    html = """
    <html>
    <head>
        <link rel="stylesheet" href="https://example.com/style.css">
        <script src="http://example.com/script.js"></script>
    </head>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")
    file_path = temp_site_root / "test.html"

    result = check_asset_references(soup, file_path, temp_site_root)

    assert result == []
