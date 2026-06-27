"""
Capture self-hosted, tracking-free snapshots of X/Twitter posts.

The render side (``quartz/plugins/transformers/tweetEmbed.ts``) never talks to
Twitter: it reads a normalized JSON snapshot from a local directory. This script
is what populates that directory. For each tweet id referenced by a ``tweet``
fenced block in the content, it:

  1. Fetches the post from X's cookie-free syndication endpoint
     (``cdn.syndication.twimg.com``) — the same no-tracking path ``react-tweet``
     uses.
  2. Mirrors the avatar and any photos/video to R2 under ``static/tweets/<id>/``
     and rewrites the snapshot's media URLs to ``assets.turntrout.com`` (the only
     media host ``built_site_checks`` permits).
  3. Writes the snapshot JSON to the local cache and, in ``--write`` mode, to R2
     at ``static/tweets/<id>.json`` so a later takedown can't break the build.

Resolution order per tweet, so the build is robust and deterministic:

  * A *pinned* snapshot (a JSON already committed in the cache dir) is
    authoritative and is never re-fetched or overwritten — pin a tweet to make
    its embed fully independent of both Twitter and R2.
  * Otherwise: live fetch → existing R2 snapshot → hard error.

Required environment variables for R2 access (see ``scripts/r2_sync.py``):
    - ACCESS_KEY_ID_TURNTROUT_MEDIA
    - SECRET_ACCESS_TURNTROUT_MEDIA
    - S3_ENDPOINT_ID_TURNTROUT_MEDIA
"""

import argparse
import datetime
import json
import math
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests

try:
    from . import r2_sync
    from . import utils as script_utils
except ImportError:
    import r2_sync
    import utils as script_utils

# Where the build (and this script) read/write snapshots. Gitignored except for
# pinned snapshots, which are committed deliberately.
CACHE_DIR: Path = (
    script_utils.get_git_root()
    / "quartz"
    / "plugins"
    / "transformers"
    / ".tweet_snapshots"
)

# R2 layout. Media for a tweet lives under ``static/tweets/<id>/`` and the
# snapshot JSON at ``static/tweets/<id>.json``.
R2_TWEETS_PREFIX = "static/tweets"
CDN_BASE_URL = script_utils.CDN_BASE_URL

SYNDICATION_ENDPOINT = "https://cdn.syndication.twimg.com/tweet-result"

# A ```tweet fenced block whose body is a single tweet URL or bare id.
TWEET_BLOCK_RE = re.compile(
    r"^```tweet[ \t]*\n(?P<body>.*?)\n```[ \t]*$",
    re.MULTILINE | re.DOTALL,
)
# Pull the numeric status id out of an x.com / twitter.com / xcancel.com URL,
# or accept a bare id. Keep in sync with TWEET_ID_RE in tweetEmbed.ts.
TWEET_ID_RE = re.compile(r"(?:status(?:es)?/)?(?P<id>\d{5,25})")


class TweetUnavailableError(RuntimeError):
    """Raised when a tweet can be resolved from neither Twitter nor R2."""


def _now() -> datetime.datetime:
    """Indirection so tests can pin the snapshot timestamp."""
    return datetime.datetime.now(datetime.UTC)


def extract_tweet_id(text: str) -> str:
    """Return the numeric tweet id contained in ``text`` (a URL or bare id)."""
    match = TWEET_ID_RE.search(text.strip())
    if not match:
        raise ValueError(f"No tweet id found in {text!r}")
    return match.group("id")


def parse_block_ids(body: str) -> list[str]:
    """Parse a ``tweet`` block body (one URL or bare id per line) into ids."""
    ids: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if line:
            ids.append(extract_tweet_id(line))
    return ids


def find_tweet_ids(content_dir: Path) -> dict[str, Path]:
    """
    Map every tweet id referenced by a ``tweet`` fenced block to the markdown
    file that references it (first occurrence wins, for error messages).

    A block may list several tweets (a thread), one per line.
    """
    found: dict[str, Path] = {}
    for md_file in script_utils.get_files(
        content_dir, (".md",), use_git_ignore=False
    ):
        text = md_file.read_text(encoding="utf-8")
        for block in TWEET_BLOCK_RE.finditer(text):
            for tweet_id in parse_block_ids(block.group("body")):
                found.setdefault(tweet_id, md_file)
    return found


