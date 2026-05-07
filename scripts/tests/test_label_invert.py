"""Tests for label_invert.py."""

from __future__ import annotations

import io
import json
from collections.abc import Mapping
from pathlib import Path

import numpy as np
import pytest
import requests
from flask.testing import FlaskClient
from PIL import Image

from scripts import label_invert


def _solid_png(rgb: tuple[int, int, int], size: int = 8) -> bytes:
    """Build an in-memory PNG of one solid color for luminance tests."""
    arr = np.full((size, size, 3), rgb, dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, mode="RGB").save(buf, format="PNG")
    return buf.getvalue()


DIMS = {
    "https://assets.turntrout.com/static/images/posts/a.avif": {},
    "https://assets.turntrout.com/static/images/posts/b.png": {},
    "https://assets.turntrout.com/static/images/posts/c.jpg": {},
    "https://assets.turntrout.com/static/images/posts/d.svg": {},  # excluded
    "https://assets.turntrout.com/static/images/posts/e.mp4": {},  # excluded
    "https://assets.turntrout.com/static/images/external-favicons/x.avif": {},
    "https://assets.turntrout.com/static/images/twemoji/y.png": {},
    "https://assets.turntrout.com/static/images/card_images/z.jpg": {},
    "../asset_staging/local.avif": {},  # not http(s)
}
EXPECTED = (
    "https://assets.turntrout.com/static/images/posts/a.avif",
    "https://assets.turntrout.com/static/images/posts/b.png",
    "https://assets.turntrout.com/static/images/posts/c.jpg",
)


# --- enumerate ---------------------------------------------------------------


def test_enumerate_candidates_filters_and_sorts() -> None:
    assert label_invert.enumerate_candidates(DIMS) == EXPECTED


def test_enumerate_candidates_dedupes() -> None:
    assert label_invert.enumerate_candidates({**DIMS, **DIMS}) == EXPECTED


# --- labels JSON I/O ---------------------------------------------------------


@pytest.mark.parametrize(
    ("contents", "expected"),
    [
        (None, {}),
        ("[1, 2]", ValueError),
        ('{"a": true, "b": false}', {"a": True, "b": False}),
    ],
)
def test_load_labels(
    tmp_path: Path, contents: str | None, expected: object
) -> None:
    path = tmp_path / "x.json"
    if contents is not None:
        path.write_text(contents, encoding="utf-8")
    if expected is ValueError:
        with pytest.raises(ValueError, match="JSON object"):
            label_invert.load_labels(path)
    else:
        assert label_invert.load_labels(path) == expected


def test_save_labels_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "labels.json"
    label_invert.save_labels({"z": True, "a": False}, path)
    text = path.read_text(encoding="utf-8")
    assert json.loads(text) == {"a": False, "z": True}
    assert text.index('"a"') < text.index('"z"')


def test_save_labels_cleans_tempfile_on_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_a: object, **_kw: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(label_invert.os, "replace", boom)
    with pytest.raises(RuntimeError, match="boom"):
        label_invert.save_labels({"u": True}, tmp_path / "labels.json")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    ("decision", "before", "after"),
    [
        (True, {}, {"u": True}),
        (False, {}, {"u": False}),
        (None, {"u": True}, {}),
        (True, {"u": False}, {"u": True}),
    ],
)
def test_apply_label(
    decision: bool | None,
    before: dict[str, bool],
    after: dict[str, bool],
) -> None:
    labels = dict(before)
    label_invert.apply_label(labels, "u", decision)
    assert labels == after


# --- markdown scanner --------------------------------------------------------


