"""Tests for transcribe_videos.py."""

import shutil
import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest

from .. import transcribe_videos

requires_ffmpeg = pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg/ffprobe not available in this environment",
)


def _resp(json_data: object) -> mock.MagicMock:
    """A MagicMock mimicking a successful ``requests.Response``."""
    response = mock.MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = json_data
    return response


# --- Audio detection (mocked subprocess) ---


@pytest.mark.parametrize(
    "stdout, expected",
    [("audio\n", True), ("", False)],
)
def test_has_audio_stream(stdout: str, expected: bool):
    with mock.patch(
        "subprocess.run",
        return_value=subprocess.CompletedProcess([], 0, stdout=stdout),
    ):
        assert transcribe_videos.has_audio_stream(Path("v.mp4")) is expected


@pytest.mark.parametrize(
    "stderr, expected",
    [
        ("mean_volume: -91.0 dB", True),  # below threshold -> silent
        ("mean_volume: -12.3 dB", False),  # above threshold -> not silent
        ("no volume line here", True),  # unmeasurable -> silent
    ],
)
def test_is_silent(stderr: str, expected: bool):
    with mock.patch(
        "subprocess.run",
        return_value=subprocess.CompletedProcess([], 0, stderr=stderr),
    ):
        assert transcribe_videos.is_silent(Path("v.mp4")) is expected


@pytest.mark.parametrize(
    "has_stream, silent, expected",
    [
        (False, False, False),  # no audio stream short-circuits
        (True, True, False),  # silent stream
        (True, False, True),  # real audio
    ],
)
def test_has_real_audio(has_stream: bool, silent: bool, expected: bool):
    with (
        mock.patch.object(
            transcribe_videos, "has_audio_stream", return_value=has_stream
        ),
        mock.patch.object(
            transcribe_videos, "is_silent", return_value=silent
        ) as is_silent,
    ):
        assert transcribe_videos.has_real_audio(Path("v.mp4")) is expected
    # is_silent must not run when there is no audio stream.
    assert is_silent.called is has_stream


# --- Scriberr client (mocked HTTP) ---


def test_upload(tmp_path: Path):
    video = tmp_path / "talk.mp4"
    video.write_bytes(b"data")
    with mock.patch.object(
        transcribe_videos._http_session, "post", return_value=_resp({"id": 7})
    ) as post:
        job_id = transcribe_videos._upload(video, "http://s", "key")
    assert job_id == "7"
    assert (
        post.call_args.args[0] == "http://s/api/v1/transcription/upload-video"
    )
    assert post.call_args.kwargs["headers"] == {"X-API-Key": "key"}
    assert transcribe_videos._UPLOAD_FIELD in post.call_args.kwargs["files"]


def test_start():
    with mock.patch.object(
        transcribe_videos._http_session, "post", return_value=_resp({})
    ) as post:
        transcribe_videos._start("7", "http://s", "key")
    assert post.call_args.args[0].endswith("/api/v1/transcription/7/start")
    assert post.call_args.kwargs["json"] == {}


def test_get_status():
    with mock.patch.object(
        transcribe_videos._http_session,
        "get",
        return_value=_resp({"status": "processing"}),
    ):
        assert (
            transcribe_videos._get_status("7", "http://s", "key")
            == "processing"
        )


def test_poll_until_done_completes_immediately():
    with (
        mock.patch.object(
            transcribe_videos, "_get_status", return_value="completed"
        ),
        mock.patch.object(transcribe_videos.time, "sleep") as sleep,
    ):
        transcribe_videos._poll_until_done("7", "http://s", "key")
    sleep.assert_not_called()


def test_poll_until_done_waits_then_completes():
    with (
        mock.patch.object(
            transcribe_videos,
            "_get_status",
            side_effect=["processing", "completed"],
        ),
        mock.patch.object(transcribe_videos.time, "sleep") as sleep,
    ):
        transcribe_videos._poll_until_done("7", "http://s", "key")
    sleep.assert_called_once()


