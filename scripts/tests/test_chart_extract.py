"""
Tests for scripts/chart_extract.py.

Two jobs:
1. Characterize current behavior of pure helpers so future edits can't
   silently regress (`_normalize`, `format_as_yaml_block`, `write_results`,
   `load_existing`, `estimate_cost`, `build_chart_prompt`, `CHART_SCHEMA`).
2. Drive the two new features via TDD: a progress callback on
   `async_extract_batch` and writing the JSON schema to a tempfile instead
   of passing it inline on the `llm` command line.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts import chart_extract

# --------------------------------------------------------------------------- #
# _normalize                                                                   #
# --------------------------------------------------------------------------- #


class TestNormalize:
    def test_url_passthrough_http(self) -> None:
        assert (
            chart_extract._normalize("http://example.com/x.avif")
            == "http://example.com/x.avif"
        )

    def test_url_passthrough_https(self) -> None:
        assert (
            chart_extract._normalize("https://assets.turntrout.com/x.avif")
            == "https://assets.turntrout.com/x.avif"
        )

    def test_relative_and_dot_prefix_dedupe(self, tmp_path: Path) -> None:
        (tmp_path / "a.avif").touch()
        with _chdir(tmp_path):
            assert chart_extract._normalize(
                "./a.avif"
            ) == chart_extract._normalize("a.avif")

    def test_returns_absolute_for_paths(self, tmp_path: Path) -> None:
        with _chdir(tmp_path):
            result = chart_extract._normalize("a.avif")
        assert Path(result).is_absolute()


# --------------------------------------------------------------------------- #
# format_as_yaml_block                                                         #
# --------------------------------------------------------------------------- #


class TestFormatAsYamlBlock:
    @pytest.fixture
    def spec(self) -> dict:
        return {
            "type": "line",
            "x": {"label": "Layer"},
            "y": {"label": "Loss"},
            "series": [{"name": "S", "data": [[0, 8.92], [2, 7.85]]}],
        }

    def test_wrapped_in_chart_fence(self, spec: dict) -> None:
        out = chart_extract.format_as_yaml_block(spec)
        assert out.startswith("```chart\n")
        assert out.endswith("\n```")

    def test_data_points_use_flow_style(self, spec: dict) -> None:
        """Match `website_content/layer-horizon.md` — per-point flow `[x,
        y]`."""
        out = chart_extract.format_as_yaml_block(spec)
        assert "- [0, 8.92]" in out
        assert "- [2, 7.85]" in out
        # and NOT the block-style layout yaml.safe_dump would otherwise emit
        assert "- - 0" not in out

    def test_top_level_uses_block_style(self, spec: dict) -> None:
        """Structural arrays stay block-style for readability."""
        out = chart_extract.format_as_yaml_block(spec)
        assert "series:\n- name: S" in out

    def test_preserves_key_order(self, spec: dict) -> None:
        out = chart_extract.format_as_yaml_block(spec)
        assert out.index("type:") < out.index("x:") < out.index("series:")


# --------------------------------------------------------------------------- #
# write_results + load_existing                                                #
# --------------------------------------------------------------------------- #


class TestQueueDedupe:
    def test_writing_same_image_three_times_yields_one_row(
        self, tmp_path: Path
    ) -> None:
        out = tmp_path / "q.json"
        for err in ("fail-1", "fail-2", None):
            chart_extract.write_results(
                [
                    chart_extract.ChartExtractionResult(
                        source_image=str(tmp_path / "a.avif"),
                        model="m",
                        spec={"type": "line"} if err is None else None,
                        error=err,
                    )
                ],
                out,
            )
        data = json.loads(out.read_text())
        assert len(data) == 1
        assert data[0]["spec"] == {"type": "line"}, "latest write should win"

    def test_load_existing_only_returns_successes(self, tmp_path: Path) -> None:
        out = tmp_path / "q.json"
        (tmp_path / "a.avif").touch()
        (tmp_path / "b.avif").touch()
        chart_extract.write_results(
            [
                chart_extract.ChartExtractionResult(
                    source_image=str(tmp_path / "a.avif"),
                    model="m",
                    spec={"type": "line"},
                ),
                chart_extract.ChartExtractionResult(
                    source_image=str(tmp_path / "b.avif"),
                    model="m",
                    error="some failure",
                ),
            ],
            out,
        )
        done = chart_extract.load_existing(out)
        assert chart_extract._normalize(tmp_path / "a.avif") in done
        assert chart_extract._normalize(tmp_path / "b.avif") not in done

    def test_load_existing_missing_file_returns_empty_set(
        self, tmp_path: Path
    ) -> None:
        assert chart_extract.load_existing(tmp_path / "nope.json") == set()

    def test_load_existing_handles_corrupt_json(self, tmp_path: Path) -> None:
        out = tmp_path / "q.json"
        out.write_text("{not json")
        assert chart_extract.load_existing(out) == set()


# --------------------------------------------------------------------------- #
# estimate_cost                                                                #
# --------------------------------------------------------------------------- #


class TestEstimateCost:
    def test_unknown_model_reports_gracefully(self) -> None:
        out = chart_extract.estimate_cost("mystery-vlm", 5)
        assert "not available" in out or "no pricing" in out

    def test_known_model_returns_dollar_value(self) -> None:
        out = chart_extract.estimate_cost("claude-sonnet-4-6", 10)
        assert "$" in out

    def test_cost_scales_roughly_linearly_with_n(self) -> None:
        """Rendered to 2dp, so tolerate up to a penny per row of rounding."""

        def dollars(s: str) -> float:
            return float(s.split("$")[1].split(" ")[0])

        one = dollars(chart_extract.estimate_cost("claude-sonnet-4-6", 1))
        ten = dollars(chart_extract.estimate_cost("claude-sonnet-4-6", 10))
        assert abs(ten - 10 * one) < 0.1


# --------------------------------------------------------------------------- #
# build_chart_prompt                                                           #
# --------------------------------------------------------------------------- #


class TestBuildChartPrompt:
    def test_contains_core_instructions(self) -> None:
        p = chart_extract.build_chart_prompt()
        assert "Extract the underlying data" in p
        assert "Self-check" in p

    def test_context_is_appended_when_provided(self) -> None:
        p = chart_extract.build_chart_prompt(context="surrounding paragraph")
        assert "surrounding paragraph" in p

    def test_no_context_when_not_provided(self) -> None:
        assert "Surrounding prose" not in chart_extract.build_chart_prompt()

    def test_no_site_specific_jargon(self) -> None:
        """Site-internal terms like `smallcaps` shouldn't leak into prompts."""
        assert "smallcaps" not in chart_extract.build_chart_prompt().lower()


