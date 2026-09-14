#!/usr/bin/env python3
"""
Render a markdown report of every hand-authored merge-resolution delta in a PR's
commit range, for supervision review.

A merge commit's tree is authored freely — nothing forces it to equal the
mechanical 3-way merge of its parents, so a conflict resolution can smuggle in
a change present in NEITHER parent (an "evil merge") that a normal one-parent
diff never shows. `git show --remerge-diff` reconstructs the mechanical merge
and diffs the recorded tree against it, isolating exactly what the resolver
typed. This script runs that over every merge commit in BASE_SHA..HEAD_SHA and
prints one markdown section per merge whose resolution still needs a human;
prints nothing when there is nothing hand-authored left to review.

"Still needs a human" is the whole job, because the raw delta over-reports
badly. Three filters retire a file or a hunk, each answering a question the
downstream reviewer cannot answer for itself:

  * SUPERSEDED — the file's bytes at head now equal the mechanical merge's or a
    parent's, so a later commit replaced the resolution's delta with reference
    bytes and nothing hand-authored ships.
  * TRACED — every block the hunk touches is already one parent's own edit
    against the parents' merge-base. That is the ordinary conflict resolution.
  * UNDONE — every trace of the hunk is gone from the file at head, so a
    follow-up commit corrected it.

What survives is a delta no parent's intent explains and no later commit undid.
The report also carries a per-file PROVENANCE block, because the downstream
reviewer has no shell and cannot read the parents itself: without it, a line a
branch removed deliberately and a line the resolver dropped look identical as a
`-`.

Env: BASE_SHA, HEAD_SHA (required). REMERGE_REPORT_MAX_BYTES caps the body;
UNSET MEANS NO CAP. Only the PR-comment renderer sets it, because only GitHub
imposes a size limit — the readers that actually audit have none, and a merge
dropped from what they read is a merge nobody looks at, on the one channel an
evil merge can hide in.

`--commit SHA` reports that one merge, uncapped, and reads no environment: it
serves a caller judging a resolution it just built. Head is that same commit
there, so nothing is superseded and no hunk is undone — the only correct answer
for a resolution that has not been pushed yet.

`--shas-out FILE` writes the merge SHAs the report covered, one per line, so a
consumer can key state on which merges a review actually read rather than
re-parsing the markdown.

Fails loud (SystemExit) on a merge with more than two parents: --remerge-diff
cannot reconstruct an octopus merge, and silently skipping one would report
"nothing to review" about exactly the kind of commit that needs review.
"""

import argparse
import os
import re
import subprocess
from typing import Callable, NamedTuple

MARKER = "<!-- remerge-diff-report -->"

_CONFLICT_MARKER = re.compile(r"(?:<{7}|={7}|>{7}|\|{7})")

_PROVENANCE_MAX_COMMITS = 10
PROVENANCE_OMITTED_NOTICE = "more commit(s) omitted from this side's list"
OMITTED_NOTICE = "omitted from THIS COMMENT to fit GitHub's size limit"

_INTRO = (
    f"{MARKER}\n"
    "## Hand-authored merge-resolution deltas\n\n"
    "Each section below is what a merge commit's resolution changed **on top "
    "of** the mechanical 3-way merge of its parents (`git show --remerge-diff "
    "<sha>`). This is the only place a conflict resolution can introduce "
    "content present in neither parent, so review these hunks as you would "
    "hand-written code — the ordinary PR diff does not isolate them.\n\n"
    "Deltas one parent's own commits explain, and deltas a later commit already "
    "undid, are filtered out. What remains is what no side's intent accounts "
    "for.\n"
)


def _git(*args: str) -> str:
    # cwd-git-ok: explicitly names the process's own working directory (the
    # repo this script is invoked against, in CI or in a test's scratch repo)
    # instead of leaving it implicit, so an in-process caller elsewhere can
    # never silently inherit a stale one.
    return subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        check=True,
        cwd=os.getcwd(),
    ).stdout


def _fence(text: str) -> str:
    """A backtick fence strictly longer than any backtick run inside `text`, so
    PR-controlled diff content cannot break out of its data block."""
    longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
    return "`" * max(3, longest + 1)


