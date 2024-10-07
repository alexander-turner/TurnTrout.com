import pytest
from bs4 import BeautifulSoup
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))

from built_site_checks import (
    check_localhost_links,
    check_invalid_anchors,
    check_problematic_paragraphs,
    parse_html_file,
    check_file_for_issues,
    check_local_media_files,
)

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
def sample_soup(sample_html):
    return BeautifulSoup(sample_html, 'html.parser')

@pytest.fixture
def temp_site_root(tmp_path):
    return tmp_path

def test_check_localhost_links(sample_soup):
    result = check_localhost_links(sample_soup)
    if result != ['http://localhost:8000']:
        raise AssertionError

def test_check_invalid_anchors(sample_soup, temp_site_root):
    result = check_invalid_anchors(sample_soup, temp_site_root / "test.html", temp_site_root)
    if set(result) != {'#invalid-anchor', '/other-page#invalid-anchor'}:
        raise AssertionError

def test_check_problematic_paragraphs(sample_soup):
    result = check_problematic_paragraphs(sample_soup)
    assert len(result) == 3
    if 'Table: This is a table description' not in result:
        raise AssertionError
    if 'Figure: This is a figure caption' not in result:
        raise AssertionError
    if 'Code: This is a code snippet' not in result:
        raise AssertionError
    if "Normal paragraph" in result:
        raise AssertionError
    if "This is a delayed-paragraph Table: " in result:
        raise AssertionError

def test_parse_html_file(tmp_path):
    file_path = tmp_path / "test.html"
    file_path.write_text("<html><body><p>Test</p></body></html>")
    result = parse_html_file(file_path)
    assert isinstance(result, BeautifulSoup)
    if result.find('p').text != 'Test':
        raise AssertionError

def test_check_file_for_issues(tmp_path):
    file_path = tmp_path / "test.html"
    file_path.write_text("""
    <html>
    <body>
        <a href="https://localhost:8000">Localhost Link</a>
        <a href="#invalid-anchor">Invalid Anchor</a>
        <p>Table: Test table</p>
    </body>
    </html>
    """)
    localhost_links, invalid_anchors, problematic_paragraphs = check_file_for_issues(file_path, tmp_path)
    if localhost_links != ['https://localhost:8000']:
        raise AssertionError
    if invalid_anchors != ['#invalid-anchor']:
        raise AssertionError
    if problematic_paragraphs != ['Table: Test table']:
        raise AssertionError

def test_check_local_media_files(sample_soup, temp_site_root):
    # Create an existing image file
    (temp_site_root / "existing-image.jpg").touch()
    (temp_site_root / "existing-video.mp4").touch()

    result = check_local_media_files(sample_soup, temp_site_root / "test.html", temp_site_root)
    if set(result) != {'missing-image.png', 'missing-svg.svg'}:
        raise AssertionError

def test_check_file_for_issues(tmp_path):
    file_path = tmp_path / "test.html"
    file_path.write_text("""
    <html>
    <body>
        <a href="https://localhost:8000">Localhost Link</a>
        <a href="#invalid-anchor">Invalid Anchor</a>
        <p>Table: Test table</p>
        <img src="missing-image.jpg" alt="Missing Image">
        <img src="https://example.com/image.png" alt="External Image">
    </body>
    </html>
    """)
    localhost_links, invalid_anchors, problematic_paragraphs, missing_media_files = check_file_for_issues(file_path, tmp_path)
    if localhost_links != ['https://localhost:8000']:
        raise AssertionError
    if invalid_anchors != ['#invalid-anchor']:
        raise AssertionError
    if problematic_paragraphs != ['Table: Test table']:
        raise AssertionError
    if missing_media_files != ['missing-image.jpg']:
        raise AssertionError

@pytest.mark.parametrize("html,expected", [
    ('<img src="local.jpg">', ['local.jpg']),
    ('<img src="https://example.com/image.png">', []),
    ('<video src="video.mp4"></video>', ['video.mp4']),
    ('<svg src="icon.svg"></svg>', ['icon.svg']),
    ('<img src="existing.png">', []),
])
def test_check_local_media_files_parametrized(html, expected, temp_site_root):
    soup = BeautifulSoup(html, 'html.parser')
    (temp_site_root / "existing.png").touch()
    result = check_local_media_files(soup, temp_site_root / "test.html", temp_site_root)
    if result != expected:
        raise AssertionError
