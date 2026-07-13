"""
Integration tests for the async OpenTimestamps hooks.

These drive the real bash scripts (``.hooks/timestamp-worker.sh`` and
``.hooks/post-commit``) via subprocess against a throwaway git sandbox. A fake,
offline ``ots`` binary is injected on ``PATH`` so the tests never touch the
network or the real ``.timestamps`` repo.
"""

import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKER = REPO_ROOT / ".hooks" / "timestamp-worker.sh"
POST_COMMIT = REPO_ROOT / ".hooks" / "post-commit"

# Mark every test in this module: they run real git against a sandbox repo.
pytestmark = pytest.mark.allow_git_operations


def _git(repo: Path, *args: str) -> str:
    """Run a git command in *repo* and return stripped stdout."""
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def _commit(repo: Path, message: str, filename: str = "file.txt") -> str:
    """Create a commit in *repo* and return its hash."""
    (repo / filename).write_text(f"{message}\n", encoding="utf-8")
    _git(repo, "add", filename)
    _git(repo, "commit", "--quiet", "-m", message)
    return _git(repo, "rev-parse", "HEAD")


def _proof_committed(timestamps_repo: Path, commit_hash: str) -> bool:
    """True if the proof for *commit_hash* is committed in the local repo."""
    return (
        subprocess.run(
            [
                "git",
                "-C",
                str(timestamps_repo),
                "cat-file",
                "-e",
                f"HEAD:files/{commit_hash}.txt.ots",
            ],
            capture_output=True,
        ).returncode
        == 0
    )


def _proof_pushed(origin_repo: Path, commit_hash: str) -> bool:
    """True if the proof for *commit_hash* exists on origin's master."""
    return (
        subprocess.run(
            [
                "git",
                "-C",
                str(origin_repo),
                "cat-file",
                "-e",
                f"master:files/{commit_hash}.txt.ots",
            ],
            capture_output=True,
        ).returncode
        == 0
    )


class _Sandbox:
    """A throwaway main repo + cloned .timestamps repo wired to a bare
    origin."""

    def __init__(self, tmp_path: Path) -> None:
        self.home = tmp_path / "home"
        (self.home / ".local" / "bin").mkdir(parents=True)
        self._write_fake_ots()

        self.origin = tmp_path / "ts-origin.git"
        subprocess.run(
            ["git", "init", "--quiet", "--bare", str(self.origin)], check=True
        )

        self.main = tmp_path / "main"
        self.main.mkdir()
        _git(self.main, "init", "--quiet")
        _git(self.main, "config", "user.email", "t@t.com")
        _git(self.main, "config", "user.name", "t")
        _commit(self.main, "init")

        self.timestamps = self.main / ".timestamps"
        subprocess.run(
            ["git", "clone", "--quiet", str(self.origin), str(self.timestamps)],
            check=True,
            capture_output=True,
        )
        _git(self.timestamps, "config", "user.email", "t@t.com")
        _git(self.timestamps, "config", "user.name", "t")
        (self.timestamps / "files").mkdir()
        (self.timestamps / "files" / ".keep").touch()
        _git(self.timestamps, "add", "files/.keep")
        _git(self.timestamps, "commit", "--quiet", "-m", "seed")
        _git(self.timestamps, "push", "--quiet", "origin", "master")
        _git(
            self.timestamps,
            "branch",
            "--set-upstream-to=origin/master",
            "master",
        )

        self.git_dir = Path(_git(self.main, "rev-parse", "--absolute-git-dir"))
        self.state = self.git_dir / "ots-timestamps"
        self.state.mkdir(parents=True)
        self.queue = self.state / "queue"
        self.log = self.state / "worker.log"

    def _write_fake_ots(self) -> None:
        """
        Install an offline ``ots`` that writes a stub .ots next to its input.

        Honours ``FAKE_OTS_FAIL=1`` to simulate a stamping failure.
        """
        ots = self.home / ".local" / "bin" / "ots"
        ots.write_text(
            "#!/usr/bin/env bash\n"
            "set -eu\n"
            'if [ "${FAKE_OTS_FAIL:-0}" = "1" ]; then\n'
            '  echo "fake ots: forced failure" >&2\n'
            "  exit 1\n"
            "fi\n"
            'target="${*: -1}"\n'
            'printf "fake-ots-proof" > "$target.ots"\n',
            encoding="utf-8",
        )
        ots.chmod(0o755)

    def env(self, **overrides: str) -> dict[str, str]:
        env = {
            **os.environ,
            "HOME": str(self.home),
            "PATH": f"{self.home / '.local' / 'bin'}:{os.environ['PATH']}",
            "OTS_GIT_ROOT": str(self.main),
            "OTS_STATE_DIR": str(self.state),
            # post-commit skips entirely when CI=true; the GitHub Actions runner
            # sets CI=true, so default it off here. test_skips_in_ci overrides.
            "CI": "",
        }
        env.update(overrides)
        return env

    def enqueue(self, *hashes: str) -> None:
        with self.queue.open("a", encoding="utf-8") as fh:
            for h in hashes:
                fh.write(f"{h}\n")

    def run_worker(
        self, timeout: float = 30, **env_overrides: str
    ) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", str(WORKER)],
            env=self.env(**env_overrides),
            cwd=str(self.main),
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    def queued_hashes(self) -> list[str]:
        if not self.queue.exists():
            return []
        return [
            line
            for line in self.queue.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]