def _side_log(mb: str, tip: str, path: str) -> str:
    """
    The commits that touched `path` on one side since the parents' merge-base,
    capped with an explicit marker when more exist.

    The marker is what keeps this list from lying by omission: the reviewer reads
    "no commit on either side explains this hunk" as the evil-merge signal, so a
    silently truncated list MANUFACTURES that signal for a file with an ordinary
    busy history. `:(literal)` because a path is a path here, not a pattern —
    glob metacharacters in a filename would otherwise match something else, or
    nothing.
    """
    pathspec = f":(literal){path}"
    log = _git(
        "log",
        f"--max-count={_PROVENANCE_MAX_COMMITS + 1}",
        "--format=%h %s",
        f"{mb}..{tip}",
        "--",
        pathspec,
    ).strip()
    lines = log.split("\n") if log else []
    if len(lines) <= _PROVENANCE_MAX_COMMITS:
        return log
    total = int(_git("rev-list", "--count", f"{mb}..{tip}", "--", pathspec).strip())
    omitted = total - _PROVENANCE_MAX_COMMITS
    return "\n".join(
        [*lines[:_PROVENANCE_MAX_COMMITS], f"(…{omitted} {PROVENANCE_OMITTED_NOTICE})"]
    )


def _provenance(p1: str, p2: str, files: list[str]) -> str:
    """
    Which side of the merge changed each file the resolution touched.

    A reviewer reading only the delta cannot distinguish a resolution that took
    a side's DELIBERATE change from one that invented content, because neither
    parent is in front of it: a line the branch removed on purpose and a line
    the resolver dropped look identical as a `-`. These two logs are what
    separate them. A file only one side touched, resolved to that side, is the
    ordinary case; a hunk no side's commits explain is the evil-merge signal.
    """
    mb = _git("merge-base", p1, p2).strip()
    rows = []
    for path in sorted(files):
        sides = []
        for label, tip in (("parent 1", p1), ("parent 2", p2)):
            log = _side_log(mb, tip, path)
            # Backticks scrubbed for the same reason the merge subject's are:
            # commit subjects are PR-author text landing inside a fenced block.
            body = log.replace("`", "'") if log else "(untouched on this side)"
            sides.append(
                f"  {label}:\n" + "\n".join(f"    {ln}" for ln in body.split("\n"))
            )
        rows.append(f"{path}\n" + "\n".join(sides))
    text = "\n\n".join(rows)
    fence = _fence(text)
    return (
        "\n**Which side changed each file** (commits since the parents' "
        f"merge-base `{mb[:12]}`):\n\n{fence}\n{text}\n{fence}\n"
    )


def _tree_entry(rev: str, path: str) -> str | None:
    """
    The `ls-tree` entry — mode, type and oid — for `path` at `rev`, or None when
    the path is absent there.

    The mode is part of the identity: a resolution that only flips a file's
    executable bit ships a real delta that comparing blob oids alone would call
    superseded. Routed through `_git` so an unexpected git failure raises instead
    of reading as "absent", which would compare equal to another failure and
    grant supersession.
    """
    return _git("ls-tree", rev, "--", f":(literal){path}").strip() or None


def _mechanical_tree(parent1: str, parent2: str) -> str:
    """The mechanical 3-way merge of two parents as a tree oid (conflicted paths
    keep their conflict markers embedded)."""
    res = subprocess.run(
        ["git", "merge-tree", "--write-tree", parent1, parent2],
        capture_output=True,
        text=True,
        check=False,
        cwd=os.getcwd(),
    )
    tree = res.stdout.split("\n", 1)[0]
    # Exit 1 is git's conflicted-but-written verdict. Anything else — or no tree
    # on stdout — must fail loud: _tree_entry reads "absent in both" as equal, so
    # a garbage tree here would mark every delta superseded and silence the
    # reviewer on exactly the merge under review.
    if res.returncode not in (0, 1) or not tree:
        raise SystemExit(
            f"git merge-tree --write-tree {parent1} {parent2} failed: "
            f"{res.stderr.strip()}"
        )
    return tree


