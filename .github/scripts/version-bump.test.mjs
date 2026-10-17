import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
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

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIVE_SCRIPT = join(REPO_ROOT, ".github", "scripts", "version-bump.sh");
const AUTO_VERSION_YAML = join(
  REPO_ROOT,
  ".github",
  "workflows",
  "auto-version.yaml",
);
const TEMPLATE_SYNC_YAML = join(
  REPO_ROOT,
  ".github",
  "workflows",
  "template-sync.yaml",
);

/**
 * Render a GitHub Actions `${{ … }}` expression. Written as a template literal
 * with an escaped `${` so the literal never reads as a JS interpolation.
 */
const expr = (inner) => `$\{{ ${inner} }}`;

// --- Bug B: the release push rides an own-repo credential, never a
// cross-account PAT --------------------------------------------------------
// The release-docs commit and vX.Y.Z tag are pushed with the credentials the
// checkout persists. A cross-account PAT (TEMPLATE_SYNC_TOKEN, minted for a
// different owner) is rejected 403 by this repo's remote, stranding every
// release: npm publishes but the tag never lands, so the next run re-reads the
// climbing npm version and bumps again. GITHUB_TOKEN's `contents: write`
// authorizes github-actions[bot] on its own repo and is the default; the only
// permitted override is RELEASE_BYPASS_TOKEN, an own-owner PAT registered as a
// bypass actor for a protected default branch.

test("auto-version.yaml runs the .github/scripts release script", () => {
  const yaml = readFileSync(AUTO_VERSION_YAML, "utf8");
  const invocations = [
    ...yaml.matchAll(/bash\s+(?<script>\S*version-bump\.sh)/g),
  ].map((m) => m.groups.script);
  assert.deepEqual(
    invocations,
    [".github/scripts/version-bump.sh"],
    "the workflow must run one, and only the .github/scripts, version-bump.sh",
  );
  assert.ok(existsSync(LIVE_SCRIPT), "the invoked script must exist on disk");
});

test("the release checkout falls back to GITHUB_TOKEN and names no cross-account PAT", () => {
  const yaml = readFileSync(AUTO_VERSION_YAML, "utf8");
  const tokenLines = yaml
    .split("\n")
    .filter((l) => /^\s*token:/.test(l))
    .map((l) => l.trim());
  assert.deepEqual(
    tokenLines,
    [`token: ${expr("secrets.RELEASE_BYPASS_TOKEN || secrets.GITHUB_TOKEN")}`],
    "the checkout must default to GITHUB_TOKEN, overridable only by the own-owner bypass PAT",
  );
  assert.doesNotMatch(
    yaml,
    /secrets\.TEMPLATE_SYNC_TOKEN/,
    "the release checkout must never reach for the cross-account template-sync PAT",
  );
});

// A repo that already publishes must not receive a second publisher. The sync
// only UPDATES this workflow, never INTRODUCES it — which is only true while
// its path is in template-sync.yaml's OPT_IN_PATHS.
test("auto-version.yaml is opt-in, so the sync never introduces a second publisher", () => {
  const yaml = readFileSync(TEMPLATE_SYNC_YAML, "utf8");
  const optIn = yaml.match(/^\s*OPT_IN_PATHS:\s*"(?<paths>[^"]*)"/m);
  assert.ok(optIn, "template-sync.yaml must define OPT_IN_PATHS");
  assert.ok(
    optIn.groups.paths
      .split(/\s+/)
      .includes(".github/workflows/auto-version.yaml"),
    "the release workflow must be opt-in, not unconditionally synced",
  );
});

// --- Bug A: automated major bumps are disabled ----------------------------
// A breaking-change marker (`type!:` subject or `BREAKING CHANGE:` footer) must
// be CAPPED at a minor bump, never a major one: a stray `!` in a routine commit
// must not leap the whole version line. The npm stub reports the package at
// 5.0.0 and answers the `pkg@<version>` existence probe with success, so each
// run stops at the "already exists" guard BEFORE any publish/push — nothing
// leaves the sandbox.
const NPM_AT_5_STUB =
  'if [[ "$2" == *@* ]]; then exit 0; else echo "5.0.0"; fi';

/** Build a throwaway git repo tagged v0.0.0 at HEAD, plus a stubbed `npm`. */
function makeSandbox(npmStubBody) {
  const dir = mkdtempSync(join(tmpdir(), "vbump-"));
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "sandbox-pkg", version: "0.0.0" })}\n`,
  );
  const binDir = join(dir, "stub-bin");
  mkdirSync(binDir);
  const npmStub = join(binDir, "npm");
  writeFileSync(npmStub, `#!/usr/bin/env bash\n${npmStubBody}\n`);
  chmodSync(npmStub, 0o755);

  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@t.test");
  git("config", "user.name", "t");
  git("commit", "-q", "--allow-empty", "-m", "chore: seed");
  git("tag", "v0.0.0");
  return { dir, binDir };
}

