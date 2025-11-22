from pathlib import Path

import pytest

from .utils import run_shell_command


@pytest.fixture(scope="session")
def html_linkchecker_result():
    # Use the file's location to find the git root, not the current working directory
    # This ensures we get the actual project root, not a temp test directory
    test_file_dir = Path(__file__).parent.parent.parent

    script_path = test_file_dir / "scripts" / "linkchecker.fish"
    test_html = test_file_dir / "scripts" / "tests" / ".linkchecker.test.html"

    result = run_shell_command(script_path, str(test_html))
    return result


def test_invalid_port_error(html_linkchecker_result):
    assert (
        "Internal linkchecker: 1" in html_linkchecker_result.stderr
    ), "URL error not found in output"
    assert (
        html_linkchecker_result.returncode != 0
    ), "Linkchecker script should have failed"


def test_invalid_asset_error(html_linkchecker_result):
    assert (
        "External linkchecker: 1" in html_linkchecker_result.stderr
    ), "Invalid asset error not found in output"
    assert (
        html_linkchecker_result.returncode != 0
    ), "Linkchecker script should have failed"


if __name__ == "__main__":
    pytest.main([__file__])
