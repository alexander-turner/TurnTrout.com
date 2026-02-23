"""Tests for the check_css_vars.fish script."""

import shutil
from pathlib import Path

import pytest

from .. import utils as script_utils
from .utils import run_shell_command

pytestmark = pytest.mark.skipif(
    shutil.which("pnpm") is None,
    reason="pnpm not found (node deps not installed)",
)


@pytest.fixture
def fish_script_path() -> Path:
    """Fixture to provide the path to the fish script."""
    root_path = script_utils.get_git_root()
    script_path = root_path / "scripts" / "check_css_vars.fish"
    if not script_path.exists():
        pytest.fail(f"Fish script not found at {script_path}")
    return script_path


def test_check_css_vars_no_errors(
    fish_script_path: Path, tmp_path: Path
) -> None:
    """Test the script with a CSS file containing no undefined variables."""
    css_content = """
:root {
    --valid-var: #fff;
}

body {
    color: var(--valid-var);
}
"""
    css_file = tmp_path / "valid.css"
    css_file.write_text(css_content)

    result = run_shell_command(fish_script_path, str(css_file))

    assert result.returncode == 0
    assert "Error: Found unknown CSS variable(s):" not in result.stderr
    assert "Error: Found unknown CSS variable(s):" not in result.stdout


def test_check_css_vars_with_errors(
    fish_script_path: Path, tmp_path: Path
) -> None:
    """Test the script with a CSS file containing undefined variables."""
    css_content = """
:root {
    --defined-var: #000;
}

body {
    color: var(--undefined-var);
    background-color: var(--another-undefined);
}
"""
    css_file = tmp_path / "invalid.css"
    css_file.write_text(css_content)

    result = run_shell_command(fish_script_path, str(css_file))

    assert result.returncode == 1
    assert "Error: Found unknown CSS variable(s):" in result.stdout
    assert "--undefined-var" in result.stdout
    assert "--another-undefined" in result.stdout