# --------------------------------------------------------------------------- #
# CHART_SCHEMA                                                                 #
# --------------------------------------------------------------------------- #


class TestChartSchema:
    def test_no_prefixitems_leaks(self) -> None:
        """`prefixItems` is JSON Schema 2020-12 and breaks OpenAI strict
        mode."""
        assert "prefixItems" not in json.dumps(chart_extract.CHART_SCHEMA)

    def test_requires_top_level_fields(self) -> None:
        assert set(chart_extract.CHART_SCHEMA["required"]) == {
            "type",
            "x",
            "y",
            "series",
        }

    def test_only_line_type_accepted(self) -> None:
        assert chart_extract.CHART_SCHEMA["properties"]["type"] == {
            "const": "line"
        }


# --------------------------------------------------------------------------- #
# extract_chart — mocks `llm` and `magick` to exercise control-flow branches.  #
# --------------------------------------------------------------------------- #


def _fake_run(
    stdout: str = "", returncode: int = 0, stderr: str = ""
) -> object:
    class _R:
        pass

    r = _R()
    r.stdout = stdout
    r.returncode = returncode
    r.stderr = stderr
    return r


class TestExtractChart:
    @pytest.fixture
    def png(self, tmp_path: Path) -> Path:
        p = tmp_path / "chart.png"
        p.write_bytes(b"\x89PNG\r\n")
        return p

    def test_success_parses_json_into_spec(self, png: Path) -> None:
        valid = json.dumps(
            {
                "type": "line",
                "x": {"label": "a"},
                "y": {"label": "b"},
                "series": [{"name": "s", "data": [[0, 1]]}],
            }
        )
        with (
            patch.object(chart_extract, "_find_llm", return_value="llm"),
            patch.object(
                chart_extract.subprocess,
                "run",
                return_value=_fake_run(stdout=valid),
            ),
        ):
            result = chart_extract.extract_chart(png, model="m")
        assert result.error is None
        assert result.spec is not None
        assert result.spec["type"] == "line"

    def test_non_zero_returncode_becomes_error(self, png: Path) -> None:
        with (
            patch.object(chart_extract, "_find_llm", return_value="llm"),
            patch.object(
                chart_extract.subprocess,
                "run",
                return_value=_fake_run(returncode=1, stderr="rate limited"),
            ),
        ):
            result = chart_extract.extract_chart(png, model="m")
        assert result.spec is None
        assert "rate limited" in (result.error or "")

    def test_invalid_json_output_becomes_error(self, png: Path) -> None:
        with (
            patch.object(chart_extract, "_find_llm", return_value="llm"),
            patch.object(
                chart_extract.subprocess,
                "run",
                return_value=_fake_run(stdout="not json{"),
            ),
        ):
            result = chart_extract.extract_chart(png, model="m")
        assert result.spec is None
        assert "invalid JSON" in (result.error or "")

    def test_llm_timeout_is_caught_not_raised(self, png: Path) -> None:
        with (
            patch.object(chart_extract, "_find_llm", return_value="llm"),
            patch.object(
                chart_extract.subprocess,
                "run",
                side_effect=subprocess.TimeoutExpired(cmd="llm", timeout=1),
            ),
        ):
            result = chart_extract.extract_chart(png, model="m", timeout=1)
        assert result.spec is None
        assert "timeout" in (result.error or "")

    def test_avif_conversion_error_is_recorded_not_raised(
        self, tmp_path: Path
    ) -> None:
        """One bad AVIF must not crash the batch — see chart_extract.py round-1
        fix."""
        avif = tmp_path / "bad.avif"
        avif.write_bytes(b"not actually avif")
        with patch.object(
            chart_extract,
            "_convert_if_avif",
            side_effect=subprocess.CalledProcessError(
                returncode=1, cmd=["magick"]
            ),
        ):
            result = chart_extract.extract_chart(avif, model="m")
        assert result.spec is None
        assert "AVIF conversion failed" in (result.error or "")