def derive_token(tweet_id: str) -> str:
    """
    Reproduce the syndication API's request token.

    The endpoint rejects requests
    without it; the algorithm is the one ``react-tweet`` uses.
    """
    value = (int(tweet_id) / 1e15) * math.pi
    # Base-36 of the fractional-scaled id, with zeros and the dot stripped.
    base36 = _to_base36(value)
    return re.sub(r"(0+|\.)", "", base36)


def _to_base36(value: float) -> str:
    """Render a non-negative float in base 36, mirroring JS
    ``Number.toString(36)``."""
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    whole = int(value)
    frac = value - whole

    if whole == 0:
        int_part = "0"
    else:
        chars = []
        n = whole
        while n > 0:
            chars.append(digits[n % 36])
            n //= 36
        int_part = "".join(reversed(chars))

    if frac == 0:
        return int_part

    frac_chars = []
    # 12 places is plenty of entropy for a request token and keeps the loop bounded.
    for _ in range(12):
        frac *= 36
        digit = int(frac)
        frac_chars.append(digits[digit])
        frac -= digit
        if frac == 0:
            break
    return f"{int_part}.{''.join(frac_chars)}"


def fetch_tweet_result(tweet_id: str, session: requests.Session) -> dict:
    """
    Fetch the raw syndication payload for ``tweet_id``.

    Raises ``TweetUnavailableError`` for deleted/protected tweets (tombstones or
    a 404) and for any network failure.
    """
    params = {
        "id": tweet_id,
        "token": derive_token(tweet_id),
        "lang": "en",
    }
    try:
        response = session.get(SYNDICATION_ENDPOINT, params=params, timeout=30)
    except requests.RequestException as error:
        raise TweetUnavailableError(
            f"Network error fetching tweet {tweet_id}: {error}"
        ) from error

    if response.status_code == 404:
        raise TweetUnavailableError(f"Tweet {tweet_id} not found (404)")
    try:
        response.raise_for_status()
    except requests.RequestException as error:
        raise TweetUnavailableError(
            f"Bad response fetching tweet {tweet_id}: {error}"
        ) from error

    try:
        data = response.json()
    except ValueError as error:
        raise TweetUnavailableError(
            f"Tweet {tweet_id} returned a non-JSON response"
        ) from error
    if data.get("__typename") == "TweetTombstone":
        raise TweetUnavailableError(
            f"Tweet {tweet_id} is a tombstone (removed)"
        )
    if "user" not in data:
        raise TweetUnavailableError(
            f"Tweet {tweet_id} payload missing user data"
        )
    return data


def _avatar_url(profile_image_url: str) -> str:
    """Upgrade a ``_normal`` avatar URL to the crisp 400x400 variant."""
    return re.sub(r"_normal(\.\w+)$", r"_400x400\1", profile_image_url)


def _best_video_variant(variants: list[dict]) -> str | None:
    """Pick the highest-bitrate MP4 variant from a video's variant list."""
    mp4s = [v for v in variants if v.get("content_type") == "video/mp4"]
    if not mp4s:
        return None
    best = max(mp4s, key=lambda v: int(v.get("bitrate", 0)))
    return best.get("url")


def normalize(raw: dict, tweet_id: str) -> dict:
    """
    Convert a raw syndication payload into our snapshot schema.

    Media URLs still
    point at twimg here; ``localize_media`` rewrites them to the CDN.
    """
    user = raw["user"]
    handle = user["screen_name"]

    media: list[dict] = []
    for detail in raw.get("mediaDetails", []) or []:
        media_type = detail.get("type")
        info = detail.get("original_info", {}) or {}
        if media_type == "photo":
            media.append(
                {
                    "type": "photo",
                    "src": detail["media_url_https"],
                    "width": info.get("width"),
                    "height": info.get("height"),
                    "alt": detail.get("ext_alt_text") or "",
                }
            )
        elif media_type in ("video", "animated_gif"):
            variants = (detail.get("video_info", {}) or {}).get("variants", [])
            src = _best_video_variant(variants)
            if src:
                media.append(
                    {
                        "type": "video",
                        "src": src,
                        "poster": detail.get("media_url_https"),
                        "width": info.get("width"),
                        "height": info.get("height"),
                        "alt": detail.get("ext_alt_text") or "",
                        "loop": media_type == "animated_gif",
                    }
                )

    urls = [
        {
            "url": entity["url"],
            "display": entity.get("display_url", entity["url"]),
            "expanded": entity.get("expanded_url", entity["url"]),
        }
        for entity in (raw.get("entities", {}) or {}).get("urls", []) or []
    ]

    return {
        "id": tweet_id,
        "url": f"https://xcancel.com/{handle}/status/{tweet_id}",
        "author": {
            "name": user["name"],
            "handle": handle,
            "verified": bool(
                user.get("verified") or user.get("is_blue_verified")
            ),
            "avatarSrc": _avatar_url(user["profile_image_url_https"]),
        },
        "createdAt": raw.get("created_at", ""),
        "text": raw.get("text", ""),
        "urls": urls,
        "media": media,
        "snapshotAt": _now().isoformat(),
    }


