"""Tests for scripts/configure_timestamps_remote.sh.

The .timestamps repo lives inside the project, which claude-guard bind-mounts
writable into the sandbox — so any auth the helper writes into its .git/config
in a *local* run lands on the host and outlives the session. These tests pin
the invariant: session token + TLS downgrade only in a web sandbox, and a
local run actively repairs config a prior session leaked into.
"""

import os
import subprocess
from pathlib import Path

import git
import pytest

# The helper and these tests drive git against throwaway tmp_path repos, never
# the project repo, so opt out of conftest's real-git-operation guard.
pytestmark = pytest.mark.allow_git_operations

SCRIPT = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "configure_timestamps_remote.sh"
)

TOKEN_URL = "https://x-access-token:ghs_FAKETOKEN@github.com/alexander-turner/.timestamps.git"
CLEAN_URL = "https://github.com/alexander-turner/.timestamps.git"
PROXY_URL = (
    "http://local_proxy@127.0.0.1:41729/git/alexander-turner/.timestamps"
)


def _run(ts_repo: Path, is_web_sandbox: str, token: str | None) -> None:
    env = {"PATH": os.environ["PATH"]}
    if token is not None:
        env["GH_TOKEN"] = token
    result = subprocess.run(
        ["bash", str(SCRIPT), str(ts_repo), is_web_sandbox],
        capture_output=True,
        text=True,
        env=env,
    )
    # Exit 0 even on no-op so session-setup.sh does not emit a spurious
    # "Failed to configure .timestamps remote" warning.
    assert result.returncode == 0, result.stderr


def _make_ts_repo(root: Path, origin: str) -> Path:
    ts = root / ".timestamps"
    ts.mkdir()
    repo = git.Repo.init(ts)
    repo.create_remote("origin", origin)
    return ts


def _remote(ts: Path) -> str:
    return git.Repo(ts).remotes.origin.url


def _sslverify(ts: Path) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(ts), "config", "--local", "--get", "http.sslVerify"],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else None


class TestWebSandbox:
    def test_injects_token_into_clean_remote(self, tmp_path: Path) -> None:
        ts = _make_ts_repo(tmp_path, CLEAN_URL)
        _run(ts, "true", "ghs_FAKETOKEN")
        assert _remote(ts) == TOKEN_URL
        assert _sslverify(ts) == "false"

    def test_leaves_proxy_remote_untouched(self, tmp_path: Path) -> None:
        ts = _make_ts_repo(tmp_path, PROXY_URL)
        _run(ts, "true", "ghs_FAKETOKEN")
        assert _remote(ts) == PROXY_URL
        assert _sslverify(ts) is None

    def test_no_token_no_write(self, tmp_path: Path) -> None:
        ts = _make_ts_repo(tmp_path, CLEAN_URL)
        _run(ts, "true", None)
        assert _remote(ts) == CLEAN_URL
        assert _sslverify(ts) is None


class TestLocalBindMount:
    def test_repairs_leaked_token_and_sslverify(self, tmp_path: Path) -> None:
        """The core regression: a prior session left a token URL + TLS
        downgrade on the host; a local run must restore a usable config."""
        ts = _make_ts_repo(tmp_path, TOKEN_URL)
        subprocess.run(
            ["git", "-C", str(ts), "config", "http.sslVerify", "false"],
            check=True,
        )
        _run(ts, "false", "ghs_FAKETOKEN")
        assert _remote(ts) == CLEAN_URL
        assert _sslverify(ts) is None

    def test_never_writes_token_locally(self, tmp_path: Path) -> None:
        ts = _make_ts_repo(tmp_path, CLEAN_URL)
        _run(ts, "false", "ghs_FAKETOKEN")
        assert _remote(ts) == CLEAN_URL
        assert _sslverify(ts) is None

    def test_leaves_user_remote_untouched(self, tmp_path: Path) -> None:
        ssh_url = "git@github.com:alexander-turner/.timestamps.git"
        ts = _make_ts_repo(tmp_path, ssh_url)
        _run(ts, "false", "ghs_FAKETOKEN")
        assert _remote(ts) == ssh_url


def test_no_git_dir_is_noop(tmp_path: Path) -> None:
    missing = tmp_path / ".timestamps"
    missing.mkdir()
    _run(missing, "true", "ghs_FAKETOKEN")
    assert not (missing / ".git").exists()


@pytest.mark.parametrize("is_web_sandbox", ["true", "false"])
def test_idempotent(tmp_path: Path, is_web_sandbox: str) -> None:
    origin = PROXY_URL if is_web_sandbox == "true" else CLEAN_URL
    ts = _make_ts_repo(tmp_path, origin)
    _run(ts, is_web_sandbox, "ghs_FAKETOKEN")
    first = _remote(ts)
    _run(ts, is_web_sandbox, "ghs_FAKETOKEN")
    assert _remote(ts) == first