# --------------------------------------------------------------------------- #
# NEW: progress callback on async_extract_batch (TDD — fails before impl).     #
# --------------------------------------------------------------------------- #


class TestProgressCallback:
    def test_callback_fires_once_per_completed_image(
        self, tmp_path: Path
    ) -> None:
        imgs = [tmp_path / f"c{i}.png" for i in range(3)]
        for p in imgs:
            p.write_bytes(b"\x89PNG\r\n")

        valid = json.dumps(
            {
                "type": "line",
                "x": {"label": "a"},
                "y": {"label": "b"},
                "series": [{"name": "s", "data": [[0, 1]]}],
            }
        )
        calls: list[chart_extract.ChartExtractionResult] = []

        with (
            patch.object(chart_extract, "_find_llm", return_value="llm"),
            patch.object(
                chart_extract.subprocess,
                "run",
                return_value=_fake_run(stdout=valid),
            ),
        ):
            results = asyncio.run(
                chart_extract.async_extract_batch(
                    imgs, model="m", on_completed=calls.append
                )
            )

        assert len(results) == 3
        assert len(calls) == 3, "callback should fire once per image"

    def test_callback_fires_on_failure_too(self, tmp_path: Path) -> None:
        img = tmp_path / "bad.avif"
        img.write_bytes(b"not avif")
        calls: list[chart_extract.ChartExtractionResult] = []

        with patch.object(
            chart_extract,
            "_convert_if_avif",
            side_effect=subprocess.CalledProcessError(
                returncode=1, cmd=["magick"]
            ),
        ):
            asyncio.run(
                chart_extract.async_extract_batch(
                    [img], model="m", on_completed=calls.append
                )
            )

        assert len(calls) == 1
        assert calls[0].error is not None