def test_apply_annotations_records_and_strips(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    md = content / "post.md"
    md.write_text(
        "# title\n\n"
        "![alt one](https://example.com/a.avif){.invert-on-dark}\n\n"
        "![alt two](https://example.com/b.png){.no-invert-on-dark}\n\n"
        "![untouched](https://example.com/c.jpg)\n",
        encoding="utf-8",
    )
    labels_path = tmp_path / "labels.json"
    result = label_invert.apply_markdown_annotations(
        content, labels_path=labels_path
    )

    assert result.files_modified == (md,)
    assert set(result.decisions) == {
        ("https://example.com/a.avif", True),
        ("https://example.com/b.png", False),
    }
    assert json.loads(labels_path.read_text(encoding="utf-8")) == {
        "https://example.com/a.avif": True,
        "https://example.com/b.png": False,
    }
    new_text = md.read_text(encoding="utf-8")
    assert "{.invert-on-dark}" not in new_text
    assert "{.no-invert-on-dark}" not in new_text
    assert "![alt one](https://example.com/a.avif)" in new_text
    assert "![alt two](https://example.com/b.png)" in new_text
    assert "![untouched](https://example.com/c.jpg)" in new_text


def test_apply_annotations_no_annotations_is_noop(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    md = content / "post.md"
    md.write_text("![](https://example.com/a.avif)\n", encoding="utf-8")
    labels_path = tmp_path / "labels.json"
    result = label_invert.apply_markdown_annotations(
        content, labels_path=labels_path
    )
    assert result.files_modified == ()
    assert result.decisions == ()
    assert not labels_path.exists()


def test_apply_annotations_overrides_existing_labels(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    (content / "post.md").write_text(
        "![](https://example.com/a.avif){.no-invert-on-dark}\n",
        encoding="utf-8",
    )
    labels_path = tmp_path / "labels.json"
    label_invert.save_labels({"https://example.com/a.avif": True}, labels_path)
    label_invert.apply_markdown_annotations(content, labels_path=labels_path)
    assert json.loads(labels_path.read_text(encoding="utf-8")) == {
        "https://example.com/a.avif": False,
    }


# --- Flask app ---------------------------------------------------------------


@pytest.fixture(name="client")
def _client(tmp_path: Path) -> tuple[FlaskClient, Path]:
    labels_path = tmp_path / "labels.json"
    app = label_invert.create_app(EXPECTED, labels_path=labels_path)
    app.config["TESTING"] = True
    return app.test_client(), labels_path


def test_index_renders_grid(client: tuple[FlaskClient, Path]) -> None:
    test_client, _ = client
    body = test_client.get("/").get_data(as_text=True)
    assert "Invert-in-dark-mode labeling" in body
    for url in EXPECTED:
        assert f'data-url="{url}"' in body


def test_index_marks_state(client: tuple[FlaskClient, Path]) -> None:
    test_client, labels_path = client
    label_invert.save_labels(
        {EXPECTED[0]: True, EXPECTED[1]: False}, labels_path
    )
    body = test_client.get("/").get_data(as_text=True)
    assert f'data-state="invert" data-url="{EXPECTED[0]}"' in body
    assert f'data-state="no-invert" data-url="{EXPECTED[1]}"' in body
    assert f'data-state="unlabeled" data-url="{EXPECTED[2]}"' in body


def test_get_labels_returns_json(client: tuple[FlaskClient, Path]) -> None:
    test_client, labels_path = client
    label_invert.save_labels({EXPECTED[0]: True}, labels_path)
    assert test_client.get("/api/labels").get_json() == {EXPECTED[0]: True}


@pytest.mark.parametrize(
    ("state", "expected_disk"),
    [
        ("invert", {"url": True}),
        ("no-invert", {"url": False}),
        ("unlabeled", {}),
    ],
)
def test_post_label_persists_each_state(
    client: tuple[FlaskClient, Path],
    state: str,
    expected_disk: Mapping[str, bool],
) -> None:
    test_client, labels_path = client
    label_invert.save_labels({EXPECTED[0]: True}, labels_path)
    resp = test_client.post(
        "/api/label", json={"url": EXPECTED[0], "state": state}
    )
    assert resp.status_code == 200
    on_disk = json.loads(labels_path.read_text(encoding="utf-8"))
    expected = {EXPECTED[0]: v for v in expected_disk.values()}
    assert on_disk == expected


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"url": EXPECTED[0]},
        {"url": EXPECTED[0], "state": "bogus"},
        {"url": "https://x/never.avif", "state": "invert"},
        "not json",
    ],
)
def test_post_label_rejects_bad_input(
    client: tuple[FlaskClient, Path], payload: object
) -> None:
    test_client, _ = client
    if isinstance(payload, str):
        resp = test_client.post(
            "/api/label", data=payload, content_type="application/json"
        )
    else:
        resp = test_client.post("/api/label", json=payload)
    assert resp.status_code == 400