def _superseded_paths(
    parents: list[str], head: str, paths: list[str]
) -> dict[str, str]:
    """
    The `paths` whose bytes at `head` equal a trusted reference — the mechanical
    merge's, or either parent's — mapped to which one.

    Later commits replaced the resolution's delta with reference bytes, so
    nothing hand-authored ships. Equality to a parent is sound for the same
    reason the mechanical case is: this reviewer guards the neither-parent
    channel, and bytes identical to a parent contain no neither-parent content by
    definition. A conflicted file can never match the mechanical blob — it embeds
    conflict markers — so the parent comparison is what makes a corrected
    conflict resolution supersedable at all.
    """
    mech = _mechanical_tree(parents[0], parents[1])
    parent_refs = [
        (parents[0], f"its first parent's ({parents[0][:12]}) exact bytes"),
        (parents[1], f"its second parent's ({parents[1][:12]}) exact bytes"),
    ]
    out: dict[str, str] = {}
    for p in paths:
        at_head = _tree_entry(head, p)
        # Absence matches only the MECHANICAL reference: a path missing at head
        # and missing from the mechanical merge means head agrees with the
        # mechanical result, so nothing hand-authored ships either way.
        if at_head == _tree_entry(mech, p):
            out[p] = "the mechanical merge's exact bytes"
            continue
        # Against a PARENT both entries must be PRESENT. _tree_entry returns None
        # for an absent path and None == None, so without this refusal a
        # resolution that DELETED a file one parent carried — a guardrail dropped
        # through a conflict resolution — would read as superseded by the parent
        # that never had it and vanish from the report, which is precisely the
        # delta that must stay visible.
        if at_head is None:
            continue
        for rev, source in parent_refs:
            if at_head == _tree_entry(rev, p):
                out[p] = source
                break
    return out


def _blob(rev: str, path: str) -> str:
    """
    The file's text at `rev` — empty when the path is absent there, which reads
    as "none of this delta's removals came back", so a resolution that deleted
    something and left it deleted stays under review.

    Decoding replaces
    undecodable bytes rather than raising: a replaced character can only fail a
    block match, which keeps the hunk in the report.
    """
    res = subprocess.run(
        ["git", "show", f"{rev}:{path}"],
        capture_output=True,
        text=True,
        errors="replace",
        check=False,
    )
    return res.stdout if res.returncode == 0 else ""


def _line_runs(hunk: str, sign: str) -> list[str]:
    """
    The hunk's maximal runs of consecutive `sign`-prefixed lines, each joined
    back into the multi-line block it was, with the sign stripped.

    Runs, not single lines, because a block of several lines is what makes "is
    this still in the file" a meaningful question — one short line can match
    anywhere.

    A conflict marker BREAKS a run and is never part of one. The mechanical merge
    of a conflicted file embeds `<<<<<<<`/`=======`/`>>>>>>>`, so they arrive
    here as `-` lines sitting between the two sides' text; joining across one
    would build a block that exists in no file anywhere and could therefore never
    be matched against a real blob.
    """
    lines = hunk.split("\n")[1:]  # [1:] drops the @@ header itself
    runs: list[str] = []
    current: list[str] = []
    for line in lines:
        if not line.startswith(sign) or _CONFLICT_MARKER.match(line[1:]):
            if current:
                runs.append("\n".join(current))
                current = []
            continue
        current.append(line[1:])
    if current:
        runs.append("\n".join(current))
    return runs


def _count_block(text: str, block: str) -> int:
    """
    How many times `block` occurs in `text` as whole consecutive lines.

    A COUNT, not a membership test, and that is the load-bearing part: a file
    holding two identical lines would answer "still there" to a membership
    question after the resolution deleted one of them, retiring a deletion that
    ships. Counting also makes the comparison a no-op when the two texts are the
    same blob, which is what `--commit` mode passes.
    """
    lines = text.split("\n")
    needle = block.split("\n")
    return sum(
        1
        for i in range(len(lines) - len(needle) + 1)
        if lines[i : i + len(needle)] == needle
    )


class ParentBlobs(NamedTuple):
    """One merge's three reference texts for a single file: the parents' common
    ancestor, and each parent."""

    base: str
    parent1: str
    parent2: str


def _hunk_traced_to_the_parents(hunk: str, blobs: ParentBlobs) -> bool:
    """
    Is every block this hunk touches already one parent's own edit against the
    parents' merge-base — each removed block deleted by a parent (it occurs
    strictly fewer times there than in the base), each added block added by one
    (strictly more times)?

    This is the question the reviewer is asked — "does one side's intent explain
    this hunk?" — answered from the three blobs instead of inferred from a list
    of commit subjects, which is all the reviewer gets: it has no shell and
    cannot read the parents' files at all. Answering it here is what lets an
    ordinary conflict resolution clear with no human reading it.

    The comparison is directional, and that direction is the whole safety
    argument: a guard one parent ADDED and the resolution DELETED has a base
    count of ZERO, so `0 > 0` fails and the hunk stays under review. Only
    agreement with a deletion the base can witness, or with an addition a parent
    can be shown to have made, is retired.

    Blocks are attributed independently — a hunk may follow one side's deletion
    and the other's addition, which is the obvious semantic merge and introduces
    nothing either way. A hunk whose every signed line is a conflict marker
    yields no blocks at all and passes vacuously, which is correct: a marker is
    never valid file content, so removing one can smuggle nothing.
    """
    return all(
        _count_block(blobs.base, b)
        > min(_count_block(blobs.parent1, b), _count_block(blobs.parent2, b))
        for b in _line_runs(hunk, "-")
    ) and all(
        max(_count_block(blobs.parent1, b), _count_block(blobs.parent2, b))
        > _count_block(blobs.base, b)
        for b in _line_runs(hunk, "+")
    )