def download_file(url: str, target: Path, session: requests.Session) -> None:
    """Stream ``url`` to ``target``, raising ``TweetUnavailableError`` on
    failure."""
    try:
        with session.get(url, stream=True, timeout=60) as response:
            response.raise_for_status()
            response.raw.decode_content = True
            # skipcq: PTC-W6004 — target is an internally-built staging path
            # (staging_dir / a fixed role name like "avatar.jpg"), never user input.
            with open(target, "wb") as out_file:
                for chunk in response.iter_content(chunk_size=1 << 16):
                    out_file.write(chunk)
    except requests.RequestException as error:
        raise TweetUnavailableError(
            f"Failed to download tweet media {url}: {error}"
        ) from error


# Twitter serves all post media from these two hosts. Refusing anything else
# stops a malicious/compromised syndication payload from pointing a download at
# an internal address while this runs with R2 credentials in the environment.
MEDIA_HOSTS = frozenset({"pbs.twimg.com", "video.twimg.com"})


def _assert_media_host(url: str) -> None:
    host = urlparse(url).hostname or ""
    if host not in MEDIA_HOSTS:
        raise TweetUnavailableError(
            f"Refusing to download tweet media from untrusted host: {host or url!r}"
        )


def localize_media(
    snapshot: dict, staging_dir: Path, session: requests.Session
) -> None:
    """
    Download the avatar and every media asset into ``staging_dir`` and rewrite
    the snapshot's URLs to their eventual CDN locations under
    ``static/tweets/<id>/``.

    Each asset is stored under a role-and-index name (``avatar``, ``media-0``,
    ``poster-0`` …) so two assets that happen to share a basename can't clobber
    each other. Mutates ``snapshot`` in place.
    """
    tweet_id = snapshot["id"]
    staging_dir.mkdir(parents=True, exist_ok=True)
    cdn_prefix = f"{CDN_BASE_URL}/{R2_TWEETS_PREFIX}/{tweet_id}"

    def localize(url: str, name: str) -> str:
        _assert_media_host(url)
        filename = f"{name}{Path(urlparse(url).path).suffix}"
        download_file(url, staging_dir / filename, session)
        return f"{cdn_prefix}/{filename}"

    snapshot["author"]["avatarSrc"] = localize(
        snapshot["author"]["avatarSrc"], "avatar"
    )

    for index, item in enumerate(snapshot["media"]):
        item["src"] = localize(item["src"], f"media-{index}")
        if item.get("poster"):
            item["poster"] = localize(item["poster"], f"poster-{index}")


def _snapshot_json_remote(tweet_id: str) -> str:
    return f"r2:{r2_sync.R2_BUCKET}/{R2_TWEETS_PREFIX}/{tweet_id}.json"


def _media_remote(tweet_id: str) -> str:
    return f"r2:{r2_sync.R2_BUCKET}/{R2_TWEETS_PREFIX}/{tweet_id}/"


def upload_snapshot(
    snapshot: dict, snapshot_path: Path, staging_dir: Path
) -> None:
    """Push the snapshot JSON and its staged media to R2."""
    tweet_id = snapshot["id"]
    with r2_sync.rclone_config() as config:
        if any(staging_dir.iterdir()):
            r2_sync.rclone(
                [
                    "copy",
                    str(staging_dir),
                    _media_remote(tweet_id),
                    "--checksum",
                ],
                config,
            )
        r2_sync.rclone(
            ["copyto", str(snapshot_path), _snapshot_json_remote(tweet_id)],
            config,
        )


