"""
Tests for scripts/notebooks/convert_existing_graphs.py.

Goals:
- Pin the image-ref parser against realistic website_content Markdown.
- Exercise the classifier plumbing with the `llm` CLI and `chart_extract._download`
  mocked out; all downstream calls must reach the right models.
- End-to-end test for `run()` with a two-post temp tree — covers dedup,
  dry-run, and the sidecar writer.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path

import pytest

from scripts import chart_extract
from scripts.notebooks import convert_existing_graphs as ceg

# --------------------------------------------------------------------------- #
# _paragraph_context                                                           #
# --------------------------------------------------------------------------- #


class TestParagraphContext:
    @pytest.mark.parametrize(
        "idx,window,expected_lines",
        [
            (0, 2, [0, 1, 2]),
            (5, 1, [4, 5, 6]),
            (9, 2, [7, 8, 9]),  # end-of-file clamp
            (0, 0, [0]),
        ],
    )
    def test_window_respects_edges(
        self,
        idx: int,
        window: int,
        expected_lines: list[int],
    ) -> None:
        lines = [f"line{i}" for i in range(10)]
        out = ceg._paragraph_context(lines, idx, window=window)
        assert out == "\n".join(f"line{i}" for i in expected_lines)


# --------------------------------------------------------------------------- #
# iter_image_refs / walk_content                                               #
# --------------------------------------------------------------------------- #


class TestImageRefDiscovery:
    def test_parses_multiple_refs_with_context(self, tmp_path: Path) -> None:
        md = tmp_path / "post.md"
        md.write_text(
            "Opening paragraph describing the figure below.\n"
            "![Loss curve across layers](https://assets.turntrout.com/a.avif)\n"
            "Follow-up prose that references the figure.\n"
            "\n"
            "Second figure later on:\n"
            "![Accuracy vs steps](local/b.avif)\n",
            encoding="utf-8",
        )
        refs = list(ceg.iter_image_refs(md))
        assert [(r.alt, r.url, r.line_number) for r in refs] == [
            (
                "Loss curve across layers",
                "https://assets.turntrout.com/a.avif",
                2,
            ),
            ("Accuracy vs steps", "local/b.avif", 6),
        ]
        # Context window picks up surrounding prose.
        assert "Opening paragraph" in refs[0].context
        assert "Follow-up prose" in refs[0].context
        assert "Second figure later on" in refs[1].context

    def test_ignores_non_image_links(self, tmp_path: Path) -> None:
        md = tmp_path / "post.md"
        md.write_text(
            "Link: [normal](https://x/y) not an image.\n"
            "![real](https://x/z.avif)\n",
            encoding="utf-8",
        )
        urls = [r.url for r in ceg.iter_image_refs(md)]
        assert urls == ["https://x/z.avif"]

    def test_walk_content_skips_sidecars_and_recurses(
        self, tmp_path: Path
    ) -> None:
        (tmp_path / "sub").mkdir()
        (tmp_path / "a.md").write_text("![x](u1)\n", encoding="utf-8")
        (tmp_path / "sub" / "b.md").write_text("![y](u2)\n", encoding="utf-8")
        # Sidecar this driver itself produces — must not be re-scanned.
        (tmp_path / "a.proposed-replacements.md").write_text(
            "![ignored](u3)\n", encoding="utf-8"
        )
        urls = [r.url for r in ceg.walk_content(tmp_path)]
        assert set(urls) == {"u1", "u2"}


# --------------------------------------------------------------------------- #
# Classifier: prompt shape + yes/no parsing                                    #
# --------------------------------------------------------------------------- #


class TestClassifierPrompt:
    def test_prompt_enumerates_supported_types(self) -> None:
        p = ceg.build_classifier_prompt(alt="Loss vs step", context="prose")
        for t in chart_extract.SUPPORTED_CHART_TYPES:
            assert t in p
        assert "YES" in p and "NO" in p
        assert "Loss vs step" in p
        assert "prose" in p

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("YES", True),
            ("yes\nreasoning follows", True),
            ("Yes, it's a chart", True),
            ("NO", False),
            ("no explanation", False),
            ("", False),
            ("\n\nYES", True),  # leading blank lines
            ("maybe", False),  # anything else counts as NO
        ],
    )
    def test_parse_yes_no(self, raw: str, expected: bool) -> None:
        assert ceg._parse_yes_no(raw) is expected


# --------------------------------------------------------------------------- #
# _classify_one — subprocess + download wiring                                #
# --------------------------------------------------------------------------- #


def _ref(url: str, alt: str = "alt") -> ceg.ImageRef:
    return ceg.ImageRef("post.md", url, alt, 1, "ctx")


def _install_classifier_mocks(
    monkeypatch: pytest.MonkeyPatch,
    *,
    stdout: str = "YES\n",
    returncode: int = 0,
    stderr: str = "",
    download: Path | None = None,
) -> dict:
    """Install the three mocks `_classify_one` needs and return a dict the
    caller can inspect (`cmd` captures the subprocess args)."""
    captured: dict = {}
    monkeypatch.setattr(chart_extract, "_find_llm", lambda: "/bin/llm")
    if download is not None:
        monkeypatch.setattr(
            chart_extract, "_download", lambda url, ws, timeout=30: download
        )
    else:

        def _no_download(*a, **kw):
            raise AssertionError("_download must not be called for local paths")

        monkeypatch.setattr(chart_extract, "_download", _no_download)

    def _fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        return subprocess.CompletedProcess(
            args=cmd, returncode=returncode, stdout=stdout, stderr=stderr
        )

    monkeypatch.setattr(subprocess, "run", _fake_run)
    return captured


class TestClassifyOne:
    def test_url_is_downloaded_then_attached(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        local = tmp_path / "downloaded.avif"
        local.write_bytes(b"\x00")
        captured = _install_classifier_mocks(monkeypatch, download=local)
        assert ceg._classify_one(_ref("https://example.com/x.avif"), model="m")
        assert str(local) in captured["cmd"] and "m" in captured["cmd"]

    def test_local_path_is_attached_directly(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_classifier_mocks(monkeypatch, stdout="NO\n")
        assert ceg._classify_one(_ref("./local.avif"), model="m") is False

    def test_non_zero_exit_raises(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        local = tmp_path / "x"
        local.write_bytes(b"\x00")
        _install_classifier_mocks(
            monkeypatch, returncode=1, stderr="kaboom", download=local
        )
        with pytest.raises(RuntimeError, match="kaboom"):
            ceg._classify_one(_ref("https://x/y.avif"), model="m")


# --------------------------------------------------------------------------- #
# classify_batch — concurrency scaffolding                                     #
# --------------------------------------------------------------------------- #


class TestClassifyBatch:
    def test_returns_results_in_input_order(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        refs = [
            ceg.ImageRef("p.md", f"u{i}", "a", i + 1, "c") for i in range(4)
        ]
        # Even URLs → YES, odd URLs → NO; exercises both paths.
        monkeypatch.setattr(
            ceg,
            "_classify_one",
            lambda ref, model: ref.url.endswith(("0", "2")),
        )
        out = asyncio.run(ceg.classify_batch(refs, model="m"))
        assert [r.url for r, _ in out] == ["u0", "u1", "u2", "u3"]
        assert [is_chart for _, is_chart in out] == [True, False, True, False]


# --------------------------------------------------------------------------- #
# write_proposed_replacements                                                  #
# --------------------------------------------------------------------------- #


def _result(source: str, **overrides) -> chart_extract.ChartExtractionResult:
    # Provide a fully-formed spec so write_proposed_replacements can re-serialize
    # it after injecting alt/fallback (the real pipeline only passes validated
    # specs through).
    defaults = dict(
        source_image=source,
        model="m",
        spec={
            "type": "line",
            "x": {"label": "X"},
            "y": {"label": "Y"},
            "series": [{"name": "S", "data": [[0, 1]]}],
        },
    )
    defaults.update(overrides)
    return chart_extract.ChartExtractionResult(**defaults)


class TestWriteProposedReplacements:
    def test_groups_by_file_and_sorts_by_line(self, tmp_path: Path) -> None:
        md_a = tmp_path / "a.md"
        md_b = tmp_path / "b.md"
        for m in (md_a, md_b):
            m.touch()

        refs_by_url = {
            "url-a2": ceg.ImageRef(str(md_a), "url-a2", "alt-a2", 42, "ctx"),
            "url-a1": ceg.ImageRef(str(md_a), "url-a1", "alt-a1", 7, "ctx"),
            "url-b1": ceg.ImageRef(str(md_b), "url-b1", "alt-b1", 3, "ctx"),
        }
        results = [
            _result("url-a2"),
            _result("url-a1"),
            _result("url-b1"),
        ]
        written = ceg.write_proposed_replacements(results, refs_by_url)
        assert {p.name for p in written} == {
            "a.proposed-replacements.md",
            "b.proposed-replacements.md",
        }
        a_body = (tmp_path / "a.proposed-replacements.md").read_text()
        # a.md sidecar has line-7 section BEFORE line-42 section.
        assert a_body.index("line 7") < a_body.index("line 42")
        assert "alt-a1" in a_body and "url-a1" in a_body

    def test_errors_and_orphans_are_skipped(self, tmp_path: Path) -> None:
        md = tmp_path / "p.md"
        md.touch()
        refs_by_url = {
            "URL-GOOD": ceg.ImageRef(str(md), "URL-GOOD", "a", 1, "c"),
        }
        results = [
            _result("URL-GOOD"),
            _result("URL-FAILED", error="boom", spec=None, yaml_block=None),
            _result("URL-ORPHAN"),  # no entry in refs_by_url
        ]
        written = ceg.write_proposed_replacements(results, refs_by_url)
        body = written[0].read_text()
        assert "URL-GOOD" in body
        assert "URL-FAILED" not in body
        assert "URL-ORPHAN" not in body

    def test_replacement_block_has_alt_and_fallback(
        self, tmp_path: Path
    ) -> None:
        """
        Injected alt = ref.alt; injected fallback = ref.url.

        These are the two provenance fields that keep the chart a11y-complete
        and preserve the original image URL.
        """
        md = tmp_path / "p.md"
        md.touch()
        ref = ceg.ImageRef(
            str(md),
            "https://assets.turntrout.com/x.avif",
            "Loss curve across layers",
            1,
            "ctx",
        )
        refs_by_url = {ref.url: ref}
        written = ceg.write_proposed_replacements(
            [_result(ref.url)], refs_by_url
        )
        body = written[0].read_text()
        # The replacement block (not just the Original: section) must have
        # alt and fallback keys.
        replacement = body.split("Replacement:", 1)[1]
        assert "alt: Loss curve across layers" in replacement
        assert "fallback: https://assets.turntrout.com/x.avif" in replacement

    @pytest.mark.parametrize(
        "ref_alt,spec_extras,expected",
        [
            # 1. Author-written Markdown alt wins over everything.
            (
                "Markdown alt",
                {"alt": "Model alt", "title": "Title"},
                "Markdown alt",
            ),
            # 2. Model-generated (non-placeholder) alt beats title when ref is blank.
            ("", {"alt": "Model alt", "title": "Title"}, "Model alt"),
            # 3. Placeholder alt from extractor is NOT used; title falls through.
            (
                "",
                {"alt": chart_extract.ALT_TODO_PLACEHOLDER, "title": "Title"},
                "Title",
            ),
            # 4. Nothing usable → shared TODO placeholder.
            ("", {}, chart_extract.ALT_TODO_PLACEHOLDER),
        ],
    )
    def test_alt_priority_chain(
        self,
        tmp_path: Path,
        ref_alt: str,
        spec_extras: dict,
        expected: str,
    ) -> None:
        md = tmp_path / "p.md"
        md.touch()
        ref = ceg.ImageRef(str(md), "u", ref_alt, 1, "ctx")
        spec = {
            "type": "line",
            "x": {"label": "X"},
            "y": {"label": "Y"},
            "series": [{"name": "S", "data": [[0, 1]]}],
            **spec_extras,
        }
        written = ceg.write_proposed_replacements(
            [_result("u", spec=spec)], {ref.url: ref}
        )
        # YAML may single-quote values containing brackets; tolerate both.
        body = written[0].read_text()
        assert f"alt: {expected}" in body or f"alt: '{expected}'" in body


# --------------------------------------------------------------------------- #
# run() — the whole pipeline end-to-end                                        #
# --------------------------------------------------------------------------- #


@pytest.fixture
def content_tree(tmp_path: Path) -> tuple[Path, Path]:
    """
    Two-post content tree shared across TestRun cases.

    post1 has one chart-ish image + one non-chart; post2 has one chart-ish
    image.
    """
    content = tmp_path / "content"
    content.mkdir()
    (content / "post1.md").write_text(
        "Intro.\n"
        "![chart alt](https://x/chart1.avif)\n"
        "![not a chart](https://x/meme.avif)\n",
        encoding="utf-8",
    )
    (content / "post2.md").write_text(
        "![another chart](https://x/chart2.avif)\n", encoding="utf-8"
    )
    return content, tmp_path / "queue.json"


def _forbid(label: str):
    """Mock that raises if invoked — used to assert a branch is NOT taken."""

    def _fn(*a, **kw):
        raise AssertionError(label)

    return _fn


def _install_run_mocks(
    monkeypatch: pytest.MonkeyPatch,
    *,
    classify=None,
    batch=None,
) -> None:
    """Install the two mocks `run()` needs: classifier + extractor."""
    if classify is not None:
        monkeypatch.setattr(ceg, "_classify_one", classify)
    if batch is not None:
        monkeypatch.setattr(chart_extract, "async_extract_batch", batch)


def _minimal_batch(spec: dict | None = None):
    """
    Returns an ``async_extract_batch`` stub producing one minimal success per
    input URL.

    Optional per-call hook receives the captured context.
    """
    default_spec = spec or {"type": "line"}

    async def _fake(images, model, on_completed=None, context_for=None):
        return [
            chart_extract.ChartExtractionResult(
                source_image=str(img),
                model=model,
                spec=default_spec,
                context_used=context_for(img) if context_for else "",
            )
            for img in images
        ]

    return _fake


class TestRun:
    def test_full_run_writes_sidecars_and_queue(
        self,
        content_tree: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        content, queue = content_tree
        _install_run_mocks(
            monkeypatch,
            classify=lambda ref, model: "chart" in ref.url,
            batch=_minimal_batch(),
        )
        n = asyncio.run(
            ceg.run(content, model="m", classifier="c", queue=queue)
        )
        assert n == 2
        post1 = (content / "post1.proposed-replacements.md").read_text()
        assert (content / "post2.proposed-replacements.md").exists()
        assert "meme" not in post1  # classifier filtered it out
        sources = {row["source_image"] for row in json.loads(queue.read_text())}
        assert sources == {"https://x/chart1.avif", "https://x/chart2.avif"}

    def test_dry_run_classifies_but_skips_extraction(
        self,
        content_tree: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture,
    ) -> None:
        content, queue = content_tree
        _install_run_mocks(
            monkeypatch,
            classify=lambda ref, model: True,
            batch=_forbid("extractor ran during --dry-run"),
        )
        n = asyncio.run(
            ceg.run(
                content, model="m", classifier="c", queue=queue, dry_run=True
            )
        )
        assert n == 0
        out = capsys.readouterr().out
        assert "chart1.avif" in out and "chart2.avif" in out
        assert not queue.exists()

    def test_resume_skips_urls_already_in_queue(
        self,
        content_tree: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        content, queue = content_tree
        # Seed the queue via the real writer so format drift can't silently
        # break this test.
        chart_extract.write_results([_result("https://x/chart1.avif")], queue)

        seen: list[str] = []

        def _classify(ref, model):
            seen.append(ref.url)
            return True

        _install_run_mocks(
            monkeypatch, classify=_classify, batch=_minimal_batch()
        )
        asyncio.run(ceg.run(content, model="m", classifier="c", queue=queue))
        assert "https://x/chart1.avif" not in seen

    def test_empty_content_dir_returns_zero(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / "empty").mkdir()
        _install_run_mocks(
            monkeypatch, classify=_forbid("should short-circuit")
        )
        n = asyncio.run(
            ceg.run(
                tmp_path / "empty",
                model="m",
                classifier="c",
                queue=tmp_path / "q.json",
            )
        )
        assert n == 0

    def test_all_images_rejected_short_circuits(
        self,
        content_tree: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        content, queue = content_tree
        _install_run_mocks(
            monkeypatch,
            classify=lambda ref, model: False,
            batch=_forbid("extractor ran with nothing to extract"),
        )
        assert (
            asyncio.run(
                ceg.run(content, model="m", classifier="c", queue=queue)
            )
            == 0
        )

    def test_context_for_returns_none_for_unknown(
        self,
        content_tree: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The context_for closure defends against URL / key drift inside
        async_extract_batch — if a source that never made it to refs_by_url
        somehow comes through, return None rather than KeyError-ing."""
        content, queue = content_tree
        captured: dict = {}

        async def _fake(images, model, on_completed=None, context_for=None):
            captured["known"] = context_for("https://x/chart1.avif")
            captured["unknown"] = context_for("https://nowhere/z.avif")
            return []

        _install_run_mocks(
            monkeypatch, classify=lambda ref, model: True, batch=_fake
        )
        asyncio.run(ceg.run(content, model="m", classifier="c", queue=queue))
        assert (
            captured["known"] is not None and "chart alt" in captured["known"]
        )
        assert captured["unknown"] is None


