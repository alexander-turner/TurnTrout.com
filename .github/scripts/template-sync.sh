#!/usr/bin/env bash
# kcov-exclude: a behavioral suite runs it as `bash <script>`, so no run is traced.
# Sync template files into the current repo, producing outputs consumed by
# .github/workflows/template-sync.yaml.
#
# Inputs (env):
#   SYNC_PATHS        Space-separated paths to sync from the template (no spaces in a path name)
#   EXCLUDE_PATHS     Space-separated paths to exclude. An entry names one file
#                     or one directory, which covers every file under it.
#   OPT_IN_PATHS      Space-separated paths the template only UPDATES, never INTRODUCES:
#                     absent here they are skipped, present they sync normally.
#   GITHUB_OUTPUT     Path to GitHub Actions output file
#
# Assumes a sibling `_template/` directory holding a checkout of the template repository at the
# desired ref. Reads `.template-version` for the previously synced SHA and overwrites it.
#
# Side effects: creates/updates files in this repo, writes the report files main() names under
# WORK_DIR, and appends key=value lines to $GITHUB_OUTPUT.
#
# SELF-MODIFICATION SAFETY: this script lives under a synced path, so a run rewrites the very file
# bash is executing, and bash re-reads a script between top-level commands. Two things prevent the
# syntax error that would follow: every executable statement lives inside main(), so bash parses
# main()'s whole body from the original bytes before the call rewrites the file; and main() exits
# the shell FROM WITHIN.

set -euo pipefail

<<<<<<< local
# Re-exec from an immutable copy outside any synced path. This script lives
# under .github/scripts, a synced path, so mid-run the sync overwrites its own
# file. bash reads a running script incrementally and, after the trailing
# `main "$@"` returns, resumes reading top-level input at a saved byte offset;
# a longer replacement shifts that offset into the new file's bytes and bash
# executes a truncated fragment ("unexpected EOF while looking for matching
# quote"). The main() wrapper below defers execution but NOT that post-main
# resume, so it is not sufficient on its own. Running from a $TMPDIR copy the
# sync never touches removes the hazard entirely. The re-exec'd pass removes
# its own copy on exit (guard: only when $0 is the copy we created).
if [[ -z "${TEMPLATE_SYNC_REEXEC:-}" ]]; then
  _self_copy="$(mktemp)"
  cat "$0" >"$_self_copy"
  TEMPLATE_SYNC_REEXEC="$_self_copy" exec bash "$_self_copy" "$@"
fi
[[ "${TEMPLATE_SYNC_REEXEC:-}" == "$0" ]] && trap 'rm -f "$0"' EXIT

