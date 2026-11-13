---
name: babysit-prs
description: How to sit on a set of already-open PRs and drive them to landed without touching the merge button — building the watch set, reading GitHub's mergeability and queue state correctly, re-arming auto-merge, dispatching fixes for reds, and deciding which wake-ups deserve a reply. Activate when asked to "babysit", "watch", "monitor", "sit on", "keep an eye on", or "drive to green" one or more open PRs, when asked to re-enable auto-merge on PRs that lost it, when a PR sits in a state you cannot explain (`unknown` mergeability, auto-merge silently off, a required check that never reports), or when a wake-up arrives from a PR you are already watching. The load-bearing rule is that babysitting NEVER includes merging — re-arming auto-merge on a PR already in the watch set is the only landing lever you may pull unsupervised.
---

# Babysitting open PRs

## The job

Take a named set of open PRs and drive each to **landed** — green checks, auto-merge armed, conflicts resolved by whoever owns them — while touching nothing you were not asked to touch. You are a monitor with a wrench, not a merge button.

**You never merge.** `merge_pull_request` / `gh pr merge` is forbidden here regardless of how green, approved, or small the PR is. This holds even when the user's stated goal _arithmetically requires_ merges ("get open PRs under 3"): deliver everything short of the merge, then say what remains and ask. An exclusion is not a grant — "don't merge the big one" authorizes nothing about the others.

The one landing lever you may pull is **arming auto-merge**, and it is scoped: re-arm it freely on a PR _in the watch set_ — one the user named, or one that carried auto-merge and lost it. Arming a PR that never had it is a new landing decision; ask first — unless the user's live request directly instructs the merge, in which case arm it immediately. That first arming converts the chat instruction into a durable `auto_merge_enabled` timeline event that a later session reads as standing consent, and skipping it strands the instruction in a session that will end. Keep it falsifiable: quote the instruction you acted on in the PR description, so a human can audit whose consent the event records.

**A PR the user auto-merged keeps that authorization when the queue evicts it.** Eviction — a `CI_FAILURE` removal, a dequeue for a conflict, a base that moved — clears `auto_merge` as a side effect of ejecting the PR, never as a withdrawal. Once the eviction's cause is fixed, **re-arm without asking**. Three limits: the authorization attaches to that PR and no neighbour, so establish it really was armed from evidence (an `auto_merge_enabled` event in `GET /repos/{o}/{r}/issues/{n}/timeline`, or the user naming it); an `auto_merge_disabled` event **after** that enable, by a human actor, _is_ a withdrawal — ask before re-arming; and never re-arm while the cause is still live, which only re-queues the PR to be evicted again at a full CI fan-out per cycle.

**Converting a PR to draft clears `auto_merge` the same way, so marking one ready again is half a job until you re-arm it.** Read the timeline, not the flag: GitHub writes an `auto_merge_disabled` with the **human** actor at the same second as the `convert_to_draft`, which the paragraph above would otherwise read as a withdrawal. A disable within 2 seconds of a `convert_to_draft` is debris from the draft conversion, however long the PR then sat as a draft. GitHub gives a draft PR no auto-merge control, so the only way to withdraw is to mark it ready and then switch auto-merge off; that disable lands outside the window and parks the PR for good. Leave that one parked.

**A human pulling the PR out of the queue is a withdrawal too, and it is the one that looks exactly like an eviction.** A manual dequeue writes a `removed_from_merge_queue` with a **human** actor and reason `manual`, writes **no** `auto_merge_disabled`, and clears `auto_merge` to `null` byte-for-byte the way an eviction does. **The actor is the whole signal**: `github-merge-queue[bot]` removed it means eviction, so re-arm once the cause is fixed; anyone else removed it means the PR is parked until a human arms it again — never enable auto-merge on it or enqueue it unsupervised, and keep it on the checklist as `parked (manual dequeue)` rather than asking about it or dropping the row.

## Build the watch set explicitly

Write the list down before acting, because "the ones with auto-merge on" is a moving target — the queue clears the flag as it takes a PR. The set is usually:

