"""Tests for label_invert.py."""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path

import pytest
from flask.testing import FlaskClient

from scripts import label_invert

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
            del daemon

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