def test_poll_until_done_raises_on_failure():
    with (
        mock.patch.object(
            transcribe_videos, "_get_status", return_value="failed"
        ),
        mock.patch.object(transcribe_videos.time, "sleep"),
        pytest.raises(RuntimeError, match="failed"),
    ):
        transcribe_videos._poll_until_done("7", "http://s", "key")


def test_poll_until_done_times_out(monkeypatch):
    monkeypatch.setattr(transcribe_videos, "_MAX_POLLS", 2)
    with (
        mock.patch.object(
            transcribe_videos, "_get_status", return_value="processing"
        ),
        mock.patch.object(transcribe_videos.time, "sleep"),
        pytest.raises(TimeoutError, match="did not complete"),
    ):
        transcribe_videos._poll_until_done("7", "http://s", "key")


def test_get_transcript_available():
    transcript = {"segments": [{"start": 0, "end": 1, "text": "hi"}]}
    with mock.patch.object(
        transcribe_videos._http_session,
        "get",
        return_value=_resp({"available": True, "transcript": transcript}),
    ):
        assert (
            transcribe_videos._get_transcript("7", "http://s", "key")
            == transcript
        )


def test_get_transcript_unavailable_raises():
    with (
        mock.patch.object(
            transcribe_videos._http_session,
            "get",
            return_value=_resp({"available": False}),
        ),
        pytest.raises(RuntimeError, match="not available"),
    ):
        transcribe_videos._get_transcript("7", "http://s", "key")


def test_transcribe_requires_config(monkeypatch):
    monkeypatch.delenv(transcribe_videos.SCRIBERR_BASE_URL_ENV, raising=False)
    monkeypatch.delenv(transcribe_videos.SCRIBERR_API_KEY_ENV, raising=False)
    with pytest.raises(RuntimeError, match="not configured"):
        transcribe_videos.transcribe(Path("v.mp4"))


def test_transcribe_happy_path(monkeypatch):
    monkeypatch.setenv(transcribe_videos.SCRIBERR_BASE_URL_ENV, "http://s")
    monkeypatch.setenv(transcribe_videos.SCRIBERR_API_KEY_ENV, "key")
    transcript = {"segments": []}
    with (
        mock.patch.object(
            transcribe_videos, "_upload", return_value="7"
        ) as upload,
        mock.patch.object(transcribe_videos, "_start") as start,
        mock.patch.object(transcribe_videos, "_poll_until_done") as poll,
        mock.patch.object(
            transcribe_videos, "_get_transcript", return_value=transcript
        ),
    ):
        result = transcribe_videos.transcribe(Path("v.mp4"))
    assert result == transcript
    upload.assert_called_once()
    start.assert_called_once_with("7", "http://s", "key")
    poll.assert_called_once_with("7", "http://s", "key")


# --- WebVTT conversion ---


def test_format_timestamp_negative_raises():
    with pytest.raises(ValueError, match="non-negative"):
        transcribe_videos.format_timestamp(-0.1)


@pytest.mark.parametrize(
    "seconds, expected",
    [
        (0, "00:00:00.000"),
        (65.4, "00:01:05.400"),
        (3661.25, "01:01:01.250"),
        (59.9996, "00:01:00.000"),  # sub-second rounding carries into minutes
        (3599.9999, "01:00:00.000"),  # carries all the way to hours
    ],
)
def test_format_timestamp(seconds: float, expected: str):
    assert transcribe_videos.format_timestamp(seconds) == expected


@pytest.mark.parametrize(
    "segment, expected",
    [
        ({"text": "  hi  "}, "hi"),
        ({"word": "yo"}, "yo"),
        ({"text": "", "word": "w"}, "w"),
        ({}, ""),
        ({"text": "a < b & c > d"}, "a &lt; b &amp; c &gt; d"),
        ({"text": "look --> here"}, "look --&gt; here"),
    ],
)
def test_cue_text(segment: dict, expected: str):
    assert transcribe_videos._cue_text(segment) == expected