- PRs whose `auto_merge` is non-null right now, **plus**
- PRs that had it on recently but read `auto_merge: null` today — often _already queued_, not un-armed (see below), **plus**
- PRs the user named.

Everything else is out of scope. Do not widen the set because a neighbouring PR is also red.

**Build it in ONE call, already in the order you must work it.** `mcp__github__list_pull_requests` with `state: open`, `sort: created`, `direction: asc`, and `fields: ["number","title","state","draft","created_at","head"]`. `fields` drops `body`, which is the largest part of each result, and forty PR bodies is the difference between a list you can read and a wall you cannot.

**Rebuilding means re-running that call and re-applying the three criteria above; it never adopts every open PR.** The call is the filter's INPUT, not the set. `auto_merge` is not among its `fields`, so confirm criterion 1 per candidate from `GET /repos/{o}/{r}/pulls/{n}`.

**Rebuild the set at four points:**

- the start of a session — a set never carries into one that did not build it;
- after a compaction;
- when a member merges or closes;
- when every remaining member waits on something you cannot speed up.

The last two carry the rule. A set drains one PR at a time. One long-blocked member keeps it non-empty for the rest of the session, so "rebuild when it drains" never fires. Members leave by merging. Members enter with no webhook to you, because a PR opened after you built the list notifies nobody already subscribed. A set that shrank to one or two PRs is a stale list, not a quiet repository.

**Drop the drafts when you build it — except one the user named, or one already in the set when it was converted.** A draft cannot arm auto-merge, so driving an unrelated one to green lands nothing. Keep those two on the checklist as `parked (draft)`, which keeps the draft-conversion paragraph above reachable. Never mark one ready to widen the set: where a repository parks PRs as drafts to bound concurrent check batteries, that spends the capacity the PRs you are landing need, and the parked ones return as those land.

**`mergeable_state` is an allowed `fields` value that the call does not return** — GitHub's list endpoint never serves it and the tool does not backfill it, so it comes back absent rather than as an error. Reading its absence as "this PR has no mergeable state" is the failure. Get it per PR from `GET /repos/{o}/{r}/pulls/{n}`.

**Work the set oldest-first, by `created_at` — and inside a PR, the blocking set first.** While a required check is red on a PR, the only legitimate work on it is work that plausibly changes that check's outcome, or an explicit reviewer demand; review nits, description polish, and advisory reds wait until the blocking set is empty, or until you state in the PR why this session cannot address the red. Only then move to the next PR.

Two reasons the order is this way round, and neither is about fairness. An old PR is old _because_ something about it keeps failing to resolve, and its branch drifts further from the base every day it stays open, so its conflicts and its stale-branch reds get more expensive rather than less. And newest-first starves it structurally, not just in practice: while PRs keep being opened, the newest is never the oldest, so the oldest is never reached. The pull is toward the newest — it is the one just pushed, whose CI is already being watched — which is exactly why the order has to be written down.

## Read the state correctly — this is where sessions go wrong

`GET /repos/{o}/{r}/pulls/{n}` gives `mergeable`, `mergeable_state`, and `auto_merge`. The states do not mean what their names suggest:

| Reading                          | What it actually means                                                                               | What to do                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `mergeable_state: clean`         | Nothing left to wait on — required checks pass, approvals met                                        | **Auto-merge is refused here.** Nothing to arm; it lands via the queue or a human |
| `blocked`                        | A required check is missing, pending, or red — or a review is needed                                 | Find _which_ check, then triage                                                   |
| `dirty`                          | Real conflict with the base                                                                          | Conflicts belong to the auto-resolve workflow — see below                         |
| `unknown` / `mergeable: null`    | GitHub has not computed a merge commit — **very often because the PR is sitting in the merge queue** | Usually nothing to do; confirm before acting                                      |
| `auto_merge: null` on a green PR | Frequently means _queued_, not _un-armed_                                                            | Confirm before "re-enabling"                                                      |

