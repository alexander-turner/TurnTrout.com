import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  midMerge,
  midMergeModifyDelete,
  runBundle,
} from "./auto-resolve-fixtures.mjs";

const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

test("bundle commits the merge and emits a bundle when the resolution stays in the conflicted set", () => {
  const { work } = midMerge();
  writeFileSync(join(work, "a.md"), "resolved: feature + main\n");
  const { error, merging, bundle } = runBundle(work, "a.md");
  assert.equal(error, null);
  assert.equal(merging, false); // the merge was committed
  assert.ok(existsSync(bundle));
  // The bundle carries the merge commit under the handoff ref, and nothing else.
  const listed = execFileSync("git", ["bundle", "list-heads", bundle], {
    encoding: "utf8",
  });
  assert.match(listed, /refs\/auto-resolve\/result/);
  assert.equal(listed.trim().split("\n").length, 1);
});

test("bundle PUSHES NOTHING — it has no push credential and never contacts a remote", () => {
  const { work, origin } = midMerge();
  writeFileSync(join(work, "a.md"), "resolved\n");
  const before = git(origin, "rev-parse", "feature").trim();
  const { error } = runBundle(work, "a.md");
  assert.equal(error, null);
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
});

test("bundle REFUSES a stray edit to a file outside the conflicted set", () => {
  const { work } = midMerge();
  writeFileSync(join(work, "a.md"), "resolved\n");
  writeFileSync(join(work, "b.md"), "the LLM strayed here\n");
  const { error, merging, bundle } = runBundle(work, "a.md");
  assert.notEqual(error, null);
  assert.equal(merging, false); // merge aborted
  assert.ok(!existsSync(bundle));
});

test("bundle REFUSES a new untracked file the resolver created", () => {
  const { work } = midMerge();
  writeFileSync(join(work, "a.md"), "resolved\n");
  writeFileSync(join(work, "sneaky.md"), "new file the LLM added\n");
  const { error, bundle } = runBundle(work, "a.md");
  assert.notEqual(error, null);
  assert.ok(!existsSync(bundle));
});

test("bundle REFUSES when a conflict marker is left behind", () => {
  const { work } = midMerge();
  writeFileSync(
    join(work, "a.md"),
    "top\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main\n",
  );
  const { error, merging, bundle } = runBundle(work, "a.md");
  assert.notEqual(error, null);
  assert.equal(merging, false);
  assert.ok(!existsSync(bundle));
});

test("bundle IGNORES a benign ======= line in a clean, non-conflicted file", () => {
  // A committed Markdown setext-H1 underline in a file that did NOT conflict
  // must not trip the leftover-marker scan: the scan is scoped to the resolved
  // set. Red against a whole-tree `git grep -- .`, green against the scoped scan.
  const { work } = midMerge({ bContent: "Title\n=======\n\nbody\n" });
  writeFileSync(join(work, "a.md"), "resolved: feature + main\n");
  const { error, bundle } = runBundle(work, "a.md");
  assert.equal(error, null);
  assert.ok(existsSync(bundle));
});

test("leftover markers WITH an edit-tool denial on the SAME file report the true cause and block the PR", () => {
  const { work } = midMerge();
  writeFileSync(
    join(work, "a.md"),
    "top\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main\n",
  );
  const { error, ghCalls } = runBundle(work, "a.md", {
    LLM_PERMISSION_DENIALS: "5",
    LLM_PERMISSION_DENIALS_BY_FILE: JSON.stringify({ "a.md": ["Edit"] }),
  });
  assert.notEqual(error, null);
  assert.ok(ghCalls.some((c) => c.includes("auto-resolve-blocked")));
  const comments = ghCalls.filter((c) => c.startsWith("pr comment"));
  assert.equal(comments.length, 1);
  assert.ok(comments[0].includes("denied the write tools"));
});

test("leftover markers with a denial on a DIFFERENT file stay the ordinary human handoff", () => {
  // One shard per file: a denial on another file's shard says nothing about why
  // THIS file kept its markers, so it must not be reported as a blocked
  // resolver — and must not label the PR out of auto-resolve.
  const { work } = midMerge();
  writeFileSync(
    join(work, "a.md"),
    "top\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main\n",
  );
  const { error, ghCalls } = runBundle(work, "a.md", {
    LLM_PERMISSION_DENIALS: "5",
    LLM_PERMISSION_DENIALS_BY_FILE: JSON.stringify({ "other.md": ["Edit"] }),
  });
  assert.notEqual(error, null);
  assert.ok(!ghCalls.some((c) => c.includes("auto-resolve-blocked")));
  const comments = ghCalls.filter((c) => c.startsWith("pr comment"));
  assert.ok(comments[0].includes("left conflict markers behind"));
});