def _hunk_undone_at_head(hunk: str, head_text: str, merge_text: str) -> bool:
    """
    Is every trace of this hunk's resolution gone from the file at `head` — each
    added block occurring FEWER times than in the merge's own blob, and each
    removed block MORE times?

    Whole-file byte equality to a reference (`_superseded_paths`) catches a
    correcting commit only when the branch stops developing the file afterwards.
    Judging the delta's own content instead gives that correction somewhere to
    land on a branch that keeps moving: the fixer restores what the resolution
    dropped, and this hunk drops out of the review. That matters because a pushed
    merge's remerge-diff never changes — a follow-up commit is the only
    correction available.

    Counts are compared against `merge_text` — the file as the resolution left
    it — never against presence alone, so a block with a twin elsewhere in the
    file cannot answer for the occurrence the resolution touched. When head IS
    the merge (the `--commit` caller), every count is equal and no hunk is ever
    undone, which is the only correct answer there.

    Both halves are required, so a partly-undone hunk stays in the report. The
    unmatched direction is the safe one: content still present at head keeps its
    hunk under review.
    """
    added = _line_runs(hunk, "+")
    removed = _line_runs(hunk, "-")
    if not added and not removed:
        return False
    return all(
        _count_block(head_text, b) < _count_block(merge_text, b) for b in added
    ) and all(_count_block(head_text, b) > _count_block(merge_text, b) for b in removed)


def _drop_hunks(file_diff: str, retire: Callable[[str], bool]) -> tuple[str, int]:
    """
    `file_diff` with every hunk `retire` accepts removed, and how many went.

    The file header survives its hunks whenever it carries a MODE change: a
    content read cannot judge an executable-bit flip, so dropping the header
    would hide an un-executabled guard. A diff with no hunks at all (a mode-only
    delta) is returned untouched for the same reason.
    """
    starts = [m.start() for m in re.finditer(r"(?m)^@@ .*$", file_diff)]
    if not starts:
        return file_diff, 0
    bounds = [*starts, len(file_diff)]
    hunks = [file_diff[bounds[i] : bounds[i + 1]] for i in range(len(starts))]
    kept = [h for h in hunks if not retire(h)]
    header = file_diff[: starts[0]]
    if not kept and "\nnew mode " not in f"\n{header}":
        return "", len(hunks)
    return header + "".join(kept), len(hunks) - len(kept)


def _split_by_file(diff: str) -> list[tuple[str, str]]:
    """
    `(path, that file's diff)` for each `diff --git` section.

    The path comes from the `+++ b/` line rather than the `diff --git` header:
    the header repeats a possibly-quoted path twice, while `+++` carries it
    once. A pure deletion has no `+++ b/`, so it falls back to `--- a/`; a
    section with neither is yielded under an empty path so its content is still
    reported rather than silently dropped.
    """
    starts = [m.start() for m in re.finditer(r"(?m)^diff --git ", diff)]
    if not starts:
        return []
    bounds = [*starts, len(diff)]
    out = []
    for i in range(len(starts)):
        section = diff[bounds[i] : bounds[i + 1]]
        plus = re.search(r"(?m)^\+\+\+ b/(?P<path>.*)$", section)
        minus = re.search(r"(?m)^--- a/(?P<path>.*)$", section)
        path = ""
        if plus and plus.group("path") != "/dev/null":
            path = plus.group("path")
        elif minus and minus.group("path") != "/dev/null":
            path = minus.group("path")
        out.append((path, section))
    return out