# --- CLI ---------------------------------------------------------------------


def _write_dims(tmp_path: Path, entries: Mapping[str, object]) -> Path:
    path = tmp_path / "dims.json"
    path.write_text(json.dumps(entries), encoding="utf-8")
    return path


def test_main_exits_when_no_candidates(tmp_path: Path) -> None:
    rc = label_invert.main(
        [
            "--dimensions",
            str(_write_dims(tmp_path, {})),
            "--labels",
            str(tmp_path / "labels.json"),
            "--no-browser",
            "--port",
            "0",
        ]
    )
    assert rc == 1


@pytest.mark.parametrize("no_browser", [True, False])
def test_main_serves_app(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    no_browser: bool,
) -> None:
    dims = _write_dims(tmp_path, {EXPECTED[0]: {}})
    captured: dict[str, object] = {"ran": False}
    opened: list[str] = []

    monkeypatch.setattr(
        label_invert.Flask,
        "run",
        lambda _self, **kwargs: captured.update(ran=True, kwargs=kwargs),
    )
    monkeypatch.setattr(
        label_invert,
        "open_browser_async",
        lambda u: opened.append(u),
    )

    argv = [
        "--dimensions",
        str(dims),
        "--labels",
        str(tmp_path / "labels.json"),
        "--port",
        "0",
    ]
    if no_browser:
        argv.append("--no-browser")
    assert label_invert.main(argv) == 0
    assert captured["ran"] is True
    assert opened == ([] if no_browser else ["http://127.0.0.1:0/"])


