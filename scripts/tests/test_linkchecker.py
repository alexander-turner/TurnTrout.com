import http.server
import os
import random
import socketserver
import subprocess
import threading
import time
from pathlib import Path

import pytest

from .utils import run_shell_command

# Disable parallel execution for this test file to avoid port conflicts
pytestmark = pytest.mark.xdist_group(name="linkchecker_serial")


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
    """Set up a local HTTP server and create test HTML files in public directory."""
    # Create a temporary directory structure with mock git repo
    tmp_dir = tmp_path / "linkchecker_test"
    tmp_dir.mkdir()
    
    # Initialize a minimal git repository using git init
    subprocess.run(
        ["git", "init"],
        cwd=str(tmp_dir),
        capture_output=True,
        check=True
    )
    
    # Create public directory
    public_dir = tmp_dir / "public"
    public_dir.mkdir(parents=True)
    
    # Write test HTML file to public directory
    test_file = public_dir / "test.html"
    test_file.write_text(test_html_content)
    
    # Start a simple HTTP server on port 8080
    PORT = 8080
    handler = http.server.SimpleHTTPRequestHandler
    
    # Change to the public directory for serving
    original_dir = os.getcwd()
    os.chdir(public_dir)
    
    # Add a small random delay to reduce race conditions in parallel execution
    time.sleep(random.uniform(0.1, 0.3))
    
    # Create a custom TCPServer class that allows port reuse
    class ReusePortTCPServer(socketserver.TCPServer):
        allow_reuse_address = True
        
        def server_bind(self):
            import socket
            # Set SO_REUSEPORT if available (macOS/Linux)
            if hasattr(socket, 'SO_REUSEPORT'):
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
            super().server_bind()
    
    httpd = ReusePortTCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    
    # Give the server a moment to start
    time.sleep(0.5)
    
    yield {"tmp_dir": tmp_dir, "public_dir": public_dir, "server": httpd}
    
    # Cleanup
    httpd.shutdown()
    os.chdir(original_dir)


@pytest.fixture
def html_linkchecker_result(test_server_and_files):
    """Run the linkchecker script with the test setup."""
    test_file_dir = Path(__file__).parent.parent.parent
    script_path = test_file_dir / "scripts" / "linkchecker.fish"
    tmp_dir = test_server_and_files["tmp_dir"]
    
    # Run the script from within the temp git repository
    result_with_cwd = subprocess.run(
        ["/opt/homebrew/bin/fish", str(script_path)],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(tmp_dir)
    )
    
    return result_with_cwd


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