@pytest.fixture()
def sandbox(tmp_path: Path) -> _Sandbox:
    return _Sandbox(tmp_path)


class TestWorker:
    def test_stamps_commits_and_pushes(self, sandbox: _Sandbox) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)

        result = sandbox.run_worker()

        assert result.returncode == 0
        assert sandbox.queued_hashes() == []
        assert _proof_committed(sandbox.timestamps, commit)
        assert _proof_pushed(sandbox.origin, commit)

    def test_batches_multiple_commits(self, sandbox: _Sandbox) -> None:
        first = _commit(sandbox.main, "r1")
        second = _commit(sandbox.main, "r2")
        sandbox.enqueue(first, second)

        sandbox.run_worker()

        assert sandbox.queued_hashes() == []
        for commit in (first, second):
            assert _proof_pushed(sandbox.origin, commit)

    def test_recovers_orphaned_proof(self, sandbox: _Sandbox) -> None:
        """An .ots on disk but never committed is committed and pushed."""
        commit = _commit(sandbox.main, "orphan")
        files = sandbox.timestamps / "files"
        (files / f"{commit}.txt").write_text(commit, encoding="utf-8")
        (files / f"{commit}.txt.ots").write_text("stub", encoding="utf-8")
        assert not _proof_committed(sandbox.timestamps, commit)
        sandbox.enqueue(commit)

        sandbox.run_worker()

        assert _proof_committed(sandbox.timestamps, commit)
        assert _proof_pushed(sandbox.origin, commit)

    def test_rerun_already_committed_is_clean_noop(
        self, sandbox: _Sandbox
    ) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)
        sandbox.run_worker()
        commits_before = _git(sandbox.timestamps, "rev-list", "--count", "HEAD")

        sandbox.enqueue(commit)  # same hash again
        result = sandbox.run_worker(
            timeout=20
        )  # guards against an infinite loop

        assert result.returncode == 0
        assert sandbox.queued_hashes() == []
        commits_after = _git(sandbox.timestamps, "rev-list", "--count", "HEAD")
        assert commits_after == commits_before

    def test_push_failure_keeps_proof_then_retries(
        self, sandbox: _Sandbox
    ) -> None:
        commit = _commit(sandbox.main, "real")
        _git(
            sandbox.timestamps,
            "remote",
            "set-url",
            "origin",
            str(sandbox.main / "does-not-exist.git"),
        )
        sandbox.enqueue(commit)

        sandbox.run_worker()

        # Stamp succeeded so the hash drains; the proof is committed locally but
        # could not be pushed.
        assert sandbox.queued_hashes() == []
        assert _proof_committed(sandbox.timestamps, commit)
        assert not _proof_pushed(sandbox.origin, commit)
        assert "could not" in sandbox.log.read_text(encoding="utf-8").lower()

        # Next run with an empty queue retries the unpushed proof.
        _git(
            sandbox.timestamps,
            "remote",
            "set-url",
            "origin",
            str(sandbox.origin),
        )
        sandbox.run_worker()
        assert _proof_pushed(sandbox.origin, commit)

    def test_stamp_failure_requeues_hash(self, sandbox: _Sandbox) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)

        result = sandbox.run_worker(FAKE_OTS_FAIL="1")

        assert result.returncode == 0
        assert sandbox.queued_hashes() == [commit]
        assert not _proof_committed(sandbox.timestamps, commit)
        assert "ots stamp failed" in sandbox.log.read_text(encoding="utf-8")

    def test_concurrent_worker_skips_when_locked(
        self, sandbox: _Sandbox
    ) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)
        lockdir = sandbox.state / "lock.d"
        lockdir.mkdir()
        (lockdir / "pid").write_text(str(os.getpid()), encoding="utf-8")

        result = sandbox.run_worker()

        assert result.returncode == 0
        assert sandbox.queued_hashes() == [commit]  # untouched
        assert not _proof_committed(sandbox.timestamps, commit)

    def test_steals_stale_lock(self, sandbox: _Sandbox) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)
        # A pid that has already exited and been reaped is a stale lock.
        dead = subprocess.Popen(["true"])  # noqa: S607 - resolved on PATH
        dead.wait()
        lockdir = sandbox.state / "lock.d"
        lockdir.mkdir()
        (lockdir / "pid").write_text(str(dead.pid), encoding="utf-8")

        sandbox.run_worker()

        assert sandbox.queued_hashes() == []
        assert _proof_committed(sandbox.timestamps, commit)

    def test_removes_lock_on_exit(self, sandbox: _Sandbox) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)

        sandbox.run_worker()

        assert not (sandbox.state / "lock.d").exists()

    def test_skips_when_timestamps_repo_absent(self, sandbox: _Sandbox) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)
        import shutil

        shutil.rmtree(sandbox.timestamps)

        result = sandbox.run_worker()

        assert result.returncode == 0
        assert "not set up" in sandbox.log.read_text(encoding="utf-8")

    def test_skips_when_ots_missing(self, sandbox: _Sandbox) -> None:
        commit = _commit(sandbox.main, "real")
        sandbox.enqueue(commit)
        (sandbox.home / ".local" / "bin" / "ots").unlink()

        result = sandbox.run_worker(PATH="/usr/bin:/bin")

        assert result.returncode == 0
        assert "ots not found" in sandbox.log.read_text(encoding="utf-8")
        assert not _proof_committed(sandbox.timestamps, commit)


