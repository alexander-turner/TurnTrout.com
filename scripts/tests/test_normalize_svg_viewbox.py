"""Tests for normalize_svg_viewbox.py."""

import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

sys.path.append(str(Path(__file__).parent.parent))

if TYPE_CHECKING:
    from .. import normalize_svg_viewbox
else:
    import normalize_svg_viewbox


@pytest.fixture
def sample_svg(tmp_path: Path) -> Path:
    """Create a sample SVG file for testing."""
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
    <rect x="10" y="10" width="80" height="30" fill="red"/>
</svg>"""
    svg_file = tmp_path / "test.svg"
    svg_file.write_text(svg_content, encoding="utf-8")
    return svg_file


@pytest.fixture
def square_svg(tmp_path: Path) -> Path:
    """Create a square SVG file for testing."""
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="blue"/>
</svg>"""
    svg_file = tmp_path / "square.svg"
    svg_file.write_text(svg_content, encoding="utf-8")
    return svg_file


@pytest.fixture
def svg_without_viewbox(tmp_path: Path) -> Path:
    """Create an SVG file without a viewBox attribute."""
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect x="0" y="0" width="100" height="100" fill="green"/>
</svg>"""
    svg_file = tmp_path / "no_viewbox.svg"
    svg_file.write_text(svg_content, encoding="utf-8")
    return svg_file


@pytest.fixture
def svg_with_children(tmp_path: Path) -> Path:
    """Create an SVG file with multiple child elements."""
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="50" height="100" viewBox="0 0 50 100">
    <rect x="5" y="5" width="40" height="40" fill="red"/>
    <circle cx="25" cy="75" r="20" fill="blue"/>
</svg>"""
    svg_file = tmp_path / "children.svg"
    svg_file.write_text(svg_content, encoding="utf-8")
    return svg_file


