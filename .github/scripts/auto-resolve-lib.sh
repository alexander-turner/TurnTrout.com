# shellcheck shell=bash
# Shared by the auto-resolve PREPARE, BUNDLE and LAND steps (sourced, not run).

# One spelling of "this line marks an unresolved hunk", so the bundling job and
# the landing job cannot disagree about what a leftover conflict looks like.
# shellcheck disable=SC2034  # read by the scripts that source this file, which shellcheck lints separately
CONFLICT_MARKER_RE='^(<{7}|={7}|>{7})([ \t]|$)'

# The ref the resolved merge commit travels under, inside the git bundle that
# crosses from the credential-less BUNDLE job to the LAND job. Deliberately not
# under refs/heads/: nothing should mistake it for a branch to publish.
# shellcheck disable=SC2034  # read by the scripts that source this file, which shellcheck lints separately
AUTO_RESOLVE_RESULT_REF='refs/auto-resolve/result'

# Areas where a machine resolution wants a human's eye before merge (by default
# this repo's Claude config and its CI machinery). LAND re-derives the matches
# from the conflicts it computed itself rather than believing a list handed to
# it, so this predicate is the only definition of "protected".
auto_resolve_protected_re() {
  printf '%s' "${AUTO_RESOLVE_PROTECTED_RE:-^(\.claude/|\.github/)}"
}

# Echoes the subset of its arguments that lie in a protected area, one per line.
protected_matches() {
  local re f
  re="$(auto_resolve_protected_re)"
  for f in "$@"; do
    [[ "$f" =~ $re ]] && printf '%s\n' "$f"
  done
  return 0
}

# Authenticates git over HTTPS with TOKEN for the rest of this process, without
# writing the token into .git/config (every checkout here is
# persist-credentials: false). It RESETS GIT_CONFIG_COUNT rather than appending:
# re-authenticating with a second token must replace the first token's header,
# and starting from 1 also discards any GIT_CONFIG_* transport override an
# earlier step left in the environment.
git_auth_header() {
  local basic
  basic="$(printf 'x-access-token:%s' "${1:?token required}" | base64 | tr -d '\n')"
  export GIT_CONFIG_COUNT=1
  export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
  export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${basic}"
}

# Marks the PR as one auto-resolve must not spend on again until a human acts.
# discover excludes the label, so a permanent blocker (a missing push token, a
# revoked scope) costs one resolution rather than one per base-branch push.
apply_blocked_label() {
  local pr="${1:?PR required}"
  # echo-fallback-ok: the label may already exist from a concurrent run; the add below is the operative step
  gh label create auto-resolve-blocked --color e4e669 --force \
    --description "Auto-resolve cannot push to this PR; remove the label to let it retry" ||
    echo "[auto-resolve] gh label create failed" >&2
  # echo-fallback-ok: best-effort label add; the caller still exits red with the remedy
  gh pr edit "$pr" --add-label auto-resolve-blocked ||
    echo "[auto-resolve] failed to add auto-resolve-blocked label to PR #${pr}" >&2
}

# True when git cannot merge the conflicted path textually: `-merge`-attributed
# (a lockfile) or binary. Git leaves such a conflict with NO markers and the
# working tree at "ours", so no marker-based resolution exists — only a human
# rerunning the owning tool (relock, re-export) can produce correct content.
# Callable only mid-merge (reads MERGE_HEAD).
is_unmergeable() {
  [[ "$(git check-attr merge -- "$1")" == *": merge: unset" ]] ||
    [[ "$(git diff --numstat HEAD MERGE_HEAD -- "$1" | cut -f1)" == "-" ]]
}

# True when this repo defines a `resolve-generated` npm script — an OPTIONAL
# deterministic pre-pass that regenerates/stages fully-generated conflicted
# files so the LLM only ever sees genuine source conflicts. Most repos have no
# such generator; when the script is absent the pre-pass is skipped and every
# conflict falls through to the LLM/unresolvable classification unchanged.
has_resolve_generated() {
  [[ -f package.json ]] &&
    jq -e '(.scripts // {}) | has("resolve-generated")' package.json >/dev/null 2>&1
}