def test_transcript_to_vtt_segments():
    transcript = {
        "segments": [
            {"start": 0.0, "end": 1.5, "text": "Hello there"},
            {"start": 1.5, "end": 2.0, "text": "   "},  # blank -> skipped
            {"start": 2.0, "end": 3.0, "text": "world"},
        ]
    }
    vtt = transcribe_videos.transcript_to_vtt(transcript)
    assert vtt.startswith("WEBVTT\n")
    assert "00:00:00.000 --> 00:00:01.500\nHello there" in vtt
    assert "00:00:02.000 --> 00:00:03.000\nworld" in vtt
    assert vtt.endswith("\n")
    assert "   " not in vtt.split("WEBVTT")[1]


def test_transcript_to_vtt_word_fallback():
    transcript = {
        "word_segments": [{"start": 0.0, "end": 0.5, "word": "hi"}],
    }
    vtt = transcribe_videos.transcript_to_vtt(transcript)
    assert "00:00:00.000 --> 00:00:00.500\nhi" in vtt


def test_transcript_to_vtt_empty():
    assert transcribe_videos.transcript_to_vtt({}) == "WEBVTT\n"


def test_transcript_to_vtt_missing_bounds_raises():
    transcript = {"segments": [{"text": "no timing"}]}
    with pytest.raises(ValueError, match="no start/end"):
        transcribe_videos.transcript_to_vtt(transcript)


# 1.0004 is positive in raw seconds but rounds to the same millisecond cue
# timestamp as the start, which WebVTT forbids just the same.
@pytest.mark.parametrize("end", [1.0, 0.5, 1.0004])
def test_transcript_to_vtt_non_positive_duration_raises(end: float):
    transcript = {"segments": [{"start": 1.0, "end": end, "text": "hi"}]}
    with pytest.raises(ValueError, match="non-positive duration"):
        transcribe_videos.transcript_to_vtt(transcript)


def test_transcript_to_vtt_escapes_cue_text():
    transcript = {"segments": [{"start": 0.0, "end": 1.0, "text": "a & b < c"}]}
    vtt = transcribe_videos.transcript_to_vtt(transcript)
    assert "a &amp; b &lt; c" in vtt


# --- Caption track injection ---


def _write_md(references_dir: Path, name: str, body: str) -> Path:
    references_dir.mkdir(parents=True, exist_ok=True)
    md = references_dir / name
    md.write_text(body, encoding="utf-8")
    return md


def _video_block(stem: str) -> str:
    """A markdown ``<video>`` block with a single MP4 source for *stem*."""
    return (
        f'<video controls><source src="static/images/posts/{stem}.mp4" '
        'type="video/mp4; codecs=hvc1"></video>'
    )


def test_inject_caption_track_adds_track(tmp_path: Path):
    refs = tmp_path / "content"
    md = _write_md(
        refs,
        "post.md",
        '<video controls><source src="static/images/posts/talk.mp4" '
        'type="video/mp4; codecs=hvc1"><source '
        'src="static/images/posts/talk.webm" type="video/webm"></video>\n',
    )
    transcribe_videos.inject_caption_track(Path("x/talk.mp4"), refs)
    updated = md.read_text(encoding="utf-8")
    assert (
        '<track kind="captions" src="static/images/posts/talk.vtt" '
        'srclang="en" label="English"></video>' in updated
    )


def test_inject_caption_track_idempotent(tmp_path: Path):
    refs = tmp_path / "content"
    original = (
        '<video controls><source src="static/images/posts/talk.mp4" '
        'type="video/mp4; codecs=hvc1">'
        '<track kind="captions" src="/static/existing.vtt"></video>\n'
    )
    md = _write_md(refs, "post.md", original)
    transcribe_videos.inject_caption_track(Path("x/talk.mp4"), refs)
    assert md.read_text(encoding="utf-8") == original