# --------------------------------------------------------------------------- #
# CLI entry points                                                             #
# --------------------------------------------------------------------------- #


class TestCLI:
    def test_defaults_match_documentation(self) -> None:
        args = ceg._parse_args([])
        assert args.content_dir == Path("website_content")
        assert args.model == "claude-sonnet-4-6"
        assert args.classifier == "claude-opus-4-7"
        assert args.queue == Path("chart-backfill-queue.json")
        assert args.dry_run is False

    def test_overrides_flow_through(self) -> None:
        args = ceg._parse_args(
            [
                "--content-dir",
                "/tmp/other",
                "--model",
                "gpt-5",
                "--classifier",
                "gemini-2.5-pro",
                "--queue",
                "/tmp/q.json",
                "--dry-run",
            ]
        )
        assert args.content_dir == Path("/tmp/other")
        assert args.model == "gpt-5"
        assert args.classifier == "gemini-2.5-pro"
        assert args.queue == Path("/tmp/q.json")
        assert args.dry_run is True

    def test_main_invokes_run_with_parsed_args(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / "empty").mkdir()
        captured: dict = {}

        async def _fake_run(
            content_dir, model, classifier, queue, dry_run=False
        ):
            captured.update(
                content_dir=content_dir,
                model=model,
                classifier=classifier,
                queue=queue,
                dry_run=dry_run,
            )
            return 0

        monkeypatch.setattr(ceg, "run", _fake_run)
        rc = ceg.main(
            [
                "--content-dir",
                str(tmp_path / "empty"),
                "--queue",
                str(tmp_path / "q.json"),
                "--dry-run",
            ]
        )
        assert rc == 0
        assert captured["dry_run"] is True
        assert captured["content_dir"] == tmp_path / "empty"
