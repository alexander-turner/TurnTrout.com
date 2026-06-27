#!/bin/bash
# Background OpenTimestamps worker.
#
# Launched detached by .hooks/post-commit so `git commit` never blocks on
# network I/O. Drains a queue of commit hashes: for each, creates an OTS proof
# and commits it into the .timestamps repo, then pushes the whole batch in a
# single pull/push. A single mkdir lock serializes workers; the lock holder
# keeps draining and re-polls the queue, so commits enqueued while it runs are
# handled in the same run instead of spawning redundant network work.
#
# Best-effort by design: a failed stamp or push is logged and the hash is left
# pending so the next commit retries it. The commit it belongs to is never
# rolled back.

set -uo pipefail

git_root="${OTS_GIT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$git_root" ] || exit 0

# Git hooks don't inherit the interactive PATH; make ots (uv venv) and any
# user-installed tooling resolvable for the detached process.
[ -d "$git_root/.venv/bin" ] && export PATH="$git_root/.venv/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

git_dir="$(git -C "$git_root" rev-parse --absolute-git-dir 2>/dev/null)" || exit 0
state_dir="${OTS_STATE_DIR:-$git_dir/ots-timestamps}"
queue="$state_dir/queue"
lockdir="$state_dir/lock.d"
log_file="$state_dir/worker.log"

timestamps_repo="$git_root/.timestamps"
timestamps_dir="$timestamps_repo/files"

mkdir -p "$state_dir"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$1" >>"$log_file"
}

# Keep the log from growing without bound across many commits.
rotate_log() {
  if [ -f "$log_file" ] && [ "$(wc -c <"$log_file" 2>/dev/null || echo 0)" -gt 1048576 ]; then
    mv -f "$log_file" "$log_file.1" 2>/dev/null || true
  fi
}

# Atomic, portable lock (flock is absent on macOS). Steal a stale lock whose
# owning process is gone so a killed worker can't wedge the queue forever.
acquire_lock() {
  if mkdir "$lockdir" 2>/dev/null; then
    echo $$ >"$lockdir/pid"
    return 0
  fi
  oldpid="$(cat "$lockdir/pid" 2>/dev/null || echo "")"
  if [ -n "$oldpid" ] && ! kill -0 "$oldpid" 2>/dev/null; then
    rm -rf "$lockdir"
    if mkdir "$lockdir" 2>/dev/null; then
      echo $$ >"$lockdir/pid"
      return 0
    fi
  fi
  return 1
}

# shellcheck disable=SC2317  # invoked indirectly via trap
cleanup() {
  rm -rf "$lockdir" 2>/dev/null || true
}

has_unpushed() {
  local n
  n="$(git -C "$timestamps_repo" rev-list --count origin/master..HEAD 2>/dev/null || echo 0)"
  [ "${n:-0}" -gt 0 ]
}

# Create (if needed) and commit the OTS proof for a single commit hash. Both
# steps are idempotent: an existing .ots is reused instead of re-stamped, and an
# already-committed proof is a no-op. So a proof whose commit failed on an
# earlier run is still committed on retry rather than skipped as "done".
stamp_one() {
  local hash="$1"
  local txt_file="$timestamps_dir/$hash.txt"
  local ots_file="$txt_file.ots"

  if [ ! -f "$ots_file" ]; then
    printf '%s' "$hash" >"$txt_file"
    local out
    if ! out="$(ots stamp -m 1 --timeout 30 "$txt_file" 2>&1)"; then
      log "ots stamp failed for $hash: $out"
      return 1
    fi
    if [ ! -f "$ots_file" ]; then
      log "ots produced no .ots file for $hash"
      return 1
    fi
  fi

  if ! git -C "$timestamps_repo" add "files/$hash.txt" "files/$hash.txt.ots" 2>>"$log_file"; then
    log "failed to stage proof for $hash"
    return 1
  fi
  # Nothing staged means the proof is already committed — done.
  if git -C "$timestamps_repo" diff --cached --quiet -- "files/$hash.txt" "files/$hash.txt.ots"; then
    return 0
  fi
  if ! git -C "$timestamps_repo" commit --quiet -m "Add OpenTimestamp proof for commit $hash" 2>>"$log_file"; then
    log "failed to commit proof for $hash"
    return 1
  fi
  return 0
}

# Push every locally committed proof in one pull/push round-trip.
sync_repo() {
  if ! git -C "$timestamps_repo" pull --rebase --quiet origin master 2>>"$log_file"; then
    log "could not pull .timestamps repo"
    return 1
  fi
  if ! git -C "$timestamps_repo" push --quiet 2>>"$log_file"; then
    log "could not push .timestamps repo (no credentials?)"
    return 1
  fi
  return 0
}

# Drain the queue: snapshot it, stamp each hash, re-queue any failures. Returns
# 0 if the queue was fully drained, 1 if it stopped early on a failure (those
# hashes stay queued for the next commit rather than hammering the network).
process_queue() {
  local work="$state_dir/queue.work"
  local failed="$state_dir/queue.failed"
  while [ -s "$queue" ]; do
    mv "$queue" "$work" 2>/dev/null || return 0
    : >"$failed"
    local hash
    while IFS= read -r hash; do
      [ -n "$hash" ] || continue
      stamp_one "$hash" || printf '%s\n' "$hash" >>"$failed"
    done <"$work"
    rm -f "$work"
    if [ -s "$failed" ]; then
      cat "$failed" >>"$queue"
      rm -f "$failed"
      return 1
    fi
    rm -f "$failed"
  done
  return 0
}

if [ ! -d "$timestamps_repo/.git" ]; then
  log ".timestamps repo not set up; skipping"
  exit 0
fi

if ! command -v ots >/dev/null 2>&1; then
  log "ots not found; install opentimestamps-client"
  exit 0
fi

acquire_lock || exit 0
trap cleanup EXIT
rotate_log

# Drain, push, then re-poll so hashes enqueued while we were working get handled
# in this run instead of waiting for the next commit. Stop re-polling once a
# stamp fails — those hashes retry on the next commit.
while :; do
  process_queue
  drained=$?
  if has_unpushed; then
    sync_repo || log "sync deferred; will retry on next commit"
  fi
  { [ "$drained" -eq 0 ] && [ -s "$queue" ]; } || break
done

exit 0