@pytest.fixture
def svg_empty_children(tmp_path: Path) -> Path:
    """Create an SVG file with no child elements."""
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
</svg>"""
    svg_file = tmp_path / "empty.svg"
    svg_file.write_text(svg_content, encoding="utf-8")
    return svg_file


def test_check_inkscape_found(monkeypatch: pytest.MonkeyPatch):
    """Test check_inkscape when Inkscape is found."""
    monkeypatch.setattr(
        "shutil.which",
        lambda cmd: "/usr/bin/inkscape" if cmd == "inkscape" else None,
    )
    assert normalize_svg_viewbox.check_inkscape() is True


def test_check_inkscape_not_found(monkeypatch: pytest.MonkeyPatch):
    """Test check_inkscape when Inkscape is not found."""
    monkeypatch.setattr("shutil.which", lambda cmd: None)
    assert normalize_svg_viewbox.check_inkscape() is False


def test_fix_svg_viewbox_rectangular(sample_svg: Path):
    """Test fix_svg_viewbox with a rectangular SVG."""
    normalize_svg_viewbox.fix_svg_viewbox(sample_svg, 24)

    # Read the modified SVG
    content = sample_svg.read_text(encoding="utf-8")

    # Check that viewBox is square
    assert 'viewBox="0 0 24 24"' in content

    # Check that width and height attributes are removed from root svg element
    # (but may still exist in child elements like <rect>)
    lines = content.split("\n")
    svg_line = [line for line in lines if line.strip().startswith("<svg")][0]
    assert "width=" not in svg_line
    assert "height=" not in svg_line

    # Check that children are wrapped in a group with transform
    assert "<g transform=" in content
    assert "translate(" in content
    assert "scale(" in content


def test_fix_svg_viewbox_square(square_svg: Path):
    """Test fix_svg_viewbox with an already square SVG."""
    normalize_svg_viewbox.fix_svg_viewbox(square_svg, 24)

    content = square_svg.read_text(encoding="utf-8")
    assert 'viewBox="0 0 24 24"' in content
    assert "width=" not in content
    assert "height=" not in content


def test_fix_svg_viewbox_no_viewbox(svg_without_viewbox: Path):
    """Test fix_svg_viewbox with an SVG without a viewBox."""
    normalize_svg_viewbox.fix_svg_viewbox(svg_without_viewbox, 24)

    content = svg_without_viewbox.read_text(encoding="utf-8")
    assert 'viewBox="0 0 24 24"' in content


def test_fix_svg_viewbox_with_children(svg_with_children: Path):
    """Test fix_svg_viewbox with SVG containing multiple children."""
    normalize_svg_viewbox.fix_svg_viewbox(svg_with_children, 24)

    content = svg_with_children.read_text(encoding="utf-8")
    assert 'viewBox="0 0 24 24"' in content
    # Check that children are wrapped in a group
    assert "<g transform=" in content
    # Both original children should be present
    assert "<rect" in content
    assert "<circle" in content


def test_fix_svg_viewbox_empty_children(svg_empty_children: Path):
    """Test fix_svg_viewbox with SVG that has no children."""
    normalize_svg_viewbox.fix_svg_viewbox(svg_empty_children, 24)

    content = svg_empty_children.read_text(encoding="utf-8")
    assert 'viewBox="0 0 24 24"' in content
    # No group should be created if there are no children
    assert "<g transform=" not in content


def test_fix_svg_viewbox_custom_size(sample_svg: Path):
    """Test fix_svg_viewbox with a custom target size."""
    normalize_svg_viewbox.fix_svg_viewbox(sample_svg, 48)

    content = sample_svg.read_text(encoding="utf-8")
    assert 'viewBox="0 0 48 48"' in content


def test_normalize_svg_viewbox_success(sample_svg: Path, mock_subprocess_run):
    """Test normalize_svg_viewbox when Inkscape is available."""
    with (
        patch("normalize_svg_viewbox.check_inkscape", return_value=True),
        patch("builtins.print") as mock_print,
    ):
        normalize_svg_viewbox.normalize_svg_viewbox(sample_svg, 24)

    # Check that Inkscape was called
    mock_subprocess_run.assert_called_once()
    call_args = mock_subprocess_run.call_args[0][0]
    assert (
        call_args[0].endswith("inkscape")
        or call_args[0] == "/usr/bin/inkscape"
        or call_args[0] == "/usr/local/bin/inkscape"
    )
    assert str(sample_svg) in call_args

    # Check that fix_svg_viewbox was called (viewBox should be set)
    content = sample_svg.read_text(encoding="utf-8")
    assert 'viewBox="0 0 24 24"' in content

    # Check print was called
    mock_print.assert_called_once()
    assert "Normalized" in mock_print.call_args[0][0]


def test_normalize_svg_viewbox_inkscape_not_found(sample_svg: Path):
    """Test normalize_svg_viewbox when Inkscape is not available."""
    with patch("normalize_svg_viewbox.check_inkscape", return_value=False):
        with pytest.raises(RuntimeError, match="Inkscape not found"):
            normalize_svg_viewbox.normalize_svg_viewbox(sample_svg, 24)


def test_normalize_svg_viewbox_default_size(
    sample_svg: Path, mock_subprocess_run
):
    """Test normalize_svg_viewbox with default size."""
    with (
        patch("normalize_svg_viewbox.check_inkscape", return_value=True),
        patch("builtins.print"),
    ):
        normalize_svg_viewbox.normalize_svg_viewbox(sample_svg)

    content = sample_svg.read_text(encoding="utf-8")
    assert 'viewBox="0 0 24 24"' in content


def test_main_success(
    sample_svg: Path, mock_subprocess_run, monkeypatch: pytest.MonkeyPatch
):
    """Test main() with successful normalization."""
    monkeypatch.setattr(
        "sys.argv", ["normalize_svg_viewbox.py", str(sample_svg)]
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)
    monkeypatch.setattr("builtins.print", lambda *args, **kwargs: None)

    result = normalize_svg_viewbox.main()
    assert result == 0
    mock_subprocess_run.assert_called_once()


def test_main_inkscape_not_found(
    sample_svg: Path, monkeypatch: pytest.MonkeyPatch, capsys
):
    """Test main() when Inkscape is not found."""
    monkeypatch.setattr(
        "sys.argv", ["normalize_svg_viewbox.py", str(sample_svg)]
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: False)

    result = normalize_svg_viewbox.main()
    assert result == 1
    captured = capsys.readouterr()
    assert "Inkscape not found" in captured.err


def test_main_file_not_found(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys
):
    """Test main() when file does not exist."""
    nonexistent_file = tmp_path / "nonexistent.svg"
    monkeypatch.setattr(
        "sys.argv", ["normalize_svg_viewbox.py", str(nonexistent_file)]
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)

    result = normalize_svg_viewbox.main()
    assert result == 0  # Continues processing other files
    captured = capsys.readouterr()
    assert "does not exist" in captured.err


def test_main_non_svg_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys
):
    """Test main() with a non-SVG file."""
    txt_file = tmp_path / "test.txt"
    txt_file.write_text("not an svg")
    monkeypatch.setattr(
        "sys.argv", ["normalize_svg_viewbox.py", str(txt_file)]
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)

    result = normalize_svg_viewbox.main()
    assert result == 0
    captured = capsys.readouterr()
    assert "is not an SVG file" in captured.out


def test_main_dry_run(
    sample_svg: Path, monkeypatch: pytest.MonkeyPatch, capsys
):
    """Test main() with --dry-run flag."""
    monkeypatch.setattr(
        "sys.argv", ["normalize_svg_viewbox.py", "--dry-run", str(sample_svg)]
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)

    result = normalize_svg_viewbox.main()
    assert result == 0
    captured = capsys.readouterr()
    assert "Would normalize" in captured.out
    # File should not be modified
    original_content = sample_svg.read_text(encoding="utf-8")
    assert 'viewBox="0 0 100 50"' in original_content


def test_main_custom_size(
    sample_svg: Path, mock_subprocess_run, monkeypatch: pytest.MonkeyPatch
):
    """Test main() with custom --size argument."""
    monkeypatch.setattr(
        "sys.argv",
        ["normalize_svg_viewbox.py", "--size", "48", str(sample_svg)],
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)
    monkeypatch.setattr("builtins.print", lambda *args, **kwargs: None)

    result = normalize_svg_viewbox.main()
    assert result == 0

    content = sample_svg.read_text(encoding="utf-8")
    assert 'viewBox="0 0 48 48"' in content


def test_main_multiple_files(
    sample_svg: Path,
    square_svg: Path,
    mock_subprocess_run,
    monkeypatch: pytest.MonkeyPatch,
):
    """Test main() with multiple SVG files."""
    monkeypatch.setattr(
        "sys.argv",
        ["normalize_svg_viewbox.py", str(sample_svg), str(square_svg)],
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)
    monkeypatch.setattr("builtins.print", lambda *args, **kwargs: None)

    result = normalize_svg_viewbox.main()
    assert result == 0
    # Should be called twice (once per file)
    assert mock_subprocess_run.call_count == 2


def test_main_runtime_error(
    sample_svg: Path, monkeypatch: pytest.MonkeyPatch, capsys
):
    """Test main() when normalize_svg_viewbox raises RuntimeError."""
    monkeypatch.setattr(
        "sys.argv", ["normalize_svg_viewbox.py", str(sample_svg)]
    )
    monkeypatch.setattr("normalize_svg_viewbox.check_inkscape", lambda: True)
    # Mock normalize_svg_viewbox to raise RuntimeError directly
    with patch(
        "normalize_svg_viewbox.normalize_svg_viewbox"
    ) as mock_normalize:
        mock_normalize.side_effect = RuntimeError("Inkscape failed")
        result = normalize_svg_viewbox.main()
        assert result == 0  # Continues processing
        captured = capsys.readouterr()
        assert "Error processing" in captured.err
