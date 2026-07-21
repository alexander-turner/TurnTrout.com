"""Tests for scripts/vnu_check.py."""

import json
import re
import subprocess
from pathlib import Path
from unittest import mock

import pytest

from scripts import vnu_check


def _msg(message: str, msg_type: str = "error", **extra: object) -> dict:
    """Build a vnu message dict."""
    return {"type": msg_type, "message": message, **extra}


class TestResolveVnuJar:
    """resolve_vnu_jar locates the runnable jar or raises."""

    def test_direct_path(self, tmp_path: Path) -> None:
        jar = tmp_path / "node_modules/vnu-jar/build/dist/vnu.jar"
        jar.parent.mkdir(parents=True)
        jar.write_text("")
        assert vnu_check.resolve_vnu_jar(tmp_path) == jar

    def test_glob_pnpm_path(self, tmp_path: Path) -> None:
        jar = (
            tmp_path
            / "node_modules/.pnpm/vnu-jar@26.7.16/node_modules/vnu-jar/build/dist/vnu.jar"
        )
        jar.parent.mkdir(parents=True)
        jar.write_text("")
        assert vnu_check.resolve_vnu_jar(tmp_path) == jar

    def test_missing_raises(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError, match="pnpm install"):
            vnu_check.resolve_vnu_jar(tmp_path)


def test_load_allowlist_compiles_patterns(tmp_path: Path) -> None:
    path = tmp_path / "allow.json"
    path.write_text(json.dumps({"allow": [{"pattern": "foo.*bar"}]}))
    patterns = vnu_check.load_allowlist(path)
    assert len(patterns) == 1
    assert patterns[0].search("fooXbar")


def test_load_real_allowlist_is_valid() -> None:
    """The checked-in allowlist compiles and matches a KaTeX MathML message."""
    patterns = vnu_check.load_allowlist()
    katex = _msg(
        "The “mrow” element is a completely-unknown element that is not "
        "allowed anywhere in any HTML content."
    )
    assert vnu_check.is_allowlisted(katex, patterns)


class TestRunVnu:
    """run_vnu invokes java and parses the JSON report from stderr."""

    def test_java_missing_raises(self) -> None:
        with mock.patch.object(vnu_check.shutil, "which", return_value=None):
            with pytest.raises(FileNotFoundError, match="java"):
                vnu_check.run_vnu(Path("public"), Path("vnu.jar"))

    def test_no_json_raises(self) -> None:
        completed = subprocess.CompletedProcess([], 0, stdout="", stderr="boom")
        with (
            mock.patch.object(
                vnu_check.shutil, "which", return_value="/usr/bin/java"
            ),
            mock.patch.object(
                vnu_check.subprocess, "run", return_value=completed
            ),
        ):
            with pytest.raises(RuntimeError, match="no JSON report"):
                vnu_check.run_vnu(Path("public"), Path("vnu.jar"))

    def test_parses_messages_and_strips_banner(self) -> None:
        report = {"messages": [_msg("bad")]}
        stderr = "Picked up JAVA_TOOL_OPTIONS: x\n" + json.dumps(report)
        completed = subprocess.CompletedProcess([], 1, stdout="", stderr=stderr)
        with (
            mock.patch.object(
                vnu_check.shutil, "which", return_value="/usr/bin/java"
            ),
            mock.patch.object(
                vnu_check.subprocess, "run", return_value=completed
            ),
        ):
            messages = vnu_check.run_vnu(Path("public"), Path("vnu.jar"))
        assert messages == [_msg("bad")]


def test_is_allowlisted() -> None:
    patterns = [re.compile("allowed")]
    assert vnu_check.is_allowlisted(_msg("this is allowed"), patterns)
    assert not vnu_check.is_allowlisted(_msg("this is real"), patterns)


def test_filter_messages_drops_non_error_and_allowlisted() -> None:
    patterns = [re.compile("KaTeX")]
    messages = [
        _msg("KaTeX thing"),  # allowlisted
        _msg("real bug"),  # kept
        _msg("just info", msg_type="info"),  # non-error, dropped
    ]
    remaining = vnu_check.filter_messages(messages, patterns)
    assert remaining == [_msg("real bug")]


@pytest.mark.parametrize(
    "message,expected_substr",
    [
        (
            _msg(
                "boom",
                url="file:/a/b/posts.html",
                lastLine=5,
                extract="  <x>  ",
            ),
            "[posts.html:5] boom",
        ),
        (_msg("noloc"), "[?:?] noloc"),
    ],
)
def test_format_message(message: dict, expected_substr: str) -> None:
    assert expected_substr in vnu_check.format_message(message)


def test_check_pipeline(tmp_path: Path) -> None:
    """Check() wires resolve/run/filter together."""
    with (
        mock.patch.object(
            vnu_check, "resolve_vnu_jar", return_value=Path("vnu.jar")
        ),
        mock.patch.object(
            vnu_check, "load_allowlist", return_value=[re.compile("KaTeX")]
        ),
        mock.patch.object(
            vnu_check,
            "run_vnu",
            return_value=[_msg("KaTeX ok"), _msg("real bug")],
        ),
    ):
        remaining = vnu_check.check(tmp_path)
    assert remaining == [_msg("real bug")]


class TestMain:
    """Main() exits non-zero only when real errors remain."""

    def test_clean(self, capsys: pytest.CaptureFixture[str]) -> None:
        with (
            mock.patch.object(vnu_check, "check", return_value=[]),
            mock.patch("sys.argv", ["vnu_check.py"]),
        ):
            vnu_check.main()
        assert "no conformance errors" in capsys.readouterr().out

    def test_failures_exit(self, capsys: pytest.CaptureFixture[str]) -> None:
        remaining = [_msg("real bug", url="file:/x/p.html", lastLine=3)]
        with (
            mock.patch.object(vnu_check, "check", return_value=remaining),
            mock.patch("sys.argv", ["vnu_check.py"]),
        ):
            with pytest.raises(SystemExit) as exc:
                vnu_check.main()
        assert exc.value.code == 1
        assert "1 conformance error" in capsys.readouterr().out