def test_inject_caption_track_ignores_other_videos(tmp_path: Path):
    refs = tmp_path / "content"
    original = _video_block("other") + "\n"
    md = _write_md(refs, "post.md", original)
    transcribe_videos.inject_caption_track(Path("x/talk.mp4"), refs)
    assert md.read_text(encoding="utf-8") == original


def test_inject_caption_track_adjacent_blocks(tmp_path: Path):
    """A track lands in the target block without merging the neighbour."""
    refs = tmp_path / "content"
    other_block = _video_block("other")
    talk_block = _video_block("talk")
    md = _write_md(refs, "post.md", f"{other_block}\n{talk_block}\n")
    transcribe_videos.inject_caption_track(Path("x/talk.mp4"), refs)
    updated = md.read_text(encoding="utf-8")
    # The neighbour is untouched; only the talk block gains a track.
    assert f"{other_block}\n" in updated
    assert updated.count("<track") == 1
    assert 'src="static/images/posts/talk.vtt"' in updated


def test_inject_caption_track_stem_not_substring(tmp_path: Path):
    """``bar.mp4`` must not match a ``foobar.mp4`` source (anchored stem)."""
    refs = tmp_path / "content"
    original = _video_block("foobar") + "\n"
    md = _write_md(refs, "post.md", original)
    transcribe_videos.inject_caption_track(Path("x/bar.mp4"), refs)
    assert md.read_text(encoding="utf-8") == original


# --- Asset orchestration ---


_CUED_VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhi\n"


def test_transcribe_video_asset_existing_vtt_skips_but_injects(tmp_path: Path):
    """A pre-existing VTT skips re-transcription without blocking caption
    injection into video blocks written after the original transcription."""
    mp4 = tmp_path / "talk.mp4"
    mp4.write_bytes(b"x")
    (tmp_path / "talk.vtt").write_text(_CUED_VTT, encoding="utf-8")
    refs = tmp_path / "content"
    md = _write_md(refs, "post.md", _video_block("talk") + "\n")
    assert transcribe_videos.transcribe_video_asset(mp4, refs) is False
    assert "talk.vtt" in md.read_text(encoding="utf-8")


def test_transcribe_video_asset_cueless_existing_vtt_raises(tmp_path: Path):
    mp4 = tmp_path / "talk.mp4"
    mp4.write_bytes(b"x")
    (tmp_path / "talk.vtt").write_text("WEBVTT\n", encoding="utf-8")
    with pytest.raises(RuntimeError, match="contains no cues"):
        transcribe_videos.transcribe_video_asset(mp4, tmp_path)


def test_transcribe_video_asset_empty_transcript_raises(tmp_path: Path):
    mp4 = tmp_path / "talk.mp4"
    mp4.write_bytes(b"x")
    with (
        mock.patch.object(
            transcribe_videos, "has_real_audio", return_value=True
        ),
        mock.patch.object(
            transcribe_videos, "transcribe", return_value={"segments": []}
        ),
        pytest.raises(RuntimeError, match="no usable cues"),
    ):
        transcribe_videos.transcribe_video_asset(mp4, tmp_path)
    assert not (tmp_path / "talk.vtt").exists()


def test_transcribe_video_asset_skips_silent(tmp_path: Path):
    mp4 = tmp_path / "talk.mp4"
    mp4.write_bytes(b"x")
    with mock.patch.object(
        transcribe_videos, "has_real_audio", return_value=False
    ):
        assert transcribe_videos.transcribe_video_asset(mp4, tmp_path) is False
    assert not (tmp_path / "talk.vtt").exists()