# --------------------------------------------------------------------------- #
# NEW: schema is written to a tempfile and passed to llm via a file path       #
# (TDD — fails before impl).                                                   #
# --------------------------------------------------------------------------- #


class TestSchemaViaTempfile:
    def test_llm_receives_schema_as_file_path_not_inline_json(
        self, tmp_path: Path
    ) -> None:
        """
        Passing ~1KB of JSON on the command line flirts with ARG_MAX on some
        systems and is awkward to debug.

        The `llm` CLI accepts a path to a
        schema file — use that.
        """
        png = tmp_path / "c.png"
        png.write_bytes(b"\x89PNG\r\n")

        valid = json.dumps(
            {
                "type": "line",
                "x": {"label": "a"},
                "y": {"label": "b"},
                "series": [{"name": "s", "data": [[0, 1]]}],
            }
        )
        captured_argv: list[list[str]] = []

        def _capture(cmd, **_kw):
            captured_argv.append(list(cmd))
            return _fake_run(stdout=valid)

        with (
            patch.object(chart_extract, "_find_llm", return_value="llm"),
            # Skip the TS validator so we only see the `llm` invocation.
            patch.object(chart_extract.shutil, "which", return_value=None),
            patch.object(chart_extract.subprocess, "run", side_effect=_capture),
        ):
            chart_extract.extract_chart(png, model="m")

        [argv] = captured_argv
        # The `--schema` flag must receive a path to an existing file, not a JSON blob.
        schema_idx = argv.index("--schema")
        schema_arg = argv[schema_idx + 1]
        assert not schema_arg.lstrip().startswith(
            "{"
        ), f"schema should be a file path, got inline JSON: {schema_arg[:60]}..."


# --------------------------------------------------------------------------- #
# NEW: round-trip validation through the TS parseChartSpec (TDD).             #
# --------------------------------------------------------------------------- #