def _snapshot_cdn_url(tweet_id: str) -> str:
    return f"{CDN_BASE_URL}/{R2_TWEETS_PREFIX}/{tweet_id}.json"


def download_snapshot(
    tweet_id: str, snapshot_path: Path, session: requests.Session
) -> dict:
    """
    Pull a previously-captured snapshot JSON from the public CDN into
    ``snapshot_path``.

    Media already lives on the CDN (the snapshot's URLs point
    there), so only the JSON is fetched — no credentials needed. Raises
    ``TweetUnavailableError`` if the CDN has no snapshot.
    """
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        response = session.get(_snapshot_cdn_url(tweet_id), timeout=30)
        response.raise_for_status()
        snapshot = response.json()
    except requests.RequestException as error:
        raise TweetUnavailableError(
            f"Tweet {tweet_id} has no snapshot on the CDN"
        ) from error
    script_utils.atomic_write_json(snapshot, snapshot_path)
    return snapshot


def resolve_snapshot(
    tweet_id: str,
    cache_dir: Path,
    session: requests.Session,
    *,
    write: bool,
    force: bool = False,
) -> dict:
    """
    Ensure ``cache_dir/<id>.json`` holds a usable snapshot, returning it.

    Pinned (already-present) snapshots are authoritative and untouched unless
    ``force`` is set — the periodic R2 refresh passes ``force`` to re-fetch and
    re-upload even pinned tweets, keeping their R2 backup current. Otherwise
    fetch live (mirroring media to R2 and, in ``write`` mode, the JSON too); if
    the live fetch fails, fall back to an existing CDN snapshot.
    """
    snapshot_path = cache_dir / f"{tweet_id}.json"
    if snapshot_path.exists() and not force:
        return json.loads(snapshot_path.read_text(encoding="utf-8"))

    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        raw = fetch_tweet_result(tweet_id, session)
        snapshot = normalize(raw, tweet_id)
        staging_dir = cache_dir / tweet_id
        localize_media(snapshot, staging_dir, session)
        script_utils.atomic_write_json(snapshot, snapshot_path)
        if write:
            upload_snapshot(snapshot, snapshot_path, staging_dir)
        return snapshot
    except TweetUnavailableError as live_error:
        print(
            f"Live fetch failed for {tweet_id} ({live_error}); trying R2.",
            file=sys.stderr,
        )
        return download_snapshot(tweet_id, snapshot_path, session)


def process_all(
    content_dir: Path, cache_dir: Path, *, write: bool, force: bool = False
) -> list[str]:
    """
    Resolve every referenced tweet, returning the ids that resolved.

    Tweets that resolve from neither Twitter nor the CDN are logged and skipped
    (the build renders them as xcancel stubs) so one dead tweet never fails the
    run.
    """
    session = script_utils.http_session()
    ids = find_tweet_ids(content_dir)
    resolved: list[str] = []
    for tweet_id in sorted(ids):
        try:
            resolve_snapshot(
                tweet_id, cache_dir, session, write=write, force=force
            )
            resolved.append(tweet_id)
        except TweetUnavailableError as error:
            print(f"Skipping {tweet_id}: {error}", file=sys.stderr)
    return resolved


def main(argv: list[str] | None = None) -> int:
    """Snapshot every tweet referenced in the content directory."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write",
        action="store_true",
        help="Upload refreshed snapshots to R2 (main builds only).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch and re-upload even tweets that already have a local snapshot.",
    )
    parser.add_argument(
        "--content-dir",
        type=Path,
        default=script_utils.get_git_root() / script_utils.CONTENT_DIR_NAME,
        help="Directory of markdown to scan for tweet blocks.",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=CACHE_DIR,
        help="Local snapshot cache the build reads from.",
    )
    args = parser.parse_args(argv)

    if args.write:
        script_utils.check_r2_env()

    ids = process_all(
        args.content_dir, args.cache_dir, write=args.write, force=args.force
    )
    print(f"Resolved {len(ids)} tweet snapshot(s).")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