/** Run the live script in `dir`; return {status, stderr, stdout}. */
function runScript(dir, binDir) {
  const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` };
  // Clear every credential-ladder rung so the sandboxed runs never reach the
  // real Claude API and always take the commit-list changelog fallback.
  for (const key of Object.keys(env)) {
    if (key.startsWith("CLAUDE_CODE_OAUTH_TOKEN")) {
      delete env[key];
    }
  }
  delete env.GITHUB_OUTPUT;
  // In CI GITHUB_REF_NAME names the PR branch; drop it so the docs push targets
  // the sandbox's own branch (which the bare origin below rejects on purpose).
  delete env.GITHUB_REF_NAME;
  const res = spawnSync("bash", [LIVE_SCRIPT], {
    cwd: dir,
    env,
    encoding: "utf8",
  });
  assert.equal(res.error, undefined, "failed to spawn the release script");
  return { status: res.status, stderr: res.stderr, stdout: res.stdout };
}

// --- Bug C: tag ordering — the dedup tag must land before the docs push -----
// The vX.Y.Z tag is the dedup guard that stops the next run from re-analyzing
// the same commits. It MUST be pushed immediately after a successful npm
// publish, before the CHANGELOG/docs push: a docs-push failure still exits
// non-zero, but with the tag already landed, so a partial release cannot strand
// a published-but-untagged version that the next run re-bumps (a version walk).

/** npm stub for a real release path: package at 5.0.0, probe says "not yet published". */
const NPM_RELEASABLE_STUB =
  'if [[ "$2" == *@* ]]; then exit 1; else echo "5.0.0"; fi';

/** Add publish/sleep stubs and a bare origin whose branches reject pushes (tags land). */
function makeReleaseSandbox({
  npmStub = NPM_RELEASABLE_STUB,
  pnpmStub = "exit 0",
} = {}) {
  const { dir, binDir } = makeSandbox(npmStub);
  // pnpm publish must "succeed" without touching a registry.
  writeFileSync(join(binDir, "pnpm"), `#!/usr/bin/env bash\n${pnpmStub}\n`);
  chmodSync(join(binDir, "pnpm"), 0o755);
  // retry_cmd sleeps between attempts; stub it so the failing-push retries are instant.
  writeFileSync(join(binDir, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(join(binDir, "sleep"), 0o755);

  // Bare origin that accepts tag pushes but rejects branch pushes — the exact
  // partial failure that used to strand a published release untagged.
  const origin = join(dir, "origin.git");
  execFileSync("git", ["init", "-q", "--bare", origin]);
  const preReceive = join(origin, "hooks", "pre-receive");
  writeFileSync(
    preReceive,
    '#!/usr/bin/env bash\nwhile read -r _old _new ref; do\n  [[ "$ref" == refs/heads/* ]] && exit 1\ndone\nexit 0\n',
  );
  chmodSync(preReceive, 0o755);
  execFileSync("git", ["remote", "add", "origin", origin], { cwd: dir });
  // A CHANGELOG with Unreleased content so the run has a docs commit to push.
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# Changelog\n\n## Unreleased\n\n### Added\n\n- a thing\n",
  );
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "feat: releasable work"], {
    cwd: dir,
  });
  return { dir, binDir, origin };
}

