"""
Transcribe videos with real audio via a self-hosted Scriberr instance.

For every converted ``.mp4`` in the asset directory that carries a genuine,
non-silent audio stream, this script submits the video to Scriberr (reachable
over Tailscale), waits for the transcription job to finish, writes a sibling
WebVTT file, and injects a ``<track kind="captions">`` into the matching
markdown ``<video>`` block. The VTT then follows the same R2/CDN lifecycle as
the ``.mp4``/``.webm`` sources (see ``r2_upload.py``).

GIF-derived autoplay videos have no audio stream and are skipped, as are
videos that already have a sibling ``.vtt``. Scriberr is the maintainer's
private instance; when ``SCRIBERR_BASE_URL`` / ``SCRIBERR_API_KEY`` are unset
(CI, external contributors) the whole step is skipped with a warning.
"""

import argparse
import os
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    from . import utils as script_utils
except ImportError:  # pragma: no cover
    import utils as script_utils

_http_session = script_utils.http_session()

# Scriberr configuration is read from the environment at call time so the step
# can be skipped gracefully where the instance is unreachable.
SCRIBERR_BASE_URL_ENV = "SCRIBERR_BASE_URL"
SCRIBERR_API_KEY_ENV = "SCRIBERR_API_KEY"

# REST surface of the Scriberr transcription API.
_TRANSCRIPTION_PATH = "/api/v1/transcription"
# Multipart field name expected by ``POST /upload-video``.
_UPLOAD_FIELD = "file"

_REQUEST_TIMEOUT = 300
# Job polling: check status up to ``_MAX_POLLS`` times, ``_POLL_INTERVAL``
# seconds apart (whisperX on a single GPU transcribes a few minutes of speech
# in well under this budget).
_MAX_POLLS = 240
_POLL_INTERVAL = 5.0

# Silence threshold (dBFS) below which an audio stream is treated as silent —
# catches the ``anullsrc`` track that test fixtures emit.
_SILENCE_THRESHOLD_DB = -50.0

