import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "auto-resolve-prepare.sh");
const scratch = () => mkdtempSync(join(tmpdir(), "auto-resolve-"));

const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

// Build an origin repo whose `main` and `feature` branches both edit `file`, so
// merging main into feature conflicts on exactly that path. Returns a `work`
// clone checked out on feature (with `origin` pointing at the bare repo).
function fixtureConflictingOn(file) {
  const root = scratch();
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  git(root, "init", "--bare", "-q", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "config", "user.email", "t@t");
  git(work, "config", "user.name", "t");

  mkdirSync(dirname(join(work, file)), { recursive: true });
  writeFileSync(join(work, file), "base\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  git(work, "branch", "-M", "main");
  git(work, "push", "-q", "origin", "main");

  git(work, "checkout", "-q", "-b", "feature");
  writeFileSync(join(work, file), "feature side\n");
  git(work, "commit", "-q", "-am", "feature");
  git(work, "push", "-q", "origin", "feature");

  git(work, "checkout", "-q", "main");
  writeFileSync(join(work, file), "main side\n");
  git(work, "commit", "-q", "-am", "main change");
  git(work, "push", "-q", "origin", "main");

  git(work, "checkout", "-q", "feature");
  return work;
}

// A `work` clone of a fresh bare origin, with an identity configured and one
// committed file so later commits can delete a path without emptying the tree.
// Left on `main`, already pushed.
function newRepo() {
  const root = scratch();
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  git(root, "init", "--bare", "-q", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "config", "user.email", "t@t");
  git(work, "config", "user.name", "t");
  writeFileSync(join(work, "keep.txt"), "keep\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  git(work, "branch", "-M", "main");
  git(work, "push", "-q", "origin", "main");
  return work;
}

// Switch to `branch`, creating it off the current commit the first time (the
// fixtures below build `feature` from the base, then return to `main`).
const checkoutBranch = (work, branch) =>
  branch === "feature"
    ? git(work, "checkout", "-q", "-b", "feature")
    : git(work, "checkout", "-q", "main");

// Build a repo where `file` exists at the merge base, one side DELETES it and
// the other MODIFIES it — git's modify/delete, which it resolves with NO
// conflict markers, leaving the surviving side's bytes in the worktree.
// `deletedOn` picks which branch does the deleting.
function fixtureModifyDelete(file, deletedOn) {
  const work = newRepo();
  mkdirSync(dirname(join(work, file)), { recursive: true });
  writeFileSync(join(work, file), "base\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "add file");
  git(work, "push", "-q", "origin", "main");

  const act = (branch) => {
    if (branch === deletedOn) {
      git(work, "rm", "-q", file);
    } else {
      writeFileSync(join(work, file), `${branch} side\n`);
      git(work, "add", "--", file);
    }
    git(work, "commit", "-q", "-m", `${branch} change`);
  };

  git(work, "checkout", "-q", "-b", "feature");
  act("feature");
  git(work, "push", "-q", "origin", "feature");

  git(work, "checkout", "-q", "main");
  act("main");
  git(work, "push", "-q", "origin", "main");

  git(work, "checkout", "-q", "feature");
  return work;
}

// Run prepare.sh in `work` with a fake `gh` on PATH that records every
// invocation, so a test can assert prepare never talks to GitHub (warning about
// a protected path is the land step's job, on the comment it posts with the
// pushed resolution). Returns the parsed $GITHUB_OUTPUT, whether a merge is
// still in progress (MERGE_HEAD present), the recorded gh argv lines, and the
// run's own log.
function runPrepare(work, extraEnv = {}) {
  const outFile = join(work, ".gh-output");
  writeFileSync(outFile, "");
  const ghLog = join(work, ".gh-calls");
  writeFileSync(ghLog, "");
  const ghBin = join(work, ".fakebin");
  mkdirSync(ghBin, { recursive: true });
  const ghPath = join(ghBin, "gh");
  writeFileSync(
    ghPath,
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${ghLog}"\nexit 0\n`,
  );
  chmodSync(ghPath, 0o755);
  let error = null;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [SCRIPT], {
      cwd: work,
      encoding: "utf8",
      env: {
        ...process.env,
        BASE_REF: "main",
        HEAD_REF: "feature",
        GITHUB_TOKEN: "x",
        GITHUB_OUTPUT: outFile,
        PATH: `${ghBin}:${process.env.PATH ?? ""}`,
        ...extraEnv,
      },
    });
  } catch (err) {
    error = err;
    stdout = String(err.stdout ?? "");
  }
  const outputs = Object.fromEntries(
    readFileSync(outFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
  let merging = true;
  try {
    git(work, "rev-parse", "--verify", "-q", "MERGE_HEAD");
  } catch {
    merging = false;
  }
  const ghCalls = readFileSync(ghLog, "utf8").split("\n").filter(Boolean);
  const commented = ghCalls.some((c) => c.startsWith("pr comment"));
  return { outputs, merging, error, ghCalls, commented, stdout };
}

test("a conflict in a SAFE path is handed to the LLM with no protected-path warning", () => {
  const work = fixtureConflictingOn("docs/thing.md");
  const { outputs, merging, commented, stdout } = runPrepare(work);
  assert.equal(outputs.needs_llm, "true");
  assert.equal(outputs.needs_commit, "true");
  assert.equal(outputs.conflict_list, "docs/thing.md");
  assert.ok(!stdout.includes("protected path"));
  assert.equal(merging, true); // merge left mid-flight for Claude + the bundle step
  assert.equal(commented, false);
});

test("an ordinary marker conflict leaves modify_delete empty", () => {
  const { outputs } = runPrepare(fixtureConflictingOn("docs/thing.md"));
  assert.equal(outputs.conflict_list, "docs/thing.md");
  assert.equal(outputs.modify_delete, "");
});

for (const deletedOn of ["feature", "main"]) {
  test(`a modify/delete conflict (deleted on ${deletedOn}) is reported in modify_delete AND kept in conflict_list`, () => {
    const work = fixtureModifyDelete("docs/gone.md", deletedOn);
    const { outputs, merging, commented } = runPrepare(work);
    // Still the LLM's to resolve — the decision is keep-or-delete, not a merge.
    assert.equal(outputs.needs_llm, "true");
    assert.equal(outputs.needs_commit, "true");
    assert.equal(outputs.conflict_list, "docs/gone.md");
    assert.equal(outputs.modify_delete, "docs/gone.md");
    assert.equal(outputs.unresolvable ?? "", "");
    assert.equal(merging, true);
    assert.equal(commented, false);
  });
}

test("a delete/delete alongside a marker conflict leaves modify_delete empty", () => {
  // Both sides delete `gone.txt` (git merges that cleanly, so it is never
  // conflicted) while both edit `shared.txt`.
  const work = newRepo();
  writeFileSync(join(work, "gone.txt"), "gone\n");
  writeFileSync(join(work, "shared.txt"), "base\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "add files");
  git(work, "push", "-q", "origin", "main");
  for (const branch of ["feature", "main"]) {
    checkoutBranch(work, branch);
    git(work, "rm", "-q", "gone.txt");
    writeFileSync(join(work, "shared.txt"), `${branch} side\n`);
    git(work, "commit", "-q", "-am", `${branch} change`);
    git(work, "push", "-q", "origin", branch);
  }
  git(work, "checkout", "-q", "feature");

  const { outputs } = runPrepare(work);
  assert.equal(outputs.conflict_list, "shared.txt");
  assert.equal(outputs.modify_delete, "");
});

test("an add/add conflict leaves modify_delete empty", () => {
  // Neither side has a merge-base entry for `new.txt`, so there is no stage 1
  // — a marker conflict, not a modify/delete.
  const work = newRepo();
  for (const branch of ["feature", "main"]) {
    checkoutBranch(work, branch);
    writeFileSync(join(work, "new.txt"), `${branch} side\n`);
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", `${branch} adds new.txt`);
    git(work, "push", "-q", "origin", branch);
  }
  git(work, "checkout", "-q", "feature");

  const { outputs } = runPrepare(work);
  assert.equal(outputs.conflict_list, "new.txt");
  assert.equal(outputs.modify_delete, "");
});

test("a conflict in a PROTECTED path is handed to the LLM and logged, not escalated away", () => {
  // Which paths count as protected is the shared predicate's contract, covered
  // member-by-member in auto-resolve-lib.test.mjs; what prepare owns is that a
  // protected conflict still goes to the LLM and is named in the run's log.
  const work = fixtureConflictingOn(".github/workflows/ci.yaml");
  const { outputs, merging, ghCalls, stdout } = runPrepare(work);
  assert.equal(outputs.needs_llm, "true"); // resolved, not escalated away
  assert.equal(outputs.needs_commit, "true");
  assert.equal(outputs.conflict_list, ".github/workflows/ci.yaml");
  assert.match(stdout, /protected path\(s\) '\.github\/workflows\/ci\.yaml'/);
  assert.equal(merging, true); // merge KEPT for Claude + the bundle step, not aborted
  // Prepare never talks to GitHub — a run that resolves nothing says nothing,
  // so the warning rides the land step's pushed-resolution comment instead.
  assert.deepEqual(ghCalls, []);
});

test("a clean merge (no conflict) is a no-op", () => {
  // feature edits a different file than main → no conflict.
  const root = scratch();
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  git(root, "init", "--bare", "-q", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "config", "user.email", "t@t");
  git(work, "config", "user.name", "t");
  writeFileSync(join(work, "a.txt"), "a\n");
  writeFileSync(join(work, "b.txt"), "b\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  git(work, "branch", "-M", "main");
  git(work, "push", "-q", "origin", "main");
  git(work, "checkout", "-q", "-b", "feature");
  writeFileSync(join(work, "a.txt"), "a changed on feature\n");
  git(work, "commit", "-q", "-am", "feature");
  git(work, "checkout", "-q", "main");
  writeFileSync(join(work, "b.txt"), "b changed on main\n");
  git(work, "commit", "-q", "-am", "main");
  git(work, "push", "-q", "origin", "main");
  git(work, "checkout", "-q", "feature");

  const { outputs, merging } = runPrepare(work);
  assert.equal(outputs.needs_commit, "false");
  assert.equal(outputs.needs_llm, "false");
  assert.equal(merging, false); // clean merge auto-committed, no conflict
});
