"""Tests for the check_css_vars.fish script."""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.fixture
def fish_script_path() -> Path:
    """Fixture to provide the path to the fish script."""
    root_path = Path(  # TODO turn into util
        subprocess.check_output(
            [shutil.which("git") or "git", "rev-parse", "--show-toplevel"],
            text=True,
        ).strip()
    )
    script_path = root_path / "scripts" / "check_css_vars.fish"
    if not script_path.exists():
        pytest.fail(f"Fish script not found at {script_path}")
    return script_path


def run_script(script_path: Path, *args: str) -> subprocess.CompletedProcess:
    """Helper function to run the fish script."""
    cmd = [shutil.which("fish") or "fish", str(script_path)]
    cmd.extend(args)
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


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

    result = run_script(fish_script_path, str(css_file))

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

    result = run_script(fish_script_path, str(css_file))

    assert result.returncode == 1
    assert "Error: Found unknown CSS variable(s):" in result.stdout
    assert "--undefined-var" in result.stdout
    assert "--another-undefined" in result.stdout