def test_transcribe_video_asset_happy_path(tmp_path: Path):
    static = tmp_path / "quartz" / "static" / "images" / "posts"
    static.mkdir(parents=True)
    mp4 = static / "talk.mp4"
    mp4.write_bytes(b"x")
    refs = tmp_path / "content"
    _write_md(refs, "post.md", _video_block("talk") + "\n")
    transcript = {"segments": [{"start": 0, "end": 1, "text": "hi"}]}
    with (
        mock.patch.object(
            transcribe_videos, "has_real_audio", return_value=True
        ),
        mock.patch.object(
            transcribe_videos, "transcribe", return_value=transcript
        ),
    ):
        assert transcribe_videos.transcribe_video_asset(mp4, refs) is True
    assert (
        (static / "talk.vtt").read_text(encoding="utf-8").startswith("WEBVTT")
    )
    assert "talk.vtt" in (refs / "post.md").read_text(encoding="utf-8")


# --- main() ---


def test_main_requires_asset_directory(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["transcribe_videos.py"])
    with pytest.raises(SystemExit) as excinfo:
        transcribe_videos.main()
    assert excinfo.value.code == 2  # argparse usage error, not a clean exit


def test_main_skips_when_unconfigured(monkeypatch, capsys):
    monkeypatch.delenv(transcribe_videos.SCRIBERR_BASE_URL_ENV, raising=False)
    monkeypatch.delenv(transcribe_videos.SCRIBERR_API_KEY_ENV, raising=False)
    monkeypatch.setattr(
        sys, "argv", ["transcribe_videos.py", "--asset-directory", "."]
    )
    with mock.patch.object(transcribe_videos, "transcribe_video_asset") as t:
        transcribe_videos.main()
    t.assert_not_called()
    assert "skipping video transcription" in capsys.readouterr().err


def test_main_processes_and_filters(monkeypatch):
    monkeypatch.setenv(transcribe_videos.SCRIBERR_BASE_URL_ENV, "http://s")
    monkeypatch.setenv(transcribe_videos.SCRIBERR_API_KEY_ENV, "key")
    videos = [Path("a.mp4"), Path("skip.mp4"), Path(".hidden.mp4")]
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "transcribe_videos.py",
            "--asset-directory",
            "static",
            "--references-dir",
            "content",
            "--ignore-files",
            "skip.mp4",
        ],
    )
    with (
        mock.patch.object(
            transcribe_videos.script_utils, "get_files", return_value=videos
        ),
        mock.patch.object(
            transcribe_videos, "transcribe_video_asset"
        ) as transcribe_asset,
    ):
        transcribe_videos.main()
    transcribe_asset.assert_called_once_with(Path("a.mp4"), Path("content"))


# --- ffmpeg integration (real audio detection) ---


def _make_video(path: Path, *, audio: str | None) -> None:
    """Create a 1s test video; *audio* is an ffmpeg lavfi source or None."""
    ffmpeg = shutil.which("ffmpeg")
    assert ffmpeg is not None
    cmd = [ffmpeg, "-f", "lavfi", "-i", "testsrc=size=64x64:rate=10"]
    if audio is not None:
        cmd += ["-f", "lavfi", "-i", audio, "-map", "0:v", "-map", "1:a"]
    else:
        cmd += ["-an"]
    cmd += ["-shortest", "-t", "1", "-v", "error", "-y", str(path)]
    subprocess.run(cmd, check=True)


@requires_ffmpeg
def test_audio_detection_integration(tmp_path: Path):
    no_audio = tmp_path / "noaudio.mp4"
    silent = tmp_path / "silent.mp4"
    loud = tmp_path / "loud.mp4"
    _make_video(no_audio, audio=None)
    _make_video(silent, audio="anullsrc")
    _make_video(loud, audio="sine=frequency=440")

    assert transcribe_videos.has_audio_stream(no_audio) is False
    assert transcribe_videos.has_audio_stream(silent) is True
    assert transcribe_videos.is_silent(silent) is True
    assert transcribe_videos.is_silent(loud) is False
    assert transcribe_videos.has_real_audio(no_audio) is False
    assert transcribe_videos.has_real_audio(silent) is False
    assert transcribe_videos.has_real_audio(loud) is True
