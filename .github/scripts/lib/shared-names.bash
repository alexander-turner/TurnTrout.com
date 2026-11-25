# shellcheck shell=bash
# Bash reader for shared-names.json — the names bash and non-bash consumers must
# spell identically (see that file's `comment` for the problem class).
#
# Sourcing this defines the variables below. It reads the JSON at source time, so
# a malformed file fails the caller immediately rather than leaving every name an
# empty string — an empty label name would make `gh pr edit --add-label ""` fail
# obscurely, and an empty status context would silently match nothing.

# Sourced by more than one lib in the same process (each names its dependency
# explicitly rather than relying on a sibling having sourced it first), so make a
# repeat source free instead of re-running four jq processes.
[[ -n "${_SHARED_NAMES_SOURCED:-}" ]] && return 0
_SHARED_NAMES_SOURCED=1

_SHARED_NAMES_JSON="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/shared-names.json"

[[ -f "$_SHARED_NAMES_JSON" ]] || {
  echo "shared-names: ${_SHARED_NAMES_JSON} is missing; refusing to guess label and status names." >&2
  return 1
}

# One jq pass per name, each with -e so a missing key is an error rather than the
# string "null" reaching a gh command.
_LABEL_MERGE_CONFLICT="$(jq -re '.pr_labels.merge_conflict' "$_SHARED_NAMES_JSON")"
_LABEL_AUTO_RESOLVE_BLOCKED="$(jq -re '.pr_labels.auto_resolve_blocked' "$_SHARED_NAMES_JSON")"
_CONFLICT_MARKER_RE="$(jq -re '.template_sync.conflict_marker_re' "$_SHARED_NAMES_JSON")"

export _LABEL_MERGE_CONFLICT _LABEL_AUTO_RESOLVE_BLOCKED
export _CONFLICT_MARKER_RE