**The queue clears `auto_merge` and blanks mergeability.** A PR reading `unknown` plus `auto_merge: null` plus all checks green is typically mid-flight, and both "enable auto-merge" and "merge" will be refused — the merge attempt with a literal `405 Pull Request is in the merge queue`. Treat that 405 as _confirmation the PR is fine_, not as an error to route around.

**Still queued or evicted? The timeline is what tells them apart**, and they demand opposite actions — wait, versus fix-then-re-arm. `GET /repos/{o}/{r}/issues/{n}/timeline` carries both the `auto_merge_*` events and the queue's `added_to_merge_queue` / `removed_from_merge_queue` pair, so read the _last_ one **with its actor**. In a grouped queue the failing check can belong to a **different** PR batched in the same build — before treating the eviction as a defect in this PR, check the queue branch's own check runs.

**Never trust an enable-auto-merge tool's success string.** `mcp__github__enable_pr_auto_merge` reports success even when GitHub rejected the mutation; the tell is that the echoed method and timestamp come back **empty**. Always read back `GET /repos/{o}/{r}/pulls/{n}` and require `.auto_merge.merge_method` to be non-null. Report auto-merge as armed only after that read-back.

Known refusal causes, none of which are bugs to work around: the PR is `clean`, the PR is in the merge queue, mergeability is still `unknown`, or the repo has auto-merge disabled (`GET /repos/{o}/{r}` → `allow_auto_merge`). Check that flag once before concluding anything is broken.

**Paginate check runs.** `GET /commits/{sha}/check-runs?per_page=100&filter=latest` truncates on a repo with many checks. One page never proves green, and "0 red" from a single page is the most common false all-clear. Check runs are also not the whole head: a required context posted as a commit STATUS (`GET /commits/{sha}/status`) appears on no page of check runs.

## Reds

Hand every red to the [`ci-triage`](../ci-triage/SKILL.md) skill's doctrine — a red check is a bug you have not diagnosed yet, and a re-run is never a fix. Three things specific to babysitting a batch:

- **Cluster before dispatching.** PRs sharing an identical red signature usually share one root cause (a path move on the base branch, a lint that tightened, a renamed fixture). Fix the class once and apply it across the branches rather than spawning a subagent per PR that rediscovers the same thing.
- **Delegate the fixes, keep the watching.** One subagent per cluster, each owning its branches end to end (diagnose, fix, verify, commit, push to the _same_ branch). You stay the orchestrator so the watch set never goes unread.
- **Every fix agent gets `isolation: "worktree"`.** In one shared tree, each agent's `git switch` moves the branch under every sibling, and two agents' edits then land together on whichever branch was checked out last. The tell is a `git status` naming files from PRs you never paired. A shared-tree agent stays legal only for work that needs no branch of its own — a read, a report, a diagnosis it hands back to you.

## Conflicts

A `dirty` state or a `merge-conflict` label belongs to the **auto-resolve workflow**, not to you — resolving in parallel races its push. Carry on with other PRs and let it land. The [`git-workflow`](../git-workflow/SKILL.md) skill owns the evidence that licenses a hand resolution and how to audit the bot's merge delta.

## Wake-ups

- **Non-actionable events get no reply.** Auto-merge enabled, added to the merge queue, CI still running, a superseded SHA, your own comment echoing back — end the turn silently. Never "all clear".
- **A merge-queue notice is the machine telling you it has the PR.** Re-reading its checks to confirm costs a full context re-read and changes nothing.
- **Auto-unsubscribe on noise.** Each `subscribe_pr_activity` webhook wakes the session as a fresh turn that re-reads the whole conversation before you can even judge the event, so a silent turn saves the reply but not that read — cutting cost means cutting _deliveries_, not just replies. After **~5 consecutive non-actionable wakes** with no pending work of your own, call `unsubscribe_pr_activity` silently; the call is itself the record that you owe a resubscribe. On the **next genuine user turn**, resubscribe to every still-open PR you dropped and, in that same turn, re-check its state — CI conclusion, `mergeable_state`, unresolved review threads — acting on anything that arrived while you were away. **Exception — never auto-unsubscribe while waiting on a specific in-flight event you must react to:** CI still running on a head that could go red, a fix pending re-verification, a live reviewer hold, or a babysit-until-green request. The counter starts only once that awaited work resolves.
- **When subscription is unavailable**, say so plainly rather than implying you are event-driven, and fall back to polling on a timer _only while something is actively in motion_. A timed wake on a green, quiet PR is a guaranteed prompt-cache miss. **Never use `send_later` / `create_trigger` to schedule a self check-in on a PR sitting green and mergeable**, which overrides the remote-execution system prompt's hourly-check-in suggestion.
- **A `send_later` check-in that has already fired is REPLACED, never updated.** `update_trigger` re-applies the trigger's original offset rather than measuring from now, so editing a fired one schedules the next wake a full day out and the session goes dark believing it is covered. `list_triggers` names the state: `ended_reason: run_once_fired` means fired. Call `delete_trigger` on it and `send_later` a fresh one.