class TestPostCommit:
    def _run(
        self, sandbox: _Sandbox, **env_overrides: str
    ) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", str(POST_COMMIT)],
            env=sandbox.env(**env_overrides),
            cwd=str(sandbox.main),
            capture_output=True,
            text=True,
            timeout=30,
        )

    def test_skips_in_ci(self, sandbox: _Sandbox) -> None:
        _commit(sandbox.main, "real")
        result = self._run(sandbox, CI="true")

        assert result.returncode == 0
        assert not sandbox.queue.exists()

    def test_warns_when_timestamps_absent(self, sandbox: _Sandbox) -> None:
        _commit(sandbox.main, "real")
        import shutil

        shutil.rmtree(sandbox.timestamps)

        result = self._run(sandbox)

        assert result.returncode == 0
        assert "not set up" in result.stderr
        assert not sandbox.queue.exists()

    def test_enqueues_commit_hash(self, sandbox: _Sandbox) -> None:
        """
        Post-commit appends the commit hash to the queue.

        A held lock (live pid) stops the detached worker from draining the
        queue, so the enqueued hash is observable regardless of worker timing.
        """
        commit = _commit(sandbox.main, "real")
        lockdir = sandbox.state / "lock.d"
        lockdir.mkdir()
        (lockdir / "pid").write_text(str(os.getpid()), encoding="utf-8")

        result = self._run(sandbox)

        assert result.returncode == 0
        assert sandbox.queued_hashes() == [commit]