_MEAN_VOLUME_RE = re.compile(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB")


def has_audio_stream(video: Path) -> bool:
    """Return True iff *video* contains at least one audio stream."""
    ffprobe = script_utils.find_executable("ffprobe")
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            str(video),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return "audio" in result.stdout


def is_silent(video: Path, threshold_db: float = _SILENCE_THRESHOLD_DB) -> bool:
    """
    Return True iff *video*'s mean audio volume is below *threshold_db*.

    ``ffmpeg -af volumedetect`` writes its measurements to stderr; a missing
    measurement (no decodable audio) is treated as silent.
    """
    ffmpeg = script_utils.find_executable("ffmpeg")
    result = subprocess.run(
        [
            ffmpeg,
            "-i",
            str(video),
            "-af",
            "volumedetect",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    match = _MEAN_VOLUME_RE.search(result.stderr)
    if match is None:
        return True
    return float(match.group(1)) < threshold_db


def has_real_audio(video: Path) -> bool:
    """Return True iff *video* has an audio stream that is not silent."""
    return has_audio_stream(video) and not is_silent(video)


def _config() -> tuple[str | None, str | None]:
    """Return ``(base_url, api_key)`` from the environment."""
    return (
        os.environ.get(SCRIBERR_BASE_URL_ENV),
        os.environ.get(SCRIBERR_API_KEY_ENV),
    )


def _headers(api_key: str) -> dict[str, str]:
    return {"X-API-Key": api_key}


def _upload(video: Path, base_url: str, api_key: str) -> str:
    """Upload *video* to Scriberr and return the created job id."""
    url = f"{base_url}{_TRANSCRIPTION_PATH}/upload-video"
    with open(video, "rb") as handle:
        response = _http_session.post(
            url,
            headers=_headers(api_key),
            files={_UPLOAD_FIELD: (video.name, handle, "video/mp4")},
            timeout=_REQUEST_TIMEOUT,
        )
    response.raise_for_status()
    return str(response.json()["id"])


def _start(job_id: str, base_url: str, api_key: str) -> None:
    """Enqueue the transcription job, letting Scriberr's default model apply."""
    url = f"{base_url}{_TRANSCRIPTION_PATH}/{job_id}/start"
    response = _http_session.post(
        url, headers=_headers(api_key), json={}, timeout=_REQUEST_TIMEOUT
    )
    response.raise_for_status()


def _get_status(job_id: str, base_url: str, api_key: str) -> str:
    """Return the current status string for *job_id*."""
    url = f"{base_url}{_TRANSCRIPTION_PATH}/{job_id}/status"
    response = _http_session.get(
        url, headers=_headers(api_key), timeout=_REQUEST_TIMEOUT
    )
    response.raise_for_status()
    return str(response.json().get("status"))


def _poll_until_done(job_id: str, base_url: str, api_key: str) -> None:
    """
    Block until *job_id* reaches ``completed``.

    Raises ``RuntimeError`` if the job fails and ``TimeoutError`` if it does not
    complete within the polling budget.
    """
    for _ in range(_MAX_POLLS):
        status = _get_status(job_id, base_url, api_key)
        if status == "completed":
            return
        if status == "failed":
            raise RuntimeError(f"Scriberr job {job_id} failed")
        time.sleep(_POLL_INTERVAL)
    raise TimeoutError(
        f"Scriberr job {job_id} did not complete after {_MAX_POLLS} polls"
    )


def _get_transcript(job_id: str, base_url: str, api_key: str) -> dict:
    """Fetch the finished transcript object for *job_id*."""
    url = f"{base_url}{_TRANSCRIPTION_PATH}/{job_id}/transcript"
    response = _http_session.get(
        url, headers=_headers(api_key), timeout=_REQUEST_TIMEOUT
    )
    response.raise_for_status()
    data = response.json()
    if not data.get("available"):
        raise RuntimeError(
            f"Scriberr transcript for job {job_id} is not available"
        )
    return data["transcript"]


def transcribe(video: Path) -> dict:
    """Upload, enqueue, await, and return the transcript for *video*."""
    base_url, api_key = _config()
    if not base_url or not api_key:
        raise RuntimeError(
            "Scriberr is not configured "
            f"({SCRIBERR_BASE_URL_ENV} / {SCRIBERR_API_KEY_ENV})."
        )
    job_id = _upload(video, base_url, api_key)
    _start(job_id, base_url, api_key)
    _poll_until_done(job_id, base_url, api_key)
    return _get_transcript(job_id, base_url, api_key)


def format_timestamp(seconds: float) -> str:
    """Format *seconds* as a WebVTT ``HH:MM:SS.mmm`` cue timestamp."""
    if seconds < 0:
        raise ValueError(f"Timestamp must be non-negative, got {seconds}.")
    total_millis = round(seconds * 1000)
    hours, total_millis = divmod(total_millis, 3_600_000)
    minutes, total_millis = divmod(total_millis, 60_000)
    secs, millis = divmod(total_millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def _cue_text(segment: dict) -> str:
    """Return a segment's caption text (whisperX uses ``text``; word-level
    fallbacks use ``word``)."""
    return str(segment.get("text") or segment.get("word") or "").strip()


def transcript_to_vtt(transcript: dict) -> str:
    """
    Convert a whisperX-style transcript dict to a WebVTT document.

    Reads ``segments`` (one cue per segment), falling back to ``word_segments``
    when no sentence-level segments are present.
    """
    segments = transcript.get("segments") or transcript.get("word_segments", [])
    lines = ["WEBVTT", ""]
    for segment in segments:
        text = _cue_text(segment)
        if not text:
            continue
        start = format_timestamp(segment["start"])
        end = format_timestamp(segment["end"])
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# A single ``<video>…</video>`` block. The tempered ``(?:(?!</video>).)``
# cannot cross a closing tag, so adjacent blocks are never merged into one
# match.
_VIDEO_BLOCK_RE = re.compile(
    r"<video\b[^>]*>(?:(?!</video>).)*</video>", re.DOTALL
)


def _mp4_source_pattern(stem: str) -> re.Pattern[str]:
    """Match a ``<source>`` for ``<stem>.mp4`` (anchored after ``/`` or the
    opening quote so ``bar`` does not match ``foobar``)."""
    return re.compile(rf'<source\s+src="((?:[^"]*/)?{re.escape(stem)}\.mp4)"')


def inject_caption_track(video_path: Path, references_dir: Path) -> None:
    """
    Insert a captions ``<track>`` into each markdown ``<video>`` block that
    plays *video_path*.

    The track's ``src`` mirrors the block's MP4 ``<source>`` path (with the
    suffix swapped to ``.vtt``) so ``r2_upload`` rewrites it to the CDN URL
    alongside the video. Idempotent: blocks that already contain a ``<track>``
    are left untouched.
    """
    source_pattern = _mp4_source_pattern(video_path.stem)

    def replace(match: re.Match[str]) -> str:
        block = match.group(0)
        source = source_pattern.search(block)
        if source is None or "<track" in block:
            return block
        vtt_src = source.group(1)[: -len(".mp4")] + ".vtt"
        track = (
            f'<track kind="captions" src="{vtt_src}" '
            'srclang="en" label="English">'
        )
        return block.replace("</video>", f"{track}</video>")

    for md_file in script_utils.get_files(
        references_dir, (".md",), use_git_ignore=False
    ):
        script_utils.update_markdown_file(
            md_file, lambda content: _VIDEO_BLOCK_RE.sub(replace, content)
        )


def transcribe_video_asset(mp4_path: Path, references_dir: Path) -> bool:
    """
    Transcribe one ``.mp4`` asset and wire up its captions.

    Returns True when a new VTT was produced; False when the asset was skipped
    (existing sibling VTT or no real audio).
    """
    vtt_path = mp4_path.with_suffix(".vtt")
    if vtt_path.exists():
        print(f"Skipping {mp4_path.name}: sibling .vtt already exists")
        return False
    if not has_real_audio(mp4_path):
        print(f"Skipping {mp4_path.name}: no real (non-silent) audio")
        return False

    print(f"Transcribing {mp4_path.name} via Scriberr...")
    transcript = transcribe(mp4_path)
    vtt_path.write_text(transcript_to_vtt(transcript), encoding="utf-8")
    inject_caption_track(mp4_path, references_dir)
    print(f"Wrote captions: {vtt_path.name}")
    return True


def main() -> None:
    """Transcribe every eligible ``.mp4`` in the asset directory."""
    parser = argparse.ArgumentParser(
        description="Transcribe videos with real audio via Scriberr."
    )
    parser.add_argument(
        "--asset-directory",
        type=Path,
        help="Directory containing video assets to transcribe",
    )
    parser.add_argument(
        "--references-dir",
        type=Path,
        default=script_utils.get_git_root() / script_utils.CONTENT_DIR_NAME,
        help="Directory to search for markdown files to update",
    )
    parser.add_argument(
        "--ignore-files",
        nargs="+",
        default=[],
        help="List of filenames to ignore during transcription",
    )
    args = parser.parse_args()

    base_url, api_key = _config()
    if not base_url or not api_key:
        print(
            f"Warning: {SCRIBERR_BASE_URL_ENV} / {SCRIBERR_API_KEY_ENV} not "
            "set; skipping video transcription.",
            file=sys.stderr,
        )
        return

    videos = script_utils.get_files(
        dir_to_search=args.asset_directory,
        filetypes_to_match=(".mp4",),
        use_git_ignore=False,
    )
    for video in videos:
        if video.name in args.ignore_files:
            print(f"Ignoring file: {video}")
            continue
        if video.name.startswith("."):
            print(f"Skipping hidden file: {video}")
            continue
        transcribe_video_asset(video, args.references_dir)


if __name__ == "__main__":
    main()