# Wrap all logic in main(), called as the final line. bash reads a running
# script incrementally from disk, not all at once — this script overwrites
# its own file when SYNC_PATHS includes the directory it lives in, so any
# top-level statement below the self-overwrite would read shifted bytes.
# Deferring everything behind main() forces bash to parse through this
# file's closing brace and the trailing `main "$@"` call before executing
# any of it.
main() {
=======
# INVARIANT — an EXCLUDE_PATHS directory entry must cover every file under it, so the `/`* arm is
# required beside the equality test. The sync tests one file path at a time, so a directory entry
# never equals the path of a file inside it, and an equality-only test would sync every file the
# entry was written to keep out.
is_excluded() {
  local candidate="$1" exclude
  for exclude in "${EXCLUDE_PATHS[@]}"; do
    [[ "$candidate" = "$exclude" || "$candidate" = "$exclude"/* ]] && return 0
  done
  return 1
}

# An OPT_IN_PATHS directory entry covers every file under it, so the
# `/`* arm is required beside the equality test, exactly as in is_excluded.
# A template feature is only correct in a repo with no equivalent of its own: an
# adopter that already publishes releases, and then received the template's own
# version-bump workflow, ran two workflows racing the same bump.
is_opt_in() {
  local candidate="$1" opt_in
  for opt_in in "${OPT_IN_PATHS[@]}"; do
    [[ "$candidate" = "$opt_in" || "$candidate" = "$opt_in"/* ]] && return 0
  done
  return 1
}

# PROBLEM CLASS — a template file this repo deleted comes back on the next sync, since the sync
# copies in any template file the repo does not have; this refusal is what makes the deletion hold.
# The evidence is this repo's own deletion commit, not the template's tree: a commit that deleted
# the path IS this repo saying it does not want the file, where the template tree at PREV_SHA only
# says the file was available then, which is true of every template file this repo never adopted. A
# path with no deletion commit was never here, so it is new and still arrives. The sync checks out
# with `fetch-depth: 0`; a shallow checkout finds no deletion and falls back to copying.
was_deleted_here() {
  [[ "$(git log --diff-filter=D --format=%H -1 -- "$1")" != "" ]]
}

# Emit the `changed_files` and `changelog` outputs. The changelog maps each file this sync rewrote
# to the template commit that explains it, so a reviewer reads intent rather than a raw log.
emit_attributed_changelog() {
  local changed body="" attributed unexplained kept=0 skipped=0
  local -a range
  changed="$WORK_DIR/changed_here.txt"
  attributed="$WORK_DIR/attributed.txt"
  # `sed`, not `grep -v`: an all-filtered list makes grep exit 1 and `set -e`
  # would kill the run. main() rewrites `.template-version` before it calls this
  # and the template ships none, so no commit can ever explain it; `_template` is
  # this script's own untracked checkout, which `--others` reports and main()
  # removes next. Both would land in the unexplained list on every single sync.
  {
    git diff --name-only
    git ls-files --others --exclude-standard
  } | sed -e '/^\.template-version$/d' -e '\#^_template/\?$#d' | sort -u >"$changed"
  [[ -s "$changed" ]] || return 0
  local changed_list
  changed_list="$(tr '\n' ' ' <"$changed")"
  # changed_count is emitted UNCAPPED beside the capped list, because the body leads with "Syncs N
  # file(s)" and counting the truncated list would report the cap's size as the sync's size.
  echo "changed_count=$(wc -l <"$changed" | tr -d ' ')" >>"$GITHUB_OUTPUT"
  local capped_changed
  capped_changed="$(cap_body_field "$changed_list" \
    "${CONFLICT_FILES_MAX_BYTES:-8000}" \
    "… list truncated; the sync log names every changed file.")"
  emit_multiline_output "changed_files" "$capped_changed"

  [[ -n "$PREV_SHA" && "$PREV_SHA" != "$TEMPLATE_SHA" ]] || return 0
  if git -C _template cat-file -e "$PREV_SHA" 2>/dev/null; then
    range=("${PREV_SHA}..${TEMPLATE_SHA}")
  else
    echo "::warning::Previous template SHA $PREV_SHA is not in template history (force-push or rebase); attributing over the last 20 commits instead"
    range=(-20 "$TEMPLATE_SHA")
    body+="\`$PREV_SHA\` is no longer in the template's history, so this reads the last 20 commits rather than a range."$'\n\n'
  fi

  : >"$attributed"
  local sha subject touched f
  while IFS=$'\t' read -r sha subject; do
    [[ -n "$sha" ]] || continue
    # Files this commit touched that this sync also rewrote here. `comm -12`
    # over two sorted lists, so a commit touching only unsynced paths yields
    # nothing and is skipped.
    touched=$(comm -12 \
      <(git -C _template show --pretty=format: --name-only "$sha" | sed '/^$/d' | sort -u) \
      "$changed")
    if [[ -z "$touched" ]]; then
      skipped=$((skipped + 1))
      continue
    fi
    kept=$((kept + 1))
    body+="- \`${sha}\` ${subject}"$'\n'
    while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      body+="  - \`${f}\`"$'\n'
      echo "$f" >>"$attributed"
    done <<<"$touched"
    # --no-merges: `git show --name-only` prints nothing for a merge commit, so
    # a merge would count as "touched nothing here" while being exactly the
    # commit that carried the files. Its branch commits are already in range.
  done < <(git -C _template log --no-merges --format='%h%x09%s' "${range[@]}")

  unexplained=$(comm -23 "$changed" <(sort -u "$attributed"))
  if [[ -n "$unexplained" ]]; then
    body+=$'\n'"Changed here with no commit in that range — a path synced for the first time, or one whose template history moved:"$'\n'
    while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      body+="- \`${f}\`"$'\n'
    done <<<"$unexplained"
  fi
  [[ "$skipped" -eq 0 ]] || body+=$'\n'"${skipped} other template commit(s) in that range touched nothing this repo syncs."$'\n'
  body=$(cap_body_field "$body" "${CHANGELOG_MAX_BYTES:-20000}" \
    "…changelog truncated; read the template's own log for the rest.")
  [[ "$kept" -eq 0 && -z "$unexplained" ]] || emit_multiline_output "changelog" "$body"
}

# A configuration entry that is accepted and matches nothing fails silently: the entry sits in the
# list, the sync copies the file anyway, and the list reads as though it covers the file. The
# warning is what makes a misspelled or stale entry visible. Read the template tree before the run
# deletes it.
report_inert_entries() {
  local entry
  for entry in "${EXCLUDE_PATHS[@]}" "${OPT_IN_PATHS[@]}"; do
    [[ -e "_template/$entry" ]] && continue
    echo "::warning::list entry names nothing in the template: $entry"
    echo "$entry" >>"$INERT_ENTRIES"
  done
}

# A "clean" 3-way merge that silently drops adopter content. The
# base is the single repo-wide PREV_SHA, which is STALE for a file first synced at
# another template SHA, and git then reports a clean merge for a result missing
# lines this repo had. Counts the non-blank lines the result lost against the
# pre-sync local. Sorted, so a line that merely moved does not count. `grep -c`
# exits 1 printing "0" when nothing matches, so the default keeps set -e quiet.
count_dropped_lines() {
  local local_f="$1" result_f="$2" n
  n=$(comm -23 <(sort "$local_f") <(sort "$result_f") |
    grep -cv '^[[:space:]]*$') || n=0
  printf '%s' "${n:-0}"
}

# A conflict marker committed into a file CI itself loads off the branch. GitHub reads every
# workflow file to decide what to run, so markers there leave it unparseable: the run GitHub starts
# has ZERO jobs, a `failure` conclusion, and a display name that falls back to the file path — a red
# naming no cause, replacing every check the workflow was to report. A conflict in one of these
# paths keeps the LOCAL file instead, which is what keeps the branch's workflows parseable.
is_ci_loaded() {
  case "$1" in
  .github/workflows/* | .github/actions/* | .github/scripts/*) return 0 ;;
  *) return 1 ;;
  esac
}

# One conflict-report entry: the path, EXPLANATION, and the local→template diff.
# The diff must be taken before any caller overwrites the local file. This writes the REPORT only;
# each caller decides whether the path also joins CONFLICT_FILES or MARKERLESS_FILES.
record_diff_conflict() {
  local rel_path="$1" template_file="$2" explanation="$3" report="${4:-$CONFLICT_REPORT}" diff_rc=0
  {
    echo "### \`$rel_path\`"
    echo ""
    echo "$explanation"
    echo ""
    echo "<details>"
    echo "<summary>Diff (local → template)</summary>"
    echo ""
    echo '```diff'
    # `awk`, not `head -500`: head stops reading at its limit, so a still-writing diff takes SIGPIPE
    # and the pipeline exits 141 under `set -o pipefail`. diff exits 1 when the files differ, which
    # is every call here; anything above that is a real fault and must not reach the report as an
    # empty diff block.
    diff -u "$rel_path" "$template_file" | awk 'NR <= 500' || diff_rc=$?
    if ((diff_rc > 1)); then
      echo "::error::template-sync: the diff of $rel_path failed (exit $diff_rc)." >&2
      exit 1
    fi
    echo '```'
    echo "</details>"
    echo ""
  } >>"$report"
}

# A conflict in a file CI loads writes nothing and joins MARKERLESS_FILES, the short path list the
# PR body prints ahead of the report. Every other conflict leaves markers in the tree; this one
# writes nothing, so the report is its ONLY record, and the template's version reaches the reviewer
# as a diff.
# INVARIANT — a markerless path never joins CONFLICT_FILES. That output is the resolver's input,
# and template-sync-resolve.sh documents it as marker-bearing paths. A marker-free file handed to
# mergiraf comes back unchanged, which the resolver scores DETERMINISTIC, which arms auto-merge on a
# sync whose own PR body says to port the file by hand.
# A markerless entry goes in its OWN report file, which the emit step puts FIRST. The report takes a
# byte cap, and a marker-bearing file loses nothing when its entry is cut — its content is on the
# branch. A markerless file's entry is the only copy of the template's change anywhere, and the sync
# still advances .template-version, so the next run sees no change and never reports it again.
record_markerless_conflict() {
  local rel_path="$1" template_file="$2" explanation="$3"
  echo "$rel_path" >>"$MARKERLESS_FILES"
  record_diff_conflict "$rel_path" "$template_file" "$explanation" "$MARKERLESS_REPORT"
}

record_ci_loaded_conflict() {
  local rel_path="$1" template_file="$2"
  echo "CONFLICT (local kept, CI loads this file): $rel_path"
  record_markerless_conflict "$rel_path" "$template_file" \
    "**The template change is NOT applied.** CI loads this file off the branch.
A conflict marker in it makes the workflow unloadable, or the step a bash syntax error.
GitHub then reports a failure that names no cause. The sync keeps the local file unchanged.
Port the template's change by hand."
}

# Random sentinel suffix: prefer /proc uuid, fall back to uuidgen/$RANDOM for
# stripped-down environments.
random_token() {
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  else
    printf '%s_%s_%s' "$$" "$RANDOM" "$RANDOM"
  fi
}

# Every field the PR body assembles is capped here, so the body stays under Linux's MAX_ARG_STRLEN
# (128 KiB per single string) and the PR is created. peter-evans/create-pull-request receives `body:`
# as the INPUT_BODY environment variable and the runner exec's node with it, so a single env string
# over that limit makes execve fail with E2BIG and the action never starts. Conflict excerpts, up to
# 500 lines per file across many synced files, blow past it. The truncation lands on an entry
# boundary using byte-accurate head -c/wc -c, never splitting a UTF-8 sequence, a conflict fence or
# a path, and appends a pointer to the branch that carries the rest.
cap_body_field() {
  local content="$1" max="$2" note="$3" bytes cut
  bytes=$(printf '%s' "$content" | wc -c)
  if ((bytes <= max)); then
    printf '%s' "$content"
    return
  fi
  cut=$(head -c "$max" <<<"$content")
  # Trim back to the last separator, newline THEN space: the report and the changelog are
  # newline-separated, while the path lists are ONE space-joined line, where a newline-only trim
  # matches nothing and the tail becomes a fragment that still reads like a real path
  # (`.github/workflows/c`). With no separator at all not one entry fits, so the note goes alone.
  if [[ "$cut" == *$'\n'* ]]; then
    cut="${cut%$'\n'*}"
  elif [[ "$cut" == *' '* ]]; then
    cut="${cut% *}"
  else
    cut=""
  fi
  printf '%s\n\n%s' "$cut" "$note"
}

# Random-suffixed sentinel so user-controlled content can't terminate the
# GITHUB_OUTPUT block early.
emit_multiline_output() {
  local key="$1" content="$2" sentinel
  sentinel="EOF_$(random_token)"
  {
    echo "${key}<<${sentinel}"
    printf '%s\n' "$content"
    echo "$sentinel"
  } >>"$GITHUB_OUTPUT"
}

# merge_file_clean RESULT BASE OTHER — 3-way merge RESULT in place; true on a clean merge, false
# when it wrote conflict markers. git merge-file exits with the CONFLICT COUNT, and with 255 on a
# real failure such as an unreadable path or binary input, so treating "non-zero" as "conflicted"
# would commit a merge that never ran as a merge that conflicted. 255 is separated out and kills the
# sync.
#
# --diff3 is load-bearing, not cosmetic: it writes the `||||||| base` section mergiraf needs to
# re-merge structurally. install-mergiraf.sh proves that contract with a probe carrying that exact
# marker. Without the flag every conflict falls through tier 1 of template-sync-resolve.sh to the
# paid model tier, `all_deterministic` never holds, and no sync auto-merges again — with no red
# anywhere to say so.
merge_file_clean() {
  local rc=0
  git merge-file --diff3 -L "local" -L "base" -L "template" "$1" "$2" "$3" >/dev/null 2>&1 || rc=$?
  if ((rc == 255)); then
    echo "::error::template-sync: git merge-file failed on $1 — refusing to guess at the merge." >&2
    exit 1
  fi
  ((rc == 0))
}

# Resolve a single file's sync outcome using a 3-way merge of the file at PREV_SHA
# (base), the current local file, and the template's HEAD. Decision tree:
#   1. File is new in template → copy it in.
#   2. Files are already identical → no-op.
#   3. No merge base (first sync or lost history) → conflict markers, both sides kept.
#   4. Template is unchanged since base → local diverged alone; keep local.
#   5. Local is unchanged since base → template advanced alone; adopt template.
#   6. Both sides changed → attempt a 3-way merge:
#      a. Clean merge → write merged result.
#      b. Conflict → write conflict markers, so both sides reach the reviewer.
process_file() {
  local rel_path="$1"
  local template_file="_template/$rel_path"

  local parent_dir
  parent_dir=$(dirname "$rel_path")

  # A path the child made a symlink, or one under a symlinked ancestor, is never written; checked
  # before the mkdir below. The child may have made one deliberately — a dotfiles repo pointing
  # `.claude/settings.json` at another repo it clones at runtime — and writing it goes wrong three
  # ways: `cp` through a dangling link errors out, through a live one it escapes into the link
  # target, and `mkdir -p` on a symlinked directory fails outright.
  if [[ -L "$rel_path" ]]; then
    echo "Skipping symlink: $rel_path (local structure preserved)"
    return
  fi
  local ancestor="$parent_dir"
  while [[ "$ancestor" != "." && "$ancestor" != "/" && -n "$ancestor" ]]; do
    if [[ -L "$ancestor" ]]; then
      echo "Skipping under symlinked dir: $rel_path ($ancestor is a symlink)"
      return
    fi
    ancestor=$(dirname "$ancestor")
  done

  [[ "$parent_dir" != "." ]] && mkdir -p "$parent_dir" # bare-mkdir-ok: Linux CI runner (no BSD mkdir -p symlink semantics)

  # Case 1: absent locally — a new template file, unless this repo removed it.
  if [[ ! -f "$rel_path" ]]; then
    if is_opt_in "$rel_path"; then
      echo "Opt-in only, not present locally: $rel_path (copy it from the template to adopt it)"
      return
    fi
    if was_deleted_here "$rel_path"; then
      echo "Declined: $rel_path (deleted here since the last sync; not re-added)"
      echo "$rel_path" >>"$DECLINED_FILES"
      return
    fi
    cp "$template_file" "$rel_path"
    echo "Added: $rel_path"
    return
  fi

  # Case 2: already identical.
  if diff -q "$rel_path" "$template_file" >/dev/null 2>&1; then
    return
  fi

  # Case 3: no merge base — first sync or history unavailable.
  if [[ "$PREV_SHA" = "" ]]; then
    record_no_base_conflict "$rel_path" "$template_file"
    return
  fi

  local safe_name
  safe_name=$(echo "$rel_path" | tr '/' '_')
  local base_file="$WORK_DIR/merge_base_${safe_name}"

  if ! git -C _template show "${PREV_SHA}:${rel_path}" >"$base_file" 2>/dev/null; then
    rm -f "$base_file"
    record_no_base_conflict "$rel_path" "$template_file"
    return
  fi

  # Case 4: template unchanged since base — local diverged alone; keep local.
  if diff -q "$base_file" "$template_file" >/dev/null 2>&1; then
    echo "Unchanged in template: $rel_path (keeping local version)"
    rm -f "$base_file"
    return
  fi

  # Case 5: local unchanged since base — template advanced alone; adopt it.
  if diff -q "$base_file" "$rel_path" >/dev/null 2>&1; then
    cp "$template_file" "$rel_path"
    echo "Updated: $rel_path (local was unmodified)"
    rm -f "$base_file"
    return
  fi

  # Case 6: both sides changed — attempt a 3-way merge.
  local merge_result="$WORK_DIR/merge_result_${safe_name}"
  cp "$rel_path" "$merge_result"

  if merge_file_clean "$merge_result" "$base_file" "$template_file"; then
    # Measured against the pre-sync local, which $rel_path still holds.
    local dropped
    dropped=$(count_dropped_lines "$rel_path" "$merge_result")
    cp "$merge_result" "$rel_path"
    echo "Auto-merged: $rel_path (clean 3-way merge)"
    echo "$rel_path" >>"$AUTO_MERGED_FILES"
    if [[ "${dropped:-0}" -gt 0 ]]; then
      echo "$rel_path" >>"$DOWNGRADE_FILES"
      # The %s are printf specifiers, not shell expansions.
      # shellcheck disable=SC2016
      printf -- '- `%s` — auto-merge dropped %s line(s) present in the local copy\n' \
        "$rel_path" "$dropped" >>"$DOWNGRADE_REPORT"
    fi
    rm -f "$base_file" "$merge_result"
    return
  fi
>>>>>>> template

  # Case 6b: conflict — keep markers so both sides reach the reviewer.
  if is_ci_loaded "$rel_path"; then
    record_ci_loaded_conflict "$rel_path" "$template_file"
    rm -f "$base_file" "$merge_result"
    return
  fi
  cp "$merge_result" "$rel_path"
  echo "CONFLICT (merge markers): $rel_path"
  echo "$rel_path" >>"$CONFLICT_FILES"
  {
    echo "### \`$rel_path\`"
    echo ""
    echo "3-way merge produced **conflict markers** (\`<<<<<<<\`/\`=======\`/\`>>>>>>>\`)."
    echo "Resolve them: keep local customizations, adopt template improvements."
    echo ""
    echo "<details>"
    echo "<summary>View file with conflict markers</summary>"
    echo ""
    echo "\`\`\`"
    head -500 "$rel_path"
    echo "\`\`\`"
    echo "</details>"
    echo ""
  } >>"$CONFLICT_REPORT"
  rm -f "$base_file" "$merge_result"
}

# With no common ancestor the merge runs against an EMPTY base, so a template file with no ancestor
# can never silently replace the local one. The case is not exotic: a file developed here and later
# ported upstream has no ancestor at the previously-synced template SHA, so copying the template
# over it would delete every local change made since the port, with nothing in the diff to show a
# merge was ever skipped.
record_no_base_conflict() {
  local rel_path="$1" template_file="$2"
  if is_ci_loaded "$rel_path"; then
    record_ci_loaded_conflict "$rel_path" "$template_file"
    return
  fi
  local empty_base="$WORK_DIR/empty_base" merge_result="$WORK_DIR/no_base_result"
  : >"$empty_base"
  cp "$rel_path" "$merge_result"
  if merge_file_clean "$merge_result" "$empty_base" "$template_file"; then
    # One side matches the empty base — an empty local file, or an empty template file — so the
    # merge is clean and writes no markers. Taking the result would replace the local file unseen.
    rm -f "$empty_base" "$merge_result"
    echo "CONFLICT (no base, local kept, no markers possible): $rel_path"
    record_markerless_conflict "$rel_path" "$template_file" \
      "**The template change is NOT applied.** One side of this first-sync collision is empty, so a
merge against an empty base is clean and writes no conflict markers. Taking it would replace the
local file with nothing to show a merge was skipped. Port the template's change by hand."
    return
  fi
  echo "CONFLICT (no base): $rel_path"
  record_diff_conflict "$rel_path" "$template_file" \
    "No merge base available (first sync, or the template added this path after the last sync).
Both versions are kept as **conflict markers** (\`<<<<<<<\`/\`=======\`/\`>>>>>>>\`).
Resolve them: keep local customizations, adopt template improvements."
  cp "$merge_result" "$rel_path"
  echo "$rel_path" >>"$CONFLICT_FILES"
  rm -f "$empty_base" "$merge_result"
}

# All file-mutating logic lives here so main()'s body is fully parsed before the call rewrites this
# file — see SELF-MODIFICATION SAFETY in the header. Letting main() return and fall off the end is
# NOT safe: bash reads the next line off disk and hits the rewritten bytes. `main "$@"; exit` on one
# line would work too, but shfmt splits it back onto two, reintroducing the unsafe trailing read.
main() {
  # Read space-separated env strings into arrays so loop sites can use "${arr[@]}".
  read -ra SYNC_PATHS <<<"${SYNC_PATHS:-}"
  read -ra EXCLUDE_PATHS <<<"${EXCLUDE_PATHS:-}"
  read -ra OPT_IN_PATHS <<<"${OPT_IN_PATHS:-}"
  : "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"

  # Allow tests to point at alternative temp dirs.
  WORK_DIR="${TEMPLATE_SYNC_WORK_DIR:-/tmp}"
  CONFLICT_FILES="$WORK_DIR/conflict_files.txt"
  CONFLICT_REPORT="$WORK_DIR/conflict_report.md"
  MARKERLESS_REPORT="$WORK_DIR/markerless_report.md"
  MARKERLESS_FILES="$WORK_DIR/markerless_files.txt"
  DELETED_FILES="$WORK_DIR/deleted_files.txt"
  AUTO_MERGED_FILES="$WORK_DIR/auto_merged_files.txt"
  DECLINED_FILES="$WORK_DIR/declined_files.txt"
  INERT_ENTRIES="$WORK_DIR/inert_entries.txt"
  DOWNGRADE_FILES="$WORK_DIR/downgrade_files.txt"
  DOWNGRADE_REPORT="$WORK_DIR/downgrade_report.md"
  PREV_TEMPLATE_FILES="$WORK_DIR/prev_template_files.txt"

  : >"$CONFLICT_FILES"
  : >"$CONFLICT_REPORT"
  : >"$MARKERLESS_REPORT"
  : >"$MARKERLESS_FILES"
  : >"$DELETED_FILES"
  : >"$AUTO_MERGED_FILES"
  : >"$DECLINED_FILES"
  : >"$INERT_ENTRIES"
  : >"$DOWNGRADE_FILES"
  : >"$DOWNGRADE_REPORT"
  # WORK_DIR persists between runs, so a stale list from an earlier run would
  # otherwise feed the deleted-in-template scan below.
  : >"$PREV_TEMPLATE_FILES"

  #############################################
  # Version tracking
  #############################################

  TEMPLATE_SHA=$(git -C _template rev-parse HEAD)
  TEMPLATE_SHA_SHORT="${TEMPLATE_SHA:0:7}"
  {
    echo "template_sha=$TEMPLATE_SHA"
    echo "template_sha_short=$TEMPLATE_SHA_SHORT"
  } >>"$GITHUB_OUTPUT"

  PREV_SHA=""
  if [[ -f .template-version ]]; then
    PREV_SHA=$(cat .template-version)
    echo "Previous template version: $PREV_SHA"
  else
    echo "No previous template version found (first sync)"
  fi
  echo "Current template version: $TEMPLATE_SHA"

  echo "$TEMPLATE_SHA" >.template-version

  #############################################
<<<<<<< local
  # File processing
  #############################################

  # Resolve a single file's sync outcome using a 3-way merge strategy:
  #
  #   base     = the file at PREV_SHA in the template (last known common ancestor)
  #   local    = the current file in the child repo
  #   template = the file at HEAD in the template
  #
  # Decision tree:
  #   1. File is new in template → copy it in.
  #   2. Files are already identical → no-op.
  #   3. No merge base (first sync or lost history) → apply template, record conflict.
  #   4. Template is unchanged since base → local diverged alone; keep local.
  #   5. Local is unchanged since base → template advanced alone; adopt template.
  #   6. Both sides changed → attempt a 3-way merge:
  #      a. Clean merge → write merged result.
  #      b. Conflict → write conflict markers for Claude to resolve.
  process_file() {
    local rel_path="$1"
    local template_file="_template/$rel_path"

    # Case 0: the child deliberately made this path a symlink (e.g. a dotfiles
    # repo pointing .claude/settings.json at another repo it clones at runtime).
    # Never overwrite it — cp through a dangling symlink errors out, and cp
    # through a live one would clobber the link's target instead of the link.
    # Leave the local structure alone.
    if [[ -L "$rel_path" ]]; then
      echo "Skipping symlink: $rel_path (local structure preserved)"
      return
    fi

    local parent_dir
    parent_dir=$(dirname "$rel_path")
    [[ "$parent_dir" != "." ]] && mkdir -p "$parent_dir"

    # Case 1: new file in template.
    if [[ ! -f "$rel_path" ]]; then
      cp "$template_file" "$rel_path"
      echo "Added: $rel_path"
      return
    fi

    # Case 2: already identical.
    if diff -q "$rel_path" "$template_file" >/dev/null 2>&1; then
      return
    fi

    # Case 3: no merge base — first sync or history unavailable.
    if [[ -z "$PREV_SHA" ]]; then
      record_no_base_conflict "$rel_path" "$template_file"
      return
    fi

    local safe_name
    safe_name=$(echo "$rel_path" | tr '/' '_')
    local base_file="$WORK_DIR/merge_base_${safe_name}"

    if ! git -C _template show "${PREV_SHA}:${rel_path}" >"$base_file" 2>/dev/null; then
      rm -f "$base_file"
      record_no_base_conflict "$rel_path" "$template_file"
      return
    fi

    # Case 4: template unchanged since base — local diverged alone; keep local.
    if diff -q "$base_file" "$template_file" >/dev/null 2>&1; then
      echo "Unchanged in template: $rel_path (keeping local version)"
      rm -f "$base_file"
      return
    fi

    # Case 5: local unchanged since base — template advanced alone; adopt it.
    if diff -q "$base_file" "$rel_path" >/dev/null 2>&1; then
      cp "$template_file" "$rel_path"
      echo "Updated: $rel_path (local was unmodified)"
      rm -f "$base_file"
      return
    fi

    # Case 6: both sides changed — attempt a 3-way merge.
    local merge_result="$WORK_DIR/merge_result_${safe_name}"
    cp "$rel_path" "$merge_result"

    if git merge-file -L "local" -L "base" -L "template" \
      "$merge_result" "$base_file" "$template_file" 2>/dev/null; then
      cp "$merge_result" "$rel_path"
      echo "Auto-merged: $rel_path (clean 3-way merge)"
      echo "$rel_path" >>"$AUTO_MERGED_FILES"
      rm -f "$base_file" "$merge_result"
      return
    fi

    # Case 6b: conflict markers produced — keep them for Claude to resolve.
    cp "$merge_result" "$rel_path"
    echo "CONFLICT (merge markers): $rel_path"
    echo "$rel_path" >>"$CONFLICT_FILES"
    {
      echo "### \`$rel_path\`"
      echo ""
      echo "3-way merge produced **conflict markers** (\`<<<<<<<\`/\`=======\`/\`>>>>>>>\`)."
      echo "Resolve them: keep local customizations, adopt template improvements."
      echo ""
      echo "<details>"
      echo "<summary>View file with conflict markers</summary>"
      echo ""
      echo "\`\`\`"
      head -500 "$rel_path"
      echo "\`\`\`"
      echo "</details>"
      echo ""
    } >>"$CONFLICT_REPORT"
    rm -f "$base_file" "$merge_result"
  }

  record_no_base_conflict() {
    local rel_path="$1" template_file="$2"
    echo "CONFLICT (no base): $rel_path"
    echo "$rel_path" >>"$CONFLICT_FILES"
    {
      echo "### \`$rel_path\`"
      echo ""
      echo "No merge base available (first sync or file history unavailable)."
      echo "Template version has been applied. Restore any important local customizations."
      echo ""
      echo "<details>"
      echo "<summary>Diff (old local → new template)</summary>"
      echo ""
      echo "\`\`\`diff"
      # diff exits 0 (identical) or 1 (differs); anything higher is a real error.
      # Capture into a variable so truncating with `head` can't SIGPIPE the diff.
      diff_rc=0
      diff_out=$(diff -u "$rel_path" "$template_file") || diff_rc=$?
      [[ "${diff_rc:-0}" -le 1 ]] || exit "${diff_rc}"
      head -500 <<<"$diff_out"
      echo "\`\`\`"
      echo "</details>"
      echo ""
    } >>"$CONFLICT_REPORT"
    cp "$template_file" "$rel_path"
  }

  #############################################
=======
>>>>>>> template
  # Detect deleted files + process sync paths
  #############################################

  # A path counts as deleted only if it existed at PREV_SHA but not at template
  # HEAD — avoids flagging project-specific files that were never in the template.
  if [[ "$PREV_SHA" != "" ]]; then
    if ! git -C _template ls-tree -r --name-only "$PREV_SHA" 2>/dev/null >"$PREV_TEMPLATE_FILES"; then
      : >"$PREV_TEMPLATE_FILES" # PREV_SHA not in template history; treat as no prior files
    fi
  fi

  for path in "${SYNC_PATHS[@]}"; do
    is_excluded "$path" && continue

    if [[ "$PREV_SHA" != "" ]]; then
      while IFS= read -r prev_file; do
        case "$prev_file" in "$path" | "$path/"*) ;; *) continue ;; esac
        is_excluded "$prev_file" && continue
        if [[ ! -f "_template/$prev_file" ]]; then
          echo "DELETED in template: $prev_file"
          echo "$prev_file" >>"$DELETED_FILES"
        fi
      done <"$PREV_TEMPLATE_FILES"
    fi

    if [[ ! -e "_template/$path" ]]; then
      echo "Warning: $path not found in template, skipping"
      continue
    fi

    if [[ -d "_template/$path" ]]; then
      while IFS= read -r template_file; do
        rel_path="${template_file#_template/}"
        is_excluded "$rel_path" && continue
        process_file "$rel_path"
      done < <(find "_template/$path" -type f)
    else
      process_file "$path"
    fi
  done

  report_inert_entries
  emit_attributed_changelog
  rm -rf _template

  #############################################
  # Set outputs
  #############################################

  # Capped per the cap_body_field invariant. Every path list the PR body prints takes the cap,
  # because the body reaches create-pull-request as ONE environment string against one execve limit.
  if [[ -s "$AUTO_MERGED_FILES" ]]; then
    auto_merged=$(tr '\n' ' ' <"$AUTO_MERGED_FILES")
    capped_auto_merged="$(cap_body_field "$auto_merged" \
      "${CONFLICT_FILES_MAX_BYTES:-8000}" \
      "… list truncated; the sync log names every auto-merged file.")"
    emit_multiline_output "auto_merged_files" "$capped_auto_merged"
  fi

<<<<<<< local
  if [[ -s "$CONFLICT_FILES" ]]; then
    conflicts=$(tr '\n' ' ' <"$CONFLICT_FILES")
    {
      echo "has_conflicts=true"
      echo "conflict_files=$conflicts"
    } >>"$GITHUB_OUTPUT"
    echo "Template updates available for: $conflicts" >.template-sync-conflicts
=======
  # Capped per the cap_body_field invariant; grows with the rejected template files.
  if [[ -s "$INERT_ENTRIES" ]]; then
    inert=$(tr '\n' ' ' <"$INERT_ENTRIES")
    capped_inert="$(cap_body_field "$inert" \
      "${CONFLICT_FILES_MAX_BYTES:-8000}" \
      "… list truncated; the sync log names every inert entry.")"
    emit_multiline_output "inert_entries" "$capped_inert"
  fi

  # The loud counterpart to a silent downgrade: the PR body names these files so a
  # reviewer reads them instead of trusting "auto-merged". Capped per the
  # cap_body_field invariant; has_downgrades stays a single-line flag.
  if [[ -s "$DOWNGRADE_FILES" ]]; then
    downgrade=$(tr '\n' ' ' <"$DOWNGRADE_FILES")
    capped_downgrade="$(cap_body_field "$downgrade" \
      "${CONFLICT_FILES_MAX_BYTES:-8000}" \
      "… list truncated; the sync log names every downgraded file.")"
    echo "has_downgrades=true" >>"$GITHUB_OUTPUT"
    emit_multiline_output "downgrade_files" "$capped_downgrade"
    downgrade_report="$(cat "$DOWNGRADE_REPORT")"
    capped_downgrade_report="$(cap_body_field "$downgrade_report" \
      "${CONFLICT_REPORT_MAX_BYTES:-40000}" \
      "_Downgrade report truncated; the sync log names every downgraded file._")"
    emit_multiline_output "downgrade_report" "$capped_downgrade_report"
  else
    echo "has_downgrades=false" >>"$GITHUB_OUTPUT"
  fi

  if [[ -s "$DECLINED_FILES" ]]; then
    declined=$(tr '\n' ' ' <"$DECLINED_FILES")
    capped_declined="$(cap_body_field "$declined" \
      "${CONFLICT_FILES_MAX_BYTES:-8000}" \
      "… list truncated; the sync log names every declined file.")"
    emit_multiline_output "declined_files" "$capped_declined"
  fi

  if [[ -s "$CONFLICT_FILES" || -s "$MARKERLESS_FILES" ]]; then
    echo "has_conflicts=true" >>"$GITHUB_OUTPUT"
    # UNCAPPED, unlike every list above: conflict_files never reaches the PR body, so no execve
    # limit applies to it. It is the resolver's input, and cap_body_field both drops paths and
    # appends an English note — whose words template-sync-resolve.sh would split as paths and
    # template-sync-push.sh would hand to `git add`.
    if [[ -s "$CONFLICT_FILES" ]]; then
      conflicts=$(tr '\n' ' ' <"$CONFLICT_FILES")
      emit_multiline_output "conflict_files" "$conflicts"
    fi
    if [[ -s "$MARKERLESS_FILES" ]]; then
      markerless=$(tr '\n' ' ' <"$MARKERLESS_FILES")
      capped_markerless="$(cap_body_field "$markerless" \
        "${CONFLICT_FILES_MAX_BYTES:-8000}" \
        "… list truncated; see the report below.")"
      emit_multiline_output "markerless_files" "$capped_markerless"
    fi
    conflict_report="$(cat "$MARKERLESS_REPORT" "$CONFLICT_REPORT")"
    capped_conflict_report="$(cap_body_field "$conflict_report" \
      "${CONFLICT_REPORT_MAX_BYTES:-40000}" \
      "_Conflict report truncated (the full report exceeded the PR-body size limit). Every entry cut from the end is a file carrying \`<<<<<<<\`/\`=======\`/\`>>>>>>>\` markers on the \`template-sync\` branch — resolve those from the markers. Every **Kept local** entry is printed first, because the report is the only copy of what those files would have received._")"
    emit_multiline_output "conflict_report" "$capped_conflict_report"
>>>>>>> template
  else
    echo "has_conflicts=false" >>"$GITHUB_OUTPUT"
  fi
  # The retired .template-sync-conflicts sidecar: an earlier sync committed it into adopters that
  # conflicted, and nothing writes or removes it any more. The branch's own markers are the record.
  rm -f .template-sync-conflicts

  # Capped per the cap_body_field invariant; has_deletions stays a single-line flag.
  if [[ -s "$DELETED_FILES" ]]; then
    deleted=$(tr '\n' ' ' <"$DELETED_FILES")
    capped_deleted="$(cap_body_field "$deleted" \
      "${CONFLICT_FILES_MAX_BYTES:-8000}" \
      "… list truncated; the sync log names every deleted file.")"
    echo "has_deletions=true" >>"$GITHUB_OUTPUT"
    emit_multiline_output "deleted_files" "$capped_deleted"
  else
    echo "has_deletions=false" >>"$GITHUB_OUTPUT"
  fi

  if git diff --quiet && [[ "$(git ls-files --others --exclude-standard)" = "" ]]; then
    echo "has_changes=false" >>"$GITHUB_OUTPUT"
  else
    changed_paths=$({
      git diff --name-only
      git ls-files --others --exclude-standard
    } | tr '\n' ' ')
    {
      echo "has_changes=true"
      echo "changed_paths=$changed_paths"
    } >>"$GITHUB_OUTPUT"
  fi

  # Per the header SELF-MODIFICATION SAFETY invariant: exit from inside main.
  exit 0
}

main "$@"