def _surviving_diff(sha: str, parents: list[str], at_head: str, diff: str):
    """
    The parts of `diff` no filter retires, plus how many files and hunks went.

    Returns `(kept, retired)` where `kept` is `(path, that file's diff)`.
    """
    files = _split_by_file(diff)
    superseded = _superseded_paths(parents, at_head, [p for p, _ in files if p])
    mb = _git("merge-base", parents[0], parents[1]).strip()

    kept: list[tuple[str, str]] = []
    retired = 0
    for path, file_diff in files:
        if path in superseded:
            retired += 1
            continue
        blobs = ParentBlobs(
            base=_blob(mb, path),
            parent1=_blob(parents[0], path),
            parent2=_blob(parents[1], path),
        )
        merge_text = _blob(sha, path)
        head_text = _blob(at_head, path)

        def retire(hunk: str, blobs=blobs, head=head_text, merged=merge_text) -> bool:
            return _hunk_traced_to_the_parents(hunk, blobs) or _hunk_undone_at_head(
                hunk, head, merged
            )

        remaining, dropped = _drop_hunks(file_diff, retire)
        retired += dropped
        if remaining.strip():
            kept.append((path, remaining))
    return kept, retired


def _section(sha: str, head: str | None) -> str:
    """The report section for one merge commit: empty when nothing hand-authored
    survives the three filters."""
    parents = _git("rev-list", "--parents", "-n1", sha).split()[1:]
    if len(parents) > 2:
        raise SystemExit(
            f"merge {sha} has {len(parents)} parents; --remerge-diff cannot "
            "reconstruct an octopus merge, so its resolution cannot be reviewed "
            "this way. Re-merge as a chain of two-parent merges."
        )
    if len(parents) < 2:
        return ""
    diff = _git("show", "--remerge-diff", "--no-color", "--format=", sha)
    if not diff.strip():
        return ""

    kept, retired = _surviving_diff(sha, parents, head or sha, diff)
    if not kept:
        return ""

    body = "".join(text for _, text in kept)
    subject = _git("log", "-1", "--format=%s", sha).strip().replace("`", "'")
    fence = _fence(body)
    lines = body.strip().count("\n") + 1
    note = f" — {retired} explained by a parent or already undone" if retired else ""
    provenance = _provenance(parents[0], parents[1], [p for p, _ in kept if p])
    # Collapsed by default: these deltas are often long, and a report with
    # several merges would otherwise dominate the PR page. The summary keeps the
    # sha/subject/size visible so a reviewer can decide whether to expand. A
    # blank line after <summary> is required for GitHub to render the fenced
    # diff inside the <details>.
    return (
        f"\n<details><summary><code>{sha[:12]}</code> {subject} "
        f"({lines}-line delta{note})</summary>\n\n"
        f"{provenance}\n{fence}diff\n{body.rstrip()}\n{fence}\n\n</details>\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Render merge-resolution deltas.")
    parser.add_argument(
        "--commit",
        help="report only this merge commit, uncapped, instead of every merge in "
        "BASE_SHA..HEAD_SHA",
    )
    parser.add_argument(
        "--shas-out",
        help="write the merge SHAs this report covered, one per line, so a "
        "consumer can key state on which merges were read",
    )
    args = parser.parse_args()
    if args.commit:
        merges, head, max_bytes = [args.commit], None, None
    else:
        base, head = os.environ["BASE_SHA"], os.environ["HEAD_SHA"]
        merges = list(reversed(_git("rev-list", "--merges", f"{base}..{head}").split()))
        cap = os.environ.get("REMERGE_REPORT_MAX_BYTES")
        # UNSET MEANS NO CAP. Only the PR-comment renderer sets one, because only
        # GitHub imposes a size limit; the readers that audit have none, and a
        # merge dropped from what they read is a merge nobody looks at.
        max_bytes = int(cap) if cap else None

    sections = [(sha, _section(sha, head)) for sha in merges]
    sections = [(sha, text) for sha, text in sections if text]
    if args.shas_out:
        with open(args.shas_out, "w", encoding="utf-8") as fh:
            fh.write("".join(f"{sha}\n" for sha, _ in sections))
    if not sections:
        return
    # Truncate at section boundaries, never mid-fence: a cut inside a fenced diff
    # would leave the fence open and render the notice as diff content.
    report, dropped = _INTRO, []
    for sha, text in sections:
        if max_bytes is not None and len((report + text).encode()) > max_bytes:
            dropped.append(sha[:12])
        else:
            report += text
    if dropped:
        report += (
            f"\n**…{len(dropped)} merge(s) {OMITTED_NOTICE} "
            f"({', '.join(f'`{sha}`' for sha in dropped)}) — run "
            "`git show --remerge-diff <sha>` locally for those deltas.**\n"
        )
    print(report)


if __name__ == "__main__":
    main()
