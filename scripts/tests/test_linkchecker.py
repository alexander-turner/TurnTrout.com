import http.server
import os
import shutil
import socketserver
import subprocess
import threading
import time

import pytest

# Disable parallel execution for this test file to avoid port conflicts
pytestmark = [
    pytest.mark.xdist_group(name="linkchecker_serial"),
    pytest.mark.skipif(
        shutil.which("linkchecker") is None,
        reason="linkchecker not found",
    ),
]


@pytest.fixture
def test_html_content():
    """HTML content with both internal and external link errors."""
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Link Checker Test</title>
  </head>
  <body>
    <a href="invalid-url:w">Invalid URL</a>
    <img src="https://assets.turntrout.com/invalid-asset.jpg" alt="Invalid Asset" />
  </body>
</html>
"""


@pytest.fixture
def test_server_and_files(tmp_path, test_html_content):
    """Set up a local HTTP server and create test HTML files in public
    directory."""
    # Create a temporary directory structure with mock git repo
    tmp_dir = tmp_path / "linkchecker_test"
    tmp_dir.mkdir()

    # Initialize a minimal git repository using git init
    subprocess.run(
        ["git", "init"], cwd=str(tmp_dir), capture_output=True, check=True
    )

    # Create public directory
    public_dir = tmp_dir / "public"
    public_dir.mkdir(parents=True)

    # Write test HTML file to public directory
    test_file = public_dir / "test.html"
    test_file.write_text(test_html_content)

    # Use a dynamic port since 8080 may be in use by the dev server
    # We'll modify the linkchecker script call to use this port
    handler = http.server.SimpleHTTPRequestHandler

    # Change to the public directory for serving
    original_dir = os.getcwd()
    os.chdir(public_dir)

    # Create a TCPServer with dynamic port allocation
    class ReuseTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

        def server_close(self):
            """Ensure socket is properly closed."""
            super().server_close()

    # Use port 0 for dynamic allocation
    httpd = ReuseTCPServer(("", 0), handler)
    actual_port = httpd.server_address[1]

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    # Give the server a moment to start
    time.sleep(0.5)

    yield {
        "tmp_dir": tmp_dir,
        "public_dir": public_dir,
        "server": httpd,
        "port": actual_port,
    }

    # Cleanup
    httpd.shutdown()
    httpd.server_close()
    os.chdir(original_dir)


@pytest.fixture
def html_linkchecker_result(test_server_and_files):
    """Run the linkchecker script with the test setup."""
    tmp_dir = test_server_and_files["tmp_dir"]
    port = test_server_and_files["port"]

    # Run linkchecker directly instead of using the fish script
    # This allows us to use the dynamic port
    local_server = f"http://localhost:{port}"

    # Internal link check
    internal_result = subprocess.run(
        ["linkchecker", local_server, "--threads", "50"],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(tmp_dir),
    )

    # External link check
    public_dir = test_server_and_files["public_dir"]
    target_files = list(public_dir.glob("**/*.html"))

    external_result = subprocess.run(
        [
            "linkchecker",
            *[str(f) for f in target_files],
            "--ignore-url=!^https://(assets\\.turntrout\\.com|github\\.com/alexander-turner/TurnTrout\\.com)",
            "--check-extern",
            "--threads",
            "30",
            "--user-agent",
            "linkchecker",
            "--timeout",
            "40",
        ],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(tmp_dir),
    )

    # Combine results similar to the fish script
    combined_stderr = f"Link checks failed: \nInternal linkchecker: {internal_result.returncode}\nExternal linkchecker: {external_result.returncode}\n"

    # Create a mock result that matches what the fish script would return
    class MockResult:
        def __init__(self):
            self.returncode = (
                1
                if (
                    internal_result.returncode != 0
                    or external_result.returncode != 0
                )
                else 0
            )
            self.stdout = internal_result.stdout + "\n" + external_result.stdout
            self.stderr = combined_stderr

    return MockResult()


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
