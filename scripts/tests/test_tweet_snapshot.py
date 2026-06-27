"""Tests for scripts/tweet_snapshot.py."""

from __future__ import annotations

import contextlib
import datetime
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
import requests

from scripts import r2_sync
from scripts import tweet_snapshot as ts

# Captured before the autouse fixture patches it, so the real impl can be tested.
ORIGINAL_NOW = ts._now


class FakeResponse:
    """Stand-in for a requests.Response covering both JSON and streaming use."""

    def __init__(
        self,
        *,
        status_code: int = 200,
        json_data: Any = None,
        content: bytes = b"",
        raise_for_status: Exception | None = None,
    ) -> None:
        self.status_code = status_code
        self._json = json_data
        self._content = content
        self._raise = raise_for_status
        self.raw = SimpleNamespace(decode_content=False)

    def raise_for_status(self) -> None:
        if self._raise is not None:
            raise self._raise

    def json(self) -> Any:
        return self._json

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def iter_content(self, chunk_size: int = 0) -> Iterator[bytes]:
        del chunk_size
        yield self._content


class FakeSession:
    """Yields queued responses (or raises queued exceptions) in order."""

    def __init__(self, responses: list[Any]) -> None:
        self._responses = responses
        self.calls: list[tuple[str, dict]] = []

    def get(self, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append((url, kwargs))
        result = self._responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


RAW_TWEET: dict = {
    "__typename": "Tweet",
    "user": {
        "name": "Alex Turner",
        "screen_name": "turntrout",
        "profile_image_url_https": "https://pbs.twimg.com/profile_images/1/a_normal.jpg",
        "is_blue_verified": True,
    },
    "created_at": "2025-01-21T17:32:00.000Z",
    "text": "hello https://t.co/abc",
    "entities": {
        "urls": [
            {
                "url": "https://t.co/abc",
                "display_url": "example.com",
                "expanded_url": "https://example.com",
            }
        ]
    },
    "mediaDetails": [
        {
            "type": "photo",
            "media_url_https": "https://pbs.twimg.com/media/p.jpg",
            "original_info": {"width": 800, "height": 600},
            "ext_alt_text": "a photo",
        },
        {
            "type": "video",
            "media_url_https": "https://pbs.twimg.com/media/poster.jpg",
            "original_info": {"width": 1280, "height": 720},
            "video_info": {
                "variants": [
                    {
                        "content_type": "video/mp4",
                        "bitrate": 100,
                        "url": "low.mp4",
                    },
                    {
                        "content_type": "video/mp4",
                        "bitrate": 900,
                        "url": "high.mp4",
                    },
                    {
                        "content_type": "application/x-mpegURL",
                        "url": "stream.m3u8",
                    },
                ]
            },
        },
    ],
}


@pytest.fixture(autouse=True)
def _frozen_now(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ts,
        "_now",
        lambda: datetime.datetime(2026, 6, 27, tzinfo=datetime.UTC),
    )


def test_now_returns_aware_datetime() -> None:
    # Exercises the real implementation (the fixture replaces ts._now per-test).
    assert ORIGINAL_NOW().tzinfo is not None


def test_extract_tweet_id() -> None:
    assert ts.extract_tweet_id("https://x.com/u/status/12345") == "12345"
    with pytest.raises(ValueError, match="No tweet id"):
        ts.extract_tweet_id("https://example.com/none")


def test_parse_block_ids() -> None:
    body = "https://x.com/u/status/11111\n\n  https://x.com/u/status/22222 \n"
    assert ts.parse_block_ids(body) == ["11111", "22222"]


def test_find_tweet_ids(tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        "intro\n\n```tweet\nhttps://x.com/u/status/11111\n"
        "https://x.com/u/status/22222\n```\n",
        encoding="utf-8",
    )
    (tmp_path / "b.md").write_text("no tweets here\n", encoding="utf-8")
    found = ts.find_tweet_ids(tmp_path)
    assert set(found) == {"11111", "22222"}
    assert found["11111"].name == "a.md"


def test_to_base36() -> None:
    assert ts._to_base36(0.0) == "0"
    assert ts._to_base36(36.0) == "10"
    assert ts._to_base36(0.5) == "0.i"
    # A non-terminating fraction stops at the 12-place cap.
    assert len(ts._to_base36(1 / 7).split(".")[1]) == 12


def test_derive_token_strips_zeros_and_dot() -> None:
    token = ts.derive_token("1700000000000000001")
    assert "0" not in token
    assert "." not in token
    assert token


def test_fetch_tweet_result_success() -> None:
    session = FakeSession([FakeResponse(json_data=RAW_TWEET)])
    data = ts.fetch_tweet_result("123", session)  # type: ignore[arg-type]
    assert data["user"]["screen_name"] == "turntrout"


def test_fetch_tweet_result_network_error() -> None:
    session = FakeSession([requests.ConnectionError("boom")])
    with pytest.raises(ts.TweetUnavailableError, match="Network error"):
        ts.fetch_tweet_result("123", session)  # type: ignore[arg-type]


def test_fetch_tweet_result_404() -> None:
    session = FakeSession([FakeResponse(status_code=404)])
    with pytest.raises(ts.TweetUnavailableError, match="not found"):
        ts.fetch_tweet_result("123", session)  # type: ignore[arg-type]


def test_fetch_tweet_result_http_error() -> None:
    session = FakeSession(
        [FakeResponse(raise_for_status=requests.HTTPError("500"))]
    )
    with pytest.raises(ts.TweetUnavailableError, match="Bad response"):
        ts.fetch_tweet_result("123", session)  # type: ignore[arg-type]


def test_fetch_tweet_result_tombstone() -> None:
    session = FakeSession(
        [FakeResponse(json_data={"__typename": "TweetTombstone"})]
    )
    with pytest.raises(ts.TweetUnavailableError, match="tombstone"):
        ts.fetch_tweet_result("123", session)  # type: ignore[arg-type]


def test_fetch_tweet_result_missing_user() -> None:
    session = FakeSession([FakeResponse(json_data={"__typename": "Tweet"})])
    with pytest.raises(ts.TweetUnavailableError, match="missing user"):
        ts.fetch_tweet_result("123", session)  # type: ignore[arg-type]


def test_avatar_url_upgrade() -> None:
    assert ts._avatar_url("https://x/a_normal.jpg") == "https://x/a_400x400.jpg"


def test_best_video_variant() -> None:
    variants = [
        {"content_type": "video/mp4", "bitrate": 100, "url": "low.mp4"},
        {"content_type": "video/mp4", "bitrate": 900, "url": "high.mp4"},
    ]
    assert ts._best_video_variant(variants) == "high.mp4"
    assert ts._best_video_variant([{"content_type": "x/y"}]) is None


def test_normalize() -> None:
    snapshot = ts.normalize(RAW_TWEET, "999")
    assert snapshot["id"] == "999"
    assert snapshot["url"] == "https://xcancel.com/turntrout/status/999"
    assert snapshot["author"]["verified"] is True
    assert snapshot["author"]["avatarSrc"].endswith("_400x400.jpg")
    assert snapshot["snapshotAt"] == "2026-06-27T00:00:00+00:00"
    types = [m["type"] for m in snapshot["media"]]
    assert types == ["photo", "video"]
    assert snapshot["media"][1]["src"] == "high.mp4"
    assert snapshot["urls"][0]["expanded"] == "https://example.com"


def test_normalize_animated_gif_and_skipped_video() -> None:
    raw = {
        "user": {
            "name": "n",
            "screen_name": "h",
            "profile_image_url_https": "https://x/a_normal.jpg",
        },
        "mediaDetails": [
            {
                "type": "animated_gif",
                "media_url_https": "https://x/g.jpg",
                "video_info": {
                    "variants": [
                        {
                            "content_type": "video/mp4",
                            "bitrate": 1,
                            "url": "g.mp4",
                        }
                    ]
                },
            },
            {"type": "video", "video_info": {"variants": []}},
        ],
    }
    snapshot = ts.normalize(raw, "1")
    assert len(snapshot["media"]) == 1
    assert snapshot["media"][0]["loop"] is True
    assert snapshot["author"]["verified"] is False


def test_download_file_success(tmp_path: Path) -> None:
    session = FakeSession([FakeResponse(content=b"bytes")])
    target = tmp_path / "out.bin"
    ts.download_file("https://x/y.bin", target, session)  # type: ignore[arg-type]
    assert target.read_bytes() == b"bytes"


def test_download_file_error(tmp_path: Path) -> None:
    session = FakeSession([requests.ConnectionError("nope")])
    with pytest.raises(ts.TweetUnavailableError, match="Failed to download"):
        ts.download_file("https://x/y.bin", tmp_path / "o", session)  # type: ignore[arg-type]


def test_media_filename_fallback() -> None:
    assert ts._media_filename("https://x/photo.jpg", "fb") == "photo.jpg"
    # A URL with no filename component falls back.
    assert ts._media_filename("https://x/", "fb.jpg") == "fb.jpg"


def test_localize_media(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def fake_download(url: str, target: Path, session: Any) -> None:
        del url, session
        target.write_bytes(b"x")

    monkeypatch.setattr(ts, "download_file", fake_download)
    snapshot = ts.normalize(RAW_TWEET, "555")
    ts.localize_media(snapshot, tmp_path / "555", FakeSession([]))  # type: ignore[arg-type]
    cdn = f"{ts.CDN_BASE_URL}/static/tweets/555"
    assert snapshot["author"]["avatarSrc"].startswith(cdn)
    assert snapshot["media"][0]["src"].startswith(cdn)
    assert snapshot["media"][1]["poster"].startswith(cdn)


@contextlib.contextmanager
def _fake_config() -> Iterator[Path]:
    yield Path("/tmp/fake.conf")


def test_upload_snapshot(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(r2_sync, "rclone_config", _fake_config)
    monkeypatch.setattr(
        r2_sync, "rclone", lambda args, cfg: calls.append(list(args))
    )

    staging = tmp_path / "1"
    staging.mkdir()
    (staging / "avatar.jpg").write_bytes(b"x")
    snapshot_path = tmp_path / "1.json"
    snapshot_path.write_text("{}", encoding="utf-8")

    ts.upload_snapshot({"id": "1"}, snapshot_path, staging)
    assert calls[0][0] == "copy"
    assert calls[1][0] == "copyto"


def test_upload_snapshot_no_media(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(r2_sync, "rclone_config", _fake_config)
    monkeypatch.setattr(
        r2_sync, "rclone", lambda args, cfg: calls.append(list(args))
    )

    staging = tmp_path / "1"
    staging.mkdir()
    snapshot_path = tmp_path / "1.json"
    snapshot_path.write_text("{}", encoding="utf-8")

    ts.upload_snapshot({"id": "1"}, snapshot_path, staging)
    # Only the JSON copyto runs when there is no media.
    assert [c[0] for c in calls] == ["copyto"]


def test_download_snapshot_success(tmp_path: Path) -> None:
    snapshot_path = tmp_path / "1.json"
    session = FakeSession([FakeResponse(json_data={"id": "1"})])
    assert ts.download_snapshot("1", snapshot_path, session) == {"id": "1"}  # type: ignore[arg-type]
    assert snapshot_path.exists()


def test_download_snapshot_missing(tmp_path: Path) -> None:
    session = FakeSession([requests.HTTPError("404")])
    with pytest.raises(
        ts.TweetUnavailableError, match="no snapshot on the CDN"
    ):
        ts.download_snapshot("1", tmp_path / "1.json", session)  # type: ignore[arg-type]


def test_resolve_snapshot_pinned(tmp_path: Path) -> None:
    (tmp_path / "1.json").write_text(
        '{"id": "1", "pinned": true}', encoding="utf-8"
    )
    result = ts.resolve_snapshot("1", tmp_path, FakeSession([]), write=False)  # type: ignore[arg-type]
    assert result["pinned"] is True


def test_resolve_snapshot_live_and_write(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ts, "fetch_tweet_result", lambda tid, s: RAW_TWEET)
    monkeypatch.setattr(ts, "localize_media", lambda snap, d, s: None)
    uploaded: list[str] = []
    monkeypatch.setattr(
        ts, "upload_snapshot", lambda snap, p, d: uploaded.append(snap["id"])
    )
    result = ts.resolve_snapshot("777", tmp_path, FakeSession([]), write=True)  # type: ignore[arg-type]
    assert result["id"] == "777"
    assert uploaded == ["777"]
    assert (tmp_path / "777.json").exists()


def test_resolve_snapshot_no_write(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ts, "fetch_tweet_result", lambda tid, s: RAW_TWEET)
    monkeypatch.setattr(ts, "localize_media", lambda snap, d, s: None)
    monkeypatch.setattr(
        ts, "upload_snapshot", lambda *a: pytest.fail("should not upload")
    )
    result = ts.resolve_snapshot("778", tmp_path, FakeSession([]), write=False)  # type: ignore[arg-type]
    assert result["id"] == "778"


def test_resolve_snapshot_force_refetches_pinned(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "780.json").write_text('{"stale": true}', encoding="utf-8")
    monkeypatch.setattr(ts, "fetch_tweet_result", lambda tid, s: RAW_TWEET)
    monkeypatch.setattr(ts, "localize_media", lambda snap, d, s: None)
    uploaded: list[str] = []
    monkeypatch.setattr(
        ts, "upload_snapshot", lambda snap, p, d: uploaded.append(snap["id"])
    )
    result = ts.resolve_snapshot(
        "780",
        tmp_path,
        FakeSession([]),
        write=True,
        force=True,  # type: ignore[arg-type]
    )
    assert result["id"] == "780"
    assert uploaded == ["780"]


def test_resolve_snapshot_falls_back_to_r2(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def fail_live(tid: str, session: Any) -> dict:
        raise ts.TweetUnavailableError("deleted")

    monkeypatch.setattr(ts, "fetch_tweet_result", fail_live)
    monkeypatch.setattr(
        ts,
        "download_snapshot",
        lambda tid, path, session: {"id": tid, "fromR2": True},
    )
    result = ts.resolve_snapshot("779", tmp_path, FakeSession([]), write=False)  # type: ignore[arg-type]
    assert result["fromR2"] is True


def test_process_all(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    (content / "p.md").write_text(
        "```tweet\nhttps://x.com/u/status/11111\n```\n", encoding="utf-8"
    )
    cache = tmp_path / "cache"
    cache.mkdir()
    (cache / "11111.json").write_text('{"id": "11111"}', encoding="utf-8")
    ids = ts.process_all(content, cache, write=False)
    assert ids == ["11111"]


def test_process_all_skips_unavailable(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    content = tmp_path / "content"
    content.mkdir()
    (content / "p.md").write_text(
        "```tweet\nhttps://x.com/u/status/33333\n```\n", encoding="utf-8"
    )

    def fail(
        tweet_id: str,
        cache_dir: Path,
        session: Any,
        *,
        write: bool,
        force: bool = False,
    ) -> dict:
        raise ts.TweetUnavailableError("gone")

    monkeypatch.setattr(ts, "resolve_snapshot", fail)
    assert ts.process_all(content, tmp_path / "cache", write=False) == []


def test_main_default(tmp_path: Path) -> None:
    content = tmp_path / "content"
    content.mkdir()
    (content / "p.md").write_text(
        "```tweet\nhttps://x.com/u/status/11111\n```\n", encoding="utf-8"
    )
    cache = tmp_path / "cache"
    cache.mkdir()
    (cache / "11111.json").write_text('{"id": "11111"}', encoding="utf-8")
    rc = ts.main(["--content-dir", str(content), "--cache-dir", str(cache)])
    assert rc == 0


def test_main_write_checks_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    checked: list[bool] = []
    monkeypatch.setattr(
        ts.script_utils, "check_r2_env", lambda: checked.append(True)
    )
    content = tmp_path / "content"
    content.mkdir()
    (content / "p.md").write_text(
        "```tweet\nhttps://x.com/u/status/11111\n```\n", encoding="utf-8"
    )
    cache = tmp_path / "cache"
    cache.mkdir()
    (cache / "11111.json").write_text('{"id": "11111"}', encoding="utf-8")
    rc = ts.main(
        ["--write", "--content-dir", str(content), "--cache-dir", str(cache)]
    )
    assert rc == 0
    assert checked == [True]
