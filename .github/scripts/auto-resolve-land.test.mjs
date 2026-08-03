import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { midMerge, runBundle } from "./auto-resolve-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "auto-resolve-land.sh");
const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

// Produces a real bundle the way the resolve job does, then hands back a FRESH
// clone standing in for the land job's own checkout — which shares no state
// with the tree the resolution was computed in.
function resolved({ conflictFile = "a.md", bContent } = {}) {
  const fixture = midMerge({
    bContent,
    extraConflict: conflictFile === "a.md" ? null : conflictFile,
  });
  const { work, origin, root } = fixture;
  writeFileSync(join(work, "a.md"), "resolved: feature + main\n");
  if (conflictFile !== "a.md")
    writeFileSync(join(work, conflictFile), "resolved: feature + main\n");
  const list = conflictFile === "a.md" ? "a.md" : `a.md ${conflictFile}`;
  const { error, bundleDir } = runBundle(work, list);
  assert.equal(error, null, "fixture bundle step must succeed");
  const landDir = join(root, "land");
  git(root, "clone", "-q", "-b", "feature", origin, landDir);
  git(landDir, "config", "user.email", "t@t");
  git(landDir, "config", "user.name", "t");
  git(landDir, "config", "commit.gpgsign", "false");
  return { work, origin, root, bundleDir, landDir };
}

// Rebuilds the bundle around a merge commit that also touches a file git merged
// cleanly — the tampering the land job's independent replay exists to catch.
function tamper(
  work,
  bundleDir,
  path = "b.md",
  content = "content from neither side\n",
) {
  writeFileSync(join(work, path), content);
  git(work, "add", path);
  git(work, "commit", "-q", "--amend", "--no-edit", "--no-verify");
  const parents = git(work, "rev-list", "--parents", "-n", "1", "HEAD")
    .trim()
    .split(" ")
    .slice(1);
  git(work, "update-ref", "refs/auto-resolve/result", "HEAD");
  rmSync(join(bundleDir, "merge.bundle"));
  git(
    work,
    "bundle",
    "create",
    join(bundleDir, "merge.bundle"),
    "refs/auto-resolve/result",
    "--not",
    ...parents,
  );
}

function runLand(landDir, bundleDir, env = {}) {
  const root = dirname(landDir);
  const ghLog = join(root, ".gh-calls-land");
  writeFileSync(ghLog, "");
  const binDir = join(root, ".fakebin-land");
  mkdirSync(binDir, { recursive: true });
  const ghPath = join(binDir, "gh");
  writeFileSync(
    ghPath,
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${ghLog}"\nexit 0\n`,
  );
  chmodSync(ghPath, 0o755);
  const runnerTemp = join(root, "runner-temp");
  mkdirSync(runnerTemp, { recursive: true });
  let error = null;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [SCRIPT], {
      cwd: landDir,
      encoding: "utf8",
      env: {
        ...process.env,
        HEAD_REF: "feature",
        BASE_REF: "main",
        PR: "1",
        GITHUB_TOKEN: "x",
        TEMPLATE_SYNC_TOKEN: "x",
        BUNDLE_DIR: bundleDir,
        RUNNER_TEMP: runnerTemp,
        ...env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });
  } catch (err) {
    error = err;
    stdout = String(err.stdout ?? "");
  }
  const ghCalls = readFileSync(ghLog, "utf8").split("\n").filter(Boolean);
  return { error, ghCalls, stdout };
}

test("land pushes a resolution whose only differences from its own replay are the conflicted files", () => {
  const { origin, bundleDir, landDir } = resolved();
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls } = runLand(landDir, bundleDir);
  assert.equal(error, null);
  const after = git(origin, "rev-parse", "feature").trim();
  assert.notEqual(after, before);
  const comments = ghCalls.filter((c) => c.startsWith("pr comment"));
  assert.equal(comments.length, 1);
  assert.ok(comments[0].includes("Auto-resolved the merge conflict"));
  assert.ok(!comments[0].includes("protected path"));
});

test("land REFUSES a merge that changes a file git never left conflicted", () => {
  // The trust invariant: the resolving job holds no push credential, so the only
  // thing it can hand over is this bundle — and content present in neither
  // parent of a cleanly-merged file must not reach the branch.
  const { work, origin, bundleDir, landDir } = resolved();
  tamper(work, bundleDir);
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls } = runLand(landDir, bundleDir);
  assert.notEqual(error, null);
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
  const comments = ghCalls.filter((c) => c.startsWith("pr comment"));
  assert.equal(comments.length, 1);
  assert.ok(comments[0].includes("b.md"));
});

test("land REFUSES a merge that still carries conflict markers in a conflicted file", () => {
  const { work, origin, bundleDir, landDir } = resolved();
  tamper(
    work,
    bundleDir,
    "a.md",
    "top\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main\n",
  );
  const before = git(origin, "rev-parse", "feature").trim();
  const { error } = runLand(landDir, bundleDir);
  assert.notEqual(error, null);
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
});

test("land does nothing, quietly, when the resolve job produced no bundle", () => {
  const { origin, bundleDir, landDir } = resolved();
  rmSync(join(bundleDir, "merge.bundle"));
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls } = runLand(landDir, bundleDir);
  assert.equal(error, null); // a failed resolve already reported itself
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
  assert.deepEqual(ghCalls, []);
});