test("leftover markers with a denial of a NON-edit tool stay the ordinary human handoff", () => {
  const { work } = midMerge();
  writeFileSync(
    join(work, "a.md"),
    "top\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main\n",
  );
  const { error, ghCalls } = runBundle(work, "a.md", {
    LLM_PERMISSION_DENIALS: "2",
    LLM_PERMISSION_DENIALS_BY_FILE: JSON.stringify({ "a.md": ["Bash"] }),
  });
  assert.notEqual(error, null);
  assert.ok(!ghCalls.some((c) => c.includes("auto-resolve-blocked")));
});

test("a modify/delete path is staged from the KEEP verdict, not from the working tree", () => {
  const { work, root } = midMergeModifyDelete();
  const verdicts = join(root, "verdicts.json");
  writeFileSync(verdicts, JSON.stringify({ "a.md": { decision: "keep" } }));
  const { error } = runBundle(work, "a.md", {
    MODIFY_DELETE_PATHS: "a.md",
    MODIFY_DELETE_VERDICTS: verdicts,
  });
  assert.equal(error, null);
  assert.equal(readFileSync(join(work, "a.md"), "utf8"), "main side\n");
});

test("a modify/delete path is DELETED when the verdict says so, though the tree holds the surviving side", () => {
  const { work, root } = midMergeModifyDelete();
  const verdicts = join(root, "verdicts.json");
  writeFileSync(verdicts, JSON.stringify({ "a.md": { decision: "delete" } }));
  const { error } = runBundle(work, "a.md", {
    MODIFY_DELETE_PATHS: "a.md",
    MODIFY_DELETE_VERDICTS: verdicts,
  });
  assert.equal(error, null);
  assert.ok(!existsSync(join(work, "a.md")));
});

test("a modify/delete path with NO verdict is refused rather than resolved from the tree", () => {
  const { work } = midMergeModifyDelete();
  const { error, bundle, ghCalls } = runBundle(work, "a.md", {
    MODIFY_DELETE_PATHS: "a.md",
  });
  assert.notEqual(error, null);
  assert.ok(!existsSync(bundle));
  assert.ok(
    ghCalls.some((c) => c.includes("keep-or-delete") || c.includes("verdict")),
  );
});

test("a modify/delete path with an unusable verdict is refused", () => {
  const { work, root } = midMergeModifyDelete();
  const verdicts = join(root, "verdicts.json");
  writeFileSync(verdicts, JSON.stringify({ "a.md": null }));
  const { error, bundle } = runBundle(work, "a.md", {
    MODIFY_DELETE_PATHS: "a.md",
    MODIFY_DELETE_VERDICTS: verdicts,
  });
  assert.notEqual(error, null);
  assert.ok(!existsSync(bundle));
});

test("the self-review runs on ANY configured credential — a short rung list would skip it silently", () => {
  // Member-by-member coverage of the rung list lives in
  // auto-resolve-lib.test.mjs; what is asserted here is that bundle's
  // "is a reviewer configured?" probe reads that same list. With only this one
  // rung set, the review must be attempted: it fails (no BASE_WORKTREE), and
  // that refusal is the observable difference from silently skipping it.
  for (const rung of [
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN_FALLBACK",
    "CLAUDE_CODE_OAUTH_TOKEN_FALLBACK_2",
    "CLAUDE_CODE_OAUTH_TOKEN_FALLBACK_3",
    "CLAUDE_CODE_OAUTH_TOKEN_FALLBACK_4",
    "CLAUDE_CODE_OAUTH_TOKEN_FALLBACK_5",
    "CLAUDE_CODE_OAUTH_TOKEN_FALLBACK_6",
  ]) {
    const { work } = midMerge();
    writeFileSync(join(work, "a.md"), "resolved\n");
    const { error, bundle } = runBundle(work, "a.md", {
      [rung]: "sk-ant-oat-x",
    });
    assert.notEqual(error, null, `${rung} must reach the reviewer`);
    assert.ok(!existsSync(bundle), `${rung} must not bundle unreviewed`);
  }
});

test("the self-review is skipped, and the merge still bundled, when it is turned off", () => {
  const { work } = midMerge();
  writeFileSync(join(work, "a.md"), "resolved\n");
  const { error, bundle } = runBundle(work, "a.md", {
    CLAUDE_CODE_OAUTH_TOKEN_FALLBACK_2: "sk-ant-oat-x",
    AUTO_RESOLVE_SELF_REVIEW_DISABLED: "true",
  });
  assert.equal(error, null);
  assert.ok(existsSync(bundle));
});