def test_open_browser_async_starts_thread(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started: list[tuple[str, ...]] = []

    class _ImmediateThread:
        def __init__(self, target: object, args: tuple, daemon: bool) -> None:
            self._target = target
            self._args = args
            self._daemon = daemon

        def start(self) -> None:
            self._target(*self._args)

    monkeypatch.setattr(label_invert.threading, "Thread", _ImmediateThread)
    monkeypatch.setattr(
        label_invert.webbrowser, "open", lambda u: started.append((u,))
    )
    label_invert.open_browser_async("http://example.test/")
    assert started == [("http://example.test/",)]


def test_main_runs_apply_annotations(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    (content / "p.md").write_text(
        "![](https://example.com/a.avif){.invert-on-dark}\n",
        encoding="utf-8",
    )
    labels_path = tmp_path / "labels.json"
    rc = label_invert.main(
        [
            "--apply-annotations",
            "--content",
            str(content),
            "--labels",
            str(labels_path),
        ]
    )
    assert rc == 0
    assert json.loads(labels_path.read_text(encoding="utf-8")) == {
        "https://example.com/a.avif": True,
    }


# --- luminance --------------------------------------------------------------


@pytest.mark.parametrize(
    ("rgb", "expected"),
    [
        ((255, 255, 255), 1.0),
        ((0, 0, 0), 0.0),
        ((128, 128, 128), 128 / 255),
    ],
)
def test_compute_luminance(rgb: tuple[int, int, int], expected: float) -> None:
    assert label_invert.compute_luminance(_solid_png(rgb)) == pytest.approx(
        expected, abs=0.01
    )


def test_load_luminances_handles_missing_file(tmp_path: Path) -> None:
    assert label_invert.load_luminances(tmp_path / "missing.json") == {}


def test_load_luminances_rejects_non_object(tmp_path: Path) -> None:
    p = tmp_path / "bad.json"
    p.write_text("[1, 2]", encoding="utf-8")
    with pytest.raises(ValueError, match="JSON object"):
        label_invert.load_luminances(p)


def test_save_luminances_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "lum.json"
    label_invert.save_luminances({"z": 0.9, "a": 0.1}, path)
    text = path.read_text(encoding="utf-8")
    assert json.loads(text) == {"a": 0.1, "z": 0.9}
    assert text.index('"a"') < text.index('"z"')


def test_save_luminances_cleans_tempfile_on_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_a: object, **_kw: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(label_invert.os, "replace", boom)
    with pytest.raises(RuntimeError, match="boom"):
        label_invert.save_luminances({"u": 0.5}, tmp_path / "lum.json")
    assert list(tmp_path.iterdir()) == []


def test_ensure_luminances_uses_cache_only_for_missing(
    tmp_path: Path,
) -> None:
    cache_path = tmp_path / "lum.json"
    label_invert.save_luminances({"https://x/a.avif": 0.5}, cache_path)

    fetches: list[str] = []

    def fake_fetch(url: str) -> bytes:
        fetches.append(url)
        return _solid_png((255, 255, 255))

    out = label_invert.ensure_luminances(
        ("https://x/a.avif", "https://x/b.png"),
        cache_path=cache_path,
        fetch=fake_fetch,
        max_workers=2,
    )
    assert fetches == ["https://x/b.png"]
    assert out["https://x/a.avif"] == pytest.approx(0.5)
    assert out["https://x/b.png"] == pytest.approx(1.0, abs=0.01)
    # Cache persisted
    assert label_invert.load_luminances(cache_path) == out


def test_ensure_luminances_returns_cache_when_complete(tmp_path: Path) -> None:
    cache_path = tmp_path / "lum.json"
    label_invert.save_luminances({"u": 0.4}, cache_path)
    fetches: list[str] = []

    def fake_fetch(url: str) -> bytes:
        fetches.append(url)
        return b""

    out = label_invert.ensure_luminances(
        ("u",), cache_path=cache_path, fetch=fake_fetch
    )
    assert out == {"u": 0.4}
    assert fetches == []


def test_ensure_luminances_skips_failed_fetches(tmp_path: Path) -> None:
    cache_path = tmp_path / "lum.json"

    def fake_fetch(url: str) -> bytes:
        if url == "https://x/bad.avif":
            raise requests.ConnectionError("boom")
        return _solid_png((255, 255, 255))

    out = label_invert.ensure_luminances(
        ("https://x/good.avif", "https://x/bad.avif"),
        cache_path=cache_path,
        fetch=fake_fetch,
        max_workers=2,
    )
    assert "https://x/good.avif" in out
    assert "https://x/bad.avif" not in out


def test_default_fetch_uses_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class _Resp:
        content = b"OK"

        def raise_for_status(self) -> None:
            captured["raised"] = False

    def fake_get(url: str, timeout: float = 0) -> _Resp:
        captured["url"] = url
        captured["timeout"] = timeout
        return _Resp()

    monkeypatch.setattr(label_invert.requests, "get", fake_get)
    assert label_invert._default_fetch("http://x/a") == b"OK"
    assert captured["url"] == "http://x/a"
    assert captured["raised"] is False


def test_autolabel_by_luminance_marks_high_lum_unlabeled(
    tmp_path: Path,
) -> None:
    labels_path = tmp_path / "labels.json"
    new = label_invert.autolabel_by_luminance(
        ("https://x/a.avif", "https://x/b.avif", "https://x/c.avif"),
        {
            "https://x/a.avif": 0.9,
            "https://x/b.avif": 0.4,
        },
        labels_path=labels_path,
    )
    assert new == ("https://x/a.avif",)
    assert json.loads(labels_path.read_text(encoding="utf-8")) == {
        "https://x/a.avif": True,
    }


def test_autolabel_by_luminance_does_not_override_existing(
    tmp_path: Path,
) -> None:
    labels_path = tmp_path / "labels.json"
    label_invert.save_labels({"https://x/a.avif": False}, labels_path)
    new = label_invert.autolabel_by_luminance(
        ("https://x/a.avif",),
        {"https://x/a.avif": 0.99},
        labels_path=labels_path,
    )
    assert new == ()
    assert json.loads(labels_path.read_text(encoding="utf-8")) == {
        "https://x/a.avif": False,
    }


def test_autolabel_by_luminance_no_changes_does_not_write(
    tmp_path: Path,
) -> None:
    labels_path = tmp_path / "labels.json"
    new = label_invert.autolabel_by_luminance(
        ("https://x/a.avif",),
        {"https://x/a.avif": 0.1},
        labels_path=labels_path,
    )
    assert new == ()
    assert not labels_path.exists()


def test_index_renders_luminance_and_auto_badge(tmp_path: Path) -> None:
    labels_path = tmp_path / "labels.json"
    high = "https://assets.turntrout.com/static/images/posts/a.avif"
    low = "https://assets.turntrout.com/static/images/posts/b.png"
    label_invert.save_labels({high: True, low: False}, labels_path)
    app = label_invert.create_app(
        (high, low),
        labels_path=labels_path,
        luminances={high: 0.92, low: 0.10},
    )
    app.config["TESTING"] = True
    body = app.test_client().get("/").get_data(as_text=True)
    assert "L = 0.92" in body
    assert "L = 0.10" in body
    # Only the high-lum invert card gets the auto-suggested badge.
    # `badge-auto` appears once in the stylesheet too, so use `auto-suggested`.
    assert body.count("auto-suggested") == 1


def test_main_runs_luminance_and_autolabel(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dims = _write_dims(
        tmp_path,
        {
            "https://assets.turntrout.com/static/images/posts/a.avif": {},
            "https://assets.turntrout.com/static/images/posts/b.png": {},
        },
    )
    labels_path = tmp_path / "labels.json"
    lum_path = tmp_path / "lum.json"

    def fake_fetch(url: str) -> bytes:
        return _solid_png((255, 255, 255) if "a.avif" in url else (10, 10, 10))

    monkeypatch.setattr(label_invert, "_default_fetch", fake_fetch)
    monkeypatch.setattr(label_invert.Flask, "run", lambda *_a, **_k: None)
    monkeypatch.setattr(label_invert, "open_browser_async", lambda _u: None)

    rc = label_invert.main(
        [
            "--dimensions",
            str(dims),
            "--labels",
            str(labels_path),
            "--luminance",
            str(lum_path),
            "--no-browser",
            "--port",
            "0",
        ]
    )
    assert rc == 0
    assert json.loads(labels_path.read_text(encoding="utf-8")) == {
        "https://assets.turntrout.com/static/images/posts/a.avif": True,
    }
    assert "https://assets.turntrout.com/static/images/posts/b.png" in (
        json.loads(lum_path.read_text(encoding="utf-8"))
    )


def test_main_skip_luminance(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dims = _write_dims(
        tmp_path,
        {"https://assets.turntrout.com/static/images/posts/a.avif": {}},
    )
    labels_path = tmp_path / "labels.json"

    called: list[str] = []
    monkeypatch.setattr(
        label_invert,
        "ensure_luminances",
        lambda *a, **kw: called.append("called") or {},
    )
    monkeypatch.setattr(label_invert.Flask, "run", lambda *_a, **_k: None)
    monkeypatch.setattr(label_invert, "open_browser_async", lambda _u: None)

    rc = label_invert.main(
        [
            "--dimensions",
            str(dims),
            "--labels",
            str(labels_path),
            "--no-browser",
            "--skip-luminance",
            "--port",
            "0",
        ]
    )
    assert rc == 0
    assert called == []
    assert not labels_path.exists()