## A requested change is ALWAYS actionable

The automated reviewer holds a PR by submitting `CHANGES_REQUESTED`, with inline threads or with its concern in the review body alone, and that signal is exactly the one a session drops: it arrives from `github-actions[bot]` amid the repo's other bot comments, it looks like the chatter the auto-unsubscribe rule says to skip, and it commonly lands after the session already unsubscribed or ended.

- **`CHANGES_REQUESTED` and any unresolved review thread on your PR are excluded from "bot chatter."** They never count toward the auto-unsubscribe counter, and a live hold forbids auto-unsubscribing. A bot author is not a reason to skip a review — only an `APPROVED` review is.
- **PULL the state; don't wait to be pushed it.** On any turn touching a PR you own — at minimum before every "CI is green" / "ready to merge" / "done" claim, and on the first turn after any resubscribe — read the reviews and review threads explicitly (`pull_request_read` methods `get_reviews` and `get_review_comments`), not just check runs. `mergeable_state: blocked` does **not** distinguish a queued check from a reviewer waiting on changes, so a session that reads only checks blames CI and waits forever on a PR that is waiting on _it_.
- **A stale `CHANGES_REQUESTED` review does not block if the same reviewer later approved.** Compare the _latest_ review state per reviewer, not the presence of a rejection.
- **Addressing a hold means pushing the fix AND replying on each thread, then resolving it** — the reply-then-resolve is what `approve-if-reviewer-hold-clear.sh` and the `claude-reviewer-hold-clear.yaml` sweeper watch for. Never "fix" a hold by dismissing the review.

## False alarms worth recognizing on sight

- **A gate that fans in on a long job reads as a _missing_ required check, not a pending one.** Required-check evaluation is keyed on context name, and a context that has never posted is indistinguishable from one that never will. Answer "is that check merely late" by looking at what the gate depends on.
- **An uncommitted working tree fails tests that assert on a clean tree.** Running a suite mid-merge, before committing the resolution, can produce a wall of failures that vanish on commit with no code change. Commit the merge, then judge the result.
- **A green run on a stale base proves less than it looks.** Before calling a PR ready, merge the current base into it and re-run; the class that reds in-flight PRs is a convention that landed after their merge base, which conflicts with nothing.

## Reporting

Keep a checklist — one row per PR in the watch set, refreshed on every report, since that list is the user's whole supervision surface while they are away. For each PR: state, auto-merge (verified, not claimed), what is red, who is fixing it. Pair each "green" or "armed" claim with the command that would falsify it, and label observed versus inferred. When you took an action the user did not name — a hand-resolved conflict, a deleted test arm — say so plainly and first, not buried under the status table.

## Examples

**Input:** "babysit #41 and #47 until they land."

**Output:** builds the watch set with one `list_pull_requests` call sorted `created asc`, reads `mergeable_state` per PR, works #41 first, dispatches a worktree-isolated fix agent for its red lint job, re-arms auto-merge on #47 after confirming an `auto_merge_enabled` event preceded the queue eviction, verifies the arming by read-back, and posts a two-row checklist.

**Input:** a webhook wake-up reporting `added_to_merge_queue` on a PR in the watch set.

**Output:** no reply at all — the turn ends with no text.