test("land stands down when the BASE branch moved under the resolution", () => {
  // The base parent is pinned to the tip this job fetched, not merely to an
  // ancestor of it. An ancestor check would let the resolving job name an
  // ANCIENT base commit, whose replay conflicts across most of the tree — and
  // the conflicted set is exactly what licenses differences from the replay.
  const { origin, bundleDir, landDir, root } = resolved();
  const mover = join(root, "mover");
  git(root, "clone", "-q", "-b", "main", origin, mover);
  git(mover, "config", "user.email", "t@t");
  git(mover, "config", "user.name", "t");
  git(mover, "config", "commit.gpgsign", "false");
  writeFileSync(join(mover, "later.md"), "the base moved on\n");
  git(mover, "add", "later.md");
  git(mover, "commit", "-q", "-m", "later work on main");
  git(mover, "push", "-q", "origin", "main");
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls, stdout } = runLand(landDir, bundleDir);
  assert.equal(error, null); // a race, not a fault
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
  assert.deepEqual(ghCalls, []);
  assert.match(stdout, /standing down/);
});

test("land REFUSES a bundle whose base parent is not on the base branch at all", () => {
  const { work, origin, bundleDir, landDir } = resolved();
  // Re-parent the merge onto a base commit that was never pushed anywhere.
  git(work, "checkout", "-q", "--detach", "HEAD^2");
  writeFileSync(join(work, "unpushed.md"), "never on main\n");
  git(work, "add", "unpushed.md");
  git(work, "commit", "-q", "-m", "a base commit no branch carries");
  const rogueBase = git(work, "rev-parse", "HEAD").trim();
  const head = git(work, "rev-parse", "feature").trim();
  git(work, "checkout", "-q", "--detach", head);
  git(work, "merge", "--no-commit", "--no-ff", rogueBase);
  git(work, "commit", "-q", "--no-edit", "--no-verify");
  const merge = git(work, "rev-parse", "HEAD").trim();
  git(work, "update-ref", "refs/auto-resolve/result", merge);
  rmSync(join(bundleDir, "merge.bundle"));
  git(
    work,
    "bundle",
    "create",
    join(bundleDir, "merge.bundle"),
    "refs/auto-resolve/result",
    "--not",
    head,
  );
  const before = git(origin, "rev-parse", "feature").trim();
  const { error } = runLand(landDir, bundleDir);
  assert.notEqual(error, null);
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
});

test("land REFUSES a bundle whose head parent is not on the PR branch", () => {
  // The replay is only meaningful against the branches the merge claims to
  // join: without this check the merge would be re-derived from two commits the
  // untrusted job chose, and any tree at all would reproduce itself.
  const { origin, bundleDir, landDir, root } = resolved();
  const rewrite = join(root, "rewrite");
  git(root, "clone", "-q", "-b", "main", origin, rewrite);
  git(rewrite, "config", "user.email", "t@t");
  git(rewrite, "config", "user.name", "t");
  git(rewrite, "config", "commit.gpgsign", "false");
  git(rewrite, "checkout", "-q", "-B", "feature", "main");
  writeFileSync(join(rewrite, "c.md"), "divergent history\n");
  git(rewrite, "add", "c.md");
  git(rewrite, "commit", "-q", "-m", "force-pushed replacement");
  git(rewrite, "push", "-q", "--force", "origin", "feature");
  const before = git(origin, "rev-parse", "feature").trim();
  const { error } = runLand(landDir, bundleDir);
  assert.notEqual(error, null);
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
});

test("land FAILS CLOSED (labels auto-resolve-blocked, no push) when no push token is set", () => {
  const { origin, bundleDir, landDir } = resolved();
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls } = runLand(landDir, bundleDir, {
    TEMPLATE_SYNC_TOKEN: "",
  });
  assert.notEqual(error, null);
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
  assert.ok(ghCalls.some((c) => c.includes("auto-resolve-blocked")));
  const comments = ghCalls.filter((c) => c.startsWith("pr comment"));
  assert.equal(comments.length, 1);
  assert.ok(comments[0].includes("TEMPLATE_SYNC_TOKEN"));
});

test("land re-derives the protected-path warning from the conflicts it computed itself", () => {
  const { origin, bundleDir, landDir } = resolved({
    conflictFile: ".github/workflows/ci.yaml",
  });
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls } = runLand(landDir, bundleDir);
  assert.equal(error, null);
  assert.notEqual(git(origin, "rev-parse", "feature").trim(), before);
  const comments = ghCalls.filter((c) => c.startsWith("pr comment"));
  assert.ok(comments[0].includes("protected path"));
  assert.ok(comments[0].includes(".github/workflows/ci.yaml"));
});

test("land stands down when the branch moved and no longer conflicts", () => {
  const { origin, bundleDir, landDir, root } = resolved();
  // Someone else resolved the conflict while this resolution was in flight.
  const other = join(root, "other");
  git(root, "clone", "-q", "-b", "feature", origin, other);
  git(other, "config", "user.email", "t@t");
  git(other, "config", "user.name", "t");
  git(other, "config", "commit.gpgsign", "false");
  git(other, "fetch", "-q", "origin", "main");
  try {
    git(other, "merge", "--no-edit", "origin/main");
  } catch {
    writeFileSync(join(other, "a.md"), "hand-resolved\n");
    git(other, "add", "a.md");
    git(other, "commit", "-q", "--no-edit");
  }
  git(other, "push", "-q", "origin", "feature");
  const before = git(origin, "rev-parse", "feature").trim();
  const { error, ghCalls, stdout } = runLand(landDir, bundleDir);
  assert.equal(error, null); // a race someone else won is not this run's failure
  assert.equal(git(origin, "rev-parse", "feature").trim(), before);
  assert.deepEqual(ghCalls, []);
  assert.match(stdout, /standing down/);
});

test("the bundle carries no manifest for land to believe — only the merge commit", () => {
  const { bundleDir } = resolved();
  const files = execFileSync("ls", ["-A", bundleDir], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(files, ["merge.bundle"]);
  assert.ok(existsSync(join(bundleDir, "merge.bundle")));
});