test("tag is pushed before the docs push; a docs-push failure exits non-zero with the tag landed", () => {
  const { dir, binDir, origin } = makeReleaseSandbox();
  try {
    const { status, stderr } = runScript(dir, binDir);
    // Fail loud on the docs push...
    assert.notEqual(status, 0, "a failed docs push must fail the run");
    assert.match(stderr, /failed to push the release-docs update/);
    // ...but only AFTER the dedup tag landed on the remote.
    assert.match(stderr, /Pushed tag v5\.1\.0/);
    const remoteTags = execFileSync("git", ["ls-remote", "--tags", origin], {
      encoding: "utf8",
    });
    assert.match(remoteTags, /refs\/tags\/v5\.1\.0/);
    // Ordering in the transcript: tag push succeeded before the docs failure.
    assert.ok(
      stderr.indexOf("Pushed tag v5.1.0") <
        stderr.indexOf("failed to push the release-docs update"),
      "tag must be pushed before the docs push is attempted",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Losing a race with a second publisher is a no-op, not an alert ---------
// A repo that runs two release workflows on the default branch has both compute
// the same version from the same commits. The loser must recognize that and stop
// quietly: npm's bare `E404 ... PUT` on an already-published version names
// neither the duplicate nor the workflow that beat it, so the script has to
// classify it by re-probing the registry rather than by reading the message.

test("a version already tagged on the remote is left to its publisher, not re-published", () => {
  const { dir, binDir, origin } = makeReleaseSandbox();
  try {
    // The rival workflow's tag is on origin but not in this checkout — exactly
    // the window between its `git push origin vX.Y.Z` and this run's publish.
    const git = (...args) => execFileSync("git", args, { cwd: dir });
    git("tag", "v5.1.0");
    git("push", "-q", "origin", "v5.1.0");
    git("tag", "-d", "v5.1.0");

    const { status, stderr } = runScript(dir, binDir);
    assert.equal(status, 0, stderr);
    assert.match(stderr, /Tag v5\.1\.0 already exists on the remote/);
    assert.match(stderr, /keep exactly one publisher/);
    // Nothing was published: the guard fires before pnpm publish.
    assert.doesNotMatch(stderr, /Published sandbox-pkg/);
    assert.doesNotMatch(
      execFileSync("git", ["ls-remote", "--heads", origin], {
        encoding: "utf8",
      }),
      /refs\/heads\//,
      "no release-docs commit may be pushed for a version this run did not publish",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a publish E404 on a version that IS on the registry is a lost race, not a failure", () => {
  // The rival publishes between this run's pre-publish probe and its own PUT:
  // the first `npm view pkg@ver` says "not published", every later one says it
  // is. npm answers the PUT with a bare 404 that names no duplicate.
  const RACED_NPM_STUB = [
    'if [[ "$2" == *@* ]]; then',
    "  n=$(cat .npm-probe-count 2>/dev/null || echo 0)",
    "  echo $((n + 1)) >.npm-probe-count",
    '  [[ "$n" -ge 1 ]] && exit 0 || exit 1',
    "else",
    '  echo "5.0.0"',
    "fi",
  ].join("\n");
  const PUBLISH_404 = [
    'echo "npm error code E404" >&2',
    'echo "npm error 404 Not Found - PUT https://registry.npmjs.org/sandbox-pkg - Not found" >&2',
    "exit 1",
  ].join("\n");

  const { dir, binDir, origin } = makeReleaseSandbox({
    npmStub: RACED_NPM_STUB,
    pnpmStub: PUBLISH_404,
  });
  try {
    const { status, stderr } = runScript(dir, binDir);
    assert.equal(status, 0, stderr);
    assert.match(stderr, /another release workflow published it first/);
    // The rival owns the tag too — this run must not push one.
    assert.doesNotMatch(
      execFileSync("git", ["ls-remote", "--tags", origin], {
        encoding: "utf8",
      }),
      /refs\/tags\//,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a publish E404 on a version that is NOT on the registry still fails loud", () => {
  // Same 404 text, but the version never appears — a real permission/name
  // failure. Swallowing it here would turn a broken release into a silent green.
  const PUBLISH_404 = [
    'echo "npm error code E404" >&2',
    'echo "npm error 404 Not Found - PUT https://registry.npmjs.org/sandbox-pkg - Not found" >&2',
    "exit 1",
  ].join("\n");
  const { dir, binDir } = makeReleaseSandbox({ pnpmStub: PUBLISH_404 });
  try {
    const { status, stderr } = runScript(dir, binDir);
    assert.notEqual(status, 0, "an unexplained publish 404 must fail the run");
    assert.match(stderr, /404 Not Found - PUT/);
    assert.doesNotMatch(stderr, /another release workflow published it first/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a range containing only release-docs commits is skipped, not re-released", () => {
  // With the tag preceding the docs commit, HEAD sits one "docs: release ..."
  // commit past the tag after every successful release; a manual re-dispatch
  // must not read that commit as releasable work.
  const { dir, binDir } = makeSandbox(NPM_AT_5_STUB);
  try {
    execFileSync(
      "git",
      ["commit", "-q", "--allow-empty", "-m", "docs: release 5.0.0 [skip ci]"],
      { cwd: dir },
    );
    const { status, stderr } = runScript(dir, binDir);
    assert.equal(status, 0, stderr);
    assert.match(
      stderr,
      /Only release-docs commits since v0\.0\.0\. Skipping\./,
    );
    assert.doesNotMatch(stderr, /New version:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const { name, subject, body } of [
  {
    name: "a `type!:` subject",
    subject: "feat(api)!: drop the legacy field",
    body: "",
  },
  {
    name: "a `BREAKING CHANGE:` footer",
    subject: "refactor(core): rework the seam",
    body: "\n\nBREAKING CHANGE: the exported signature changed",
  },
]) {
  test(`${name} is capped at a minor bump, never a major one`, () => {
    const { dir, binDir } = makeSandbox(NPM_AT_5_STUB);
    try {
      const git = (...args) =>
        execFileSync("git", args, { cwd: dir, stdio: "ignore" });
      // A breaking-change commit past the v0.0.0 tag — the exact input that used
      // to decide a major bump (5.x -> 6.0).
      git("commit", "-q", "--allow-empty", "-m", subject + body);
      const { status, stderr } = runScript(dir, binDir);
      assert.equal(status, 0, stderr);
      assert.match(stderr, /Conventional Commits bump level: minor/);
      assert.match(stderr, /New version: 5\.1\.0/);
      assert.doesNotMatch(stderr, /bump level: major/);
      assert.doesNotMatch(stderr, /New version: 6\./);
      assert.match(stderr, /automated MAJOR bumps are disabled/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