class TestValidateViaTsx:
    """Catches LLM hallucinations that pass JSON-schema but break quartz."""

    def test_returns_none_when_tsx_accepts_spec(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Empty stderr + rc=0 means parseChartSpec accepted the YAML."""

        def _ok(cmd, **_kw):
            r = type("R", (), {})()
            r.stdout = ""
            r.stderr = ""
            r.returncode = 0
            return r

        monkeypatch.setattr(chart_extract.subprocess, "run", _ok)
        assert chart_extract.validate_spec_via_tsx({"type": "line"}) is None

    def test_returns_error_string_when_tsx_rejects(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def _bad(cmd, **_kw):
            r = type("R", (), {})()
            r.stdout = ""
            r.stderr = 'Chart "y" axis must have a string "label"\n'
            r.returncode = 1
            return r

        monkeypatch.setattr(chart_extract.subprocess, "run", _bad)
        err = chart_extract.validate_spec_via_tsx({"type": "line"})
        assert err is not None
        assert "axis must have" in err

    def test_skips_silently_when_node_not_on_path(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """If the TS toolchain isn't available, don't block — just skip."""

        def _which(name):
            return (
                None if name in {"node", "npx", "tsx"} else "/usr/bin/" + name
            )

        monkeypatch.setattr(chart_extract.shutil, "which", _which)
        # Subprocess must never be called.

        def _fail(*a, **kw):
            raise AssertionError("subprocess should not run when tsx is absent")

        monkeypatch.setattr(chart_extract.subprocess, "run", _fail)
        assert chart_extract.validate_spec_via_tsx({"type": "line"}) is None

    def test_validator_timeout_is_captured_not_raised(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A hung tsx validator must not kill the whole batch."""
        img = tmp_path / "c.png"
        img.write_bytes(b"\x89PNG\r\n")
        valid_json = json.dumps(
            {
                "type": "line",
                "x": {"label": "x"},
                "y": {"label": "y"},
                "series": [{"name": "S", "data": [[0, 1]]}],
            }
        )

        def _run(cmd, **_kw):
            if cmd[0].endswith("llm"):
                r = type("R", (), {})()
                r.stdout = valid_json
                r.stderr = ""
                r.returncode = 0
                return r
            raise subprocess.TimeoutExpired(cmd=cmd, timeout=1)

        monkeypatch.setattr(chart_extract, "_find_llm", lambda: "llm")
        monkeypatch.setattr(
            chart_extract.shutil,
            "which",
            lambda name: (
                f"/usr/bin/{name}" if name in {"npx", "node"} else None
            ),
        )
        monkeypatch.setattr(chart_extract.subprocess, "run", _run)

        result = chart_extract.extract_chart(img, model="m")
        assert result.spec is None or result.yaml_block is None
        assert "validator timed out" in (result.error or "")

    def test_url_input_is_downloaded_and_extracted(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Accept https://... inputs; download into a tempdir before hitting the LLM."""
        captured_llm_attachment: list[str] = []

        valid_json = json.dumps(
            {
                "type": "line",
                "x": {"label": "x"},
                "y": {"label": "y"},
                "series": [{"name": "S", "data": [[0, 1]]}],
            }
        )

        def _fake_run(cmd, **_kw):
            r = type("R", (), {})()
            r.stdout = ""
            r.stderr = ""
            r.returncode = 0
            if cmd[0].endswith("llm"):
                r.stdout = valid_json
                idx = cmd.index("-a") + 1
                captured_llm_attachment.append(cmd[idx])
            return r

        def _fake_get(url, **_kw):
            assert url == "https://assets.turntrout.com/static/chart.png"
            resp = type("R", (), {})()
            resp.status_code = 200
            resp.content = b"\x89PNG\r\n"
            resp.raise_for_status = lambda: None
            resp.iter_content = lambda chunk_size=8192: iter([b"\x89PNG\r\n"])
            return resp

        monkeypatch.setattr(chart_extract, "_find_llm", lambda: "llm")
        # Pretend Node isn't available so validator skips.
        monkeypatch.setattr(
            chart_extract.shutil,
            "which",
            lambda name: "/usr/bin/llm" if name == "llm" else None,
        )
        monkeypatch.setattr(chart_extract.subprocess, "run", _fake_run)
        monkeypatch.setattr(chart_extract.requests, "get", _fake_get)
        # URL inputs write the CSV to cwd; isolate cwd so the test doesn't
        # leak a `chart.csv` into the repo root.
        monkeypatch.chdir(tmp_path)

        result = chart_extract.extract_chart(
            "https://assets.turntrout.com/static/chart.png", model="m"
        )
        assert result.error is None
        assert result.spec is not None
        # LLM got a local path to the downloaded file, not the URL.
        assert len(captured_llm_attachment) == 1
        assert not captured_llm_attachment[0].startswith("http")
        # source_image records the ORIGINAL url (so the queue key dedupes stably).
        assert (
            result.source_image
            == "https://assets.turntrout.com/static/chart.png"
        )

    def test_url_download_failure_is_captured_not_raised(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import requests

        def _boom(*_a, **_kw):
            raise requests.exceptions.ConnectionError("name resolution failed")

        monkeypatch.setattr(chart_extract.requests, "get", _boom)
        result = chart_extract.extract_chart(
            "https://nope.example/x.png", model="m"
        )
        assert result.spec is None
        assert "download failed" in (result.error or "").lower()

    def test_url_download_size_cap_is_enforced(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A URL pointing at a huge file should be rejected, not written to
        disk."""
        cap = chart_extract._DOWNLOAD_MAX_BYTES
        # Produce 2× the cap so the loop trips the size guard.
        payload = b"A" * (cap + 1024)

        class _Resp:
            def raise_for_status(self) -> None:
                """Mock: 2xx response, so nothing to raise."""

            def iter_content(self, chunk_size: int = 8192):
                yield from (
                    payload[i : i + chunk_size]
                    for i in range(0, len(payload), chunk_size)
                )

        monkeypatch.setattr(
            chart_extract.requests, "get", lambda *a, **kw: _Resp()
        )
        result = chart_extract.extract_chart(
            "https://oversized.example/big.avif", model="m"
        )
        assert result.spec is None
        assert "exceeded" in (result.error or "").lower()

    def test_extract_chart_aborts_on_validator_rejection(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """When the TS parser rejects the spec, no CSV/block should be
        written."""
        img = tmp_path / "c.png"
        img.write_bytes(b"\x89PNG\r\n")

        valid_json = json.dumps(
            {
                "type": "line",
                "x": {"label": "x"},
                "y": {"label": "y"},
                "series": [{"name": "S", "data": [[0, 1]]}],
            }
        )

        call_log: list[str] = []

        def _run(cmd, **_kw):
            call_log.append(cmd[0])
            r = type("R", (), {})()
            r.stdout = ""
            r.stderr = ""
            r.returncode = 0
            # First call is `llm`, second would be the validator.
            if cmd[0].endswith("llm"):
                r.stdout = valid_json
            else:
                r.stderr = "Series has no name"
                r.returncode = 1
            return r

        monkeypatch.setattr(chart_extract, "_find_llm", lambda: "llm")
        monkeypatch.setattr(
            chart_extract.shutil,
            "which",
            lambda name: (
                f"/usr/bin/{name}" if name in {"node", "npx", "tsx"} else None
            ),
        )
        monkeypatch.setattr(chart_extract.subprocess, "run", _run)

        result = chart_extract.extract_chart(img, model="m")
        assert result.spec is None or result.yaml_block is None
        assert result.error is not None
        assert "Series has no name" in result.error
        # The CSV should not have been written since validation failed.
        assert not (tmp_path / "c.csv").exists()


# --------------------------------------------------------------------------- #
# _find_llm / _convert_if_avif                                                 #
# --------------------------------------------------------------------------- #


class TestFindLlm:
    def test_raises_with_install_hint_when_missing(self) -> None:
        with (
            patch.object(chart_extract.shutil, "which", return_value=None),
            pytest.raises(FileNotFoundError, match="uv tool install llm"),
        ):
            chart_extract._find_llm()

    def test_returns_path_when_found(self) -> None:
        with patch.object(
            chart_extract.shutil, "which", return_value="/usr/local/bin/llm"
        ):
            assert chart_extract._find_llm() == "/usr/local/bin/llm"


class TestConvertIfAvif:
    def test_non_avif_returned_unchanged(self, tmp_path: Path) -> None:
        png = tmp_path / "x.png"
        png.touch()
        assert chart_extract._convert_if_avif(png, tmp_path) == png

    def test_missing_magick_raises_with_hint(self, tmp_path: Path) -> None:
        avif = tmp_path / "x.avif"
        avif.touch()
        with (
            patch.object(chart_extract.shutil, "which", return_value=None),
            pytest.raises(FileNotFoundError, match="ImageMagick"),
        ):
            chart_extract._convert_if_avif(avif, tmp_path)

    def test_avif_is_converted_to_png_in_workspace(
        self, tmp_path: Path
    ) -> None:
        avif = tmp_path / "x.avif"
        avif.touch()
        ws = tmp_path / "ws"
        ws.mkdir()

        recorded: list[list[str]] = []

        def _run(cmd, **_kw):  # type: ignore[no-untyped-def]
            recorded.append(list(cmd))
            Path(cmd[2]).write_bytes(b"\x89PNG\r\n")
            return _fake_run()

        with (
            patch.object(
                chart_extract.shutil, "which", return_value="/usr/bin/magick"
            ),
            patch.object(chart_extract.subprocess, "run", side_effect=_run),
        ):
            out = chart_extract._convert_if_avif(avif, ws)

        assert out == ws / "x.png"
        assert out.exists()
        assert recorded[0][0] == "/usr/bin/magick"


# --------------------------------------------------------------------------- #
# write_results — corrupt / non-list JSON                                       #
# --------------------------------------------------------------------------- #


class TestWriteResultsCorruption:
    def test_corrupt_existing_file_is_replaced(self, tmp_path: Path) -> None:
        out = tmp_path / "q.json"
        out.write_text("{not json")
        chart_extract.write_results(
            [
                chart_extract.ChartExtractionResult(
                    source_image=str(tmp_path / "a.avif"),
                    model="m",
                    spec={"type": "line"},
                )
            ],
            out,
        )
        data = json.loads(out.read_text())
        assert len(data) == 1

    def test_non_list_existing_file_is_replaced(self, tmp_path: Path) -> None:
        out = tmp_path / "q.json"
        out.write_text('{"accidentally": "a dict"}')
        chart_extract.write_results(
            [
                chart_extract.ChartExtractionResult(
                    source_image=str(tmp_path / "a.avif"),
                    model="m",
                    spec={"type": "line"},
                )
            ],
            out,
        )
        data = json.loads(out.read_text())
        assert data[0]["source_image"] == str(tmp_path / "a.avif")

    def test_append_false_ignores_existing_file(self, tmp_path: Path) -> None:
        out = tmp_path / "q.json"
        out.write_text(
            json.dumps([{"source_image": str(tmp_path / "x.avif"), "spec": {}}])
        )
        chart_extract.write_results(
            [
                chart_extract.ChartExtractionResult(
                    source_image=str(tmp_path / "new.avif"),
                    model="m",
                    spec={"type": "line"},
                )
            ],
            out,
            append=False,
        )
        data = json.loads(out.read_text())
        assert len(data) == 1
        assert "new.avif" in data[0]["source_image"]


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #


class TestCli:
    def _stub_extract(
        self,
        monkeypatch: pytest.MonkeyPatch,
        spec: dict | None,
        error: str | None = None,
    ) -> None:
        def _fake(image: Path, model: str, context=None, timeout=180):
            yaml_block = (
                chart_extract.format_as_yaml_block(
                    spec, csv_path=f"./{image.stem}.csv"
                )
                if spec is not None
                else None
            )
            csv_path = (
                str(image.with_suffix(".csv")) if spec is not None else None
            )
            return chart_extract.ChartExtractionResult(
                source_image=str(image),
                model=model,
                spec=spec,
                error=error,
                csv_path=csv_path,
                yaml_block=yaml_block,
            )

        monkeypatch.setattr(chart_extract, "extract_chart", _fake)

    def test_success_path_writes_queue(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        img = tmp_path / "a.png"
        img.write_bytes(b"\x89PNG\r\n")
        out = tmp_path / "q.json"

        spec = {
            "type": "line",
            "x": {"label": "a"},
            "y": {"label": "b"},
            "series": [{"name": "s", "data": [[0, 1]]}],
        }
        self._stub_extract(monkeypatch, spec)
        monkeypatch.setattr(
            "sys.argv",
            ["chart_extract", str(img), "-o", str(out), "--print-yaml"],
        )

        assert chart_extract._cli() == 0
        data = json.loads(out.read_text())
        assert len(data) == 1 and data[0]["spec"] == spec

    def test_skip_existing_shortcuts_to_nothing_to_do(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        img = tmp_path / "a.png"
        img.write_bytes(b"\x89PNG\r\n")
        out = tmp_path / "q.json"
        out.write_text(
            json.dumps(
                [
                    {
                        "source_image": chart_extract._normalize(img),
                        "spec": {"type": "line"},
                    }
                ]
            )
        )
        monkeypatch.setattr(
            chart_extract, "extract_chart", lambda *a, **kw: None
        )
        monkeypatch.setattr(
            "sys.argv", ["chart_extract", str(img), "-o", str(out)]
        )
        assert chart_extract._cli() == 0

    def test_returns_nonzero_on_any_failure(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        img = tmp_path / "a.png"
        img.write_bytes(b"\x89PNG\r\n")
        out = tmp_path / "q.json"
        self._stub_extract(monkeypatch, spec=None, error="boom")
        monkeypatch.setattr(
            "sys.argv", ["chart_extract", str(img), "-o", str(out)]
        )
        assert chart_extract._cli() == 1


# --------------------------------------------------------------------------- #
# NEW: CSV emission + yaml block references path (TDD).                        #
# --------------------------------------------------------------------------- #


class TestCsvEmission:
    @pytest.fixture
    def spec(self) -> dict:
        return {
            "type": "line",
            "title": "T",
            "x": {"label": "x"},
            "y": {"label": "y"},
            "series": [
                {
                    "name": "A",
                    "color": "var(--blue)",
                    "data": [[0, 1.0], [1, 2.0]],
                },
                {"name": "B", "data": [[0, 5.0], [1, 6.0]]},
            ],
        }

    def test_write_chart_csv_produces_long_format(
        self, tmp_path: Path, spec: dict
    ) -> None:
        target = tmp_path / "chart.csv"
        chart_extract.write_chart_csv(spec, target)
        lines = target.read_text().splitlines()
        assert lines[0] == "x,y,series"
        assert set(lines[1:]) == {"0,1.0,A", "1,2.0,A", "0,5.0,B", "1,6.0,B"}

    @pytest.mark.parametrize(
        "bad_name", ["Loss, normalized", 'name with "quote"', "has\nnewline"]
    )
    def test_write_chart_csv_rejects_names_that_would_break_round_trip(
        self, tmp_path: Path, bad_name: str
    ) -> None:
        """The TS-side parser rejects quoted CSV fields; reject here too with a
        clearer message before we write a file that can't be read."""
        spec = {
            "type": "line",
            "x": {"label": "x"},
            "y": {"label": "y"},
            "series": [{"name": bad_name, "data": [[0, 1]]}],
        }
        with pytest.raises(ValueError, match="rename it"):
            chart_extract.write_chart_csv(spec, tmp_path / "c.csv")

    def test_format_as_yaml_block_uses_top_level_data_path(
        self, spec: dict
    ) -> None:
        out = chart_extract.format_as_yaml_block(spec, csv_path="./chart.csv")
        assert "data: ./chart.csv" in out
        # Per-series `data:` fields are stripped — one and only one `data:` line.
        assert out.count("data:") == 1
        assert "name: A" in out
        assert "color: var(--blue)" in out
        assert "name: B" in out

    def test_format_as_yaml_block_without_csv_keeps_inline_data(
        self, spec: dict
    ) -> None:
        """Back-compat: calling without csv_path emits inline `data` points."""
        out = chart_extract.format_as_yaml_block(spec)
        assert "- [0, 1.0]" in out
        assert "data: ./" not in out

    def test_yaml_block_appends_data_when_no_y_axis_present(self) -> None:
        """Degenerate spec (no `y` key): `data:` is still emitted, at the
        end."""
        degenerate = {
            "type": "line",
            "series": [{"name": "A", "data": [[0, 1]]}],
        }
        out = chart_extract.format_as_yaml_block(degenerate, csv_path="./x.csv")
        assert "data: ./x.csv" in out


class TestExtractWritesCsv:
    def test_successful_extraction_writes_csv_next_to_image(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        img = tmp_path / "loss_by_layer.png"
        img.write_bytes(b"\x89PNG\r\n")

        spec = {
            "type": "line",
            "x": {"label": "layer"},
            "y": {"label": "loss"},
            "series": [{"name": "Loss", "data": [[0, 8.92], [2, 7.85]]}],
        }

        def _fake_llm(cmd, **_kw):
            r = type("R", (), {})()
            r.stdout = json.dumps(spec)
            r.stderr = ""
            r.returncode = 0
            return r

        monkeypatch.setattr(chart_extract, "_find_llm", lambda: "llm")
        monkeypatch.setattr(chart_extract.subprocess, "run", _fake_llm)

        result = chart_extract.extract_chart(img, model="m")

        assert result.spec is not None
        assert result.csv_path is not None
        assert Path(result.csv_path).exists()
        assert Path(result.csv_path).name == "loss_by_layer.csv"
        assert result.yaml_block is not None
        assert "```chart" in result.yaml_block
        assert "data: ./loss_by_layer.csv" in result.yaml_block


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #


class _chdir:
    """Minimal cwd contextmanager (pytest's `monkeypatch.chdir` also works)."""

    def __init__(self, target: Path) -> None:
        self.target = target
        self.prev: Path | None = None

    def __enter__(self) -> None:
        import os

        self.prev = Path.cwd()
        os.chdir(self.target)

    def __exit__(self, *exc: object) -> None:
        import os

        if self.prev is not None:
            os.chdir(self.prev)
