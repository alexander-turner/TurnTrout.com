import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "auto-resolve-discover.sh");
const scratch = () => mkdtempSync(join(tmpdir(), "auto-resolve-discover-"));

// A fake `gh` that answers from JSON fixtures and applies the requested `--jq`
// with the real jq, reproducing gh's own output shape (one compact result per
// line). Three call shapes are dispatched:
//   - `gh api repos/<repo>/commits/<sha>/statuses` (the attempt-mark read)
//     answers from `statuses-<sha>.json`, defaulting to [] (no marks);
//   - `gh pr view <n> --json commits` (the age-window read) answers from
//     `commits-<n>.json`, defaulting to [] (no evidence of activity);
//   - everything else (the candidate listing) consumes the next file from
//     `PR_FIXTURES` (clamped to the last), so a test can model GitHub's
//     mergeability settling from UNKNOWN to CONFLICTING across passes.
function fakeGh(dir, fixtureFiles) {
  const listFile = join(dir, "fixtures.txt");
  writeFileSync(listFile, fixtureFiles.join("\n") + "\n");
  const countFile = join(dir, "gh-calls");
  writeFileSync(countFile, "0");
  const gh = join(dir, "gh");
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
set -euo pipefail
jqexpr='.'
jsonfields=''
args=("$@")
for ((i = 0; i < \${#args[@]}; i++)); do
  [[ "\${args[i]}" == "--jq" ]] && jqexpr="\${args[i + 1]}"
  [[ "\${args[i]}" == "--json" ]] && jsonfields="\${args[i + 1]}"
done
if [[ "\${args[0]}" == "api" ]]; then
  sha="\${args[1]#repos/owner/repo/commits/}"
  sha="\${sha%/statuses}"
  f="${dir}/statuses-\${sha}.json"
  [[ -f "$f" ]] && exec jq -c "$jqexpr" <"$f"
  exec jq -c "$jqexpr" <<<'[]'
fi
if [[ "\${args[0]}" == "pr" && "\${args[1]}" == "view" && "$jsonfields" == "commits" ]]; then
  f="${dir}/commits-\${args[2]}.json"
  commits='[]'
  [[ -f "$f" ]] && commits="$(cat "$f")"
  exec jq -c "$jqexpr" <<<"{\\"commits\\": \${commits}}"
fi
n="$(cat "${countFile}")"
mapfile -t fixtures <"${listFile}"
idx=$((n < \${#fixtures[@]} ? n : \${#fixtures[@]} - 1))
echo $((n + 1)) >"${countFile}"
jq -c "$jqexpr" <"\${fixtures[idx]}"
`,
  );
  chmodSync(gh, 0o755);
  return dir;
}

function runDiscover(
  dir,
  { prNumber, maxPasses = 1, maxAgeHours = "0", ignoreMark } = {},
) {
  const outFile = join(dir, ".gh-output");
  writeFileSync(outFile, "");
  execFileSync("bash", [SCRIPT], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      REPO: "owner/repo",
      GH_TOKEN: "x",
      GITHUB_OUTPUT: outFile,
      MAX_PASSES: String(maxPasses),
      RETRY_DELAY_SECS: "0",
      RETRY_MAX: "1",
      RETRY_BASE_DELAY: "0",
      // Most tests exercise the eligibility filters, not the activity window;
      // 0 disables the window so a fixture PR with no commit dates still
      // qualifies. The age-window tests below set it explicitly.
      AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS: String(maxAgeHours),
      ...(ignoreMark ? { AUTO_RESOLVE_IGNORE_ATTEMPT_MARK: "true" } : {}),
      ...(prNumber ? { PR_NUMBER: String(prNumber) } : {}),
      PATH: `${dir}:${process.env.PATH ?? ""}`,
    },
  });
  const line = readFileSync(outFile, "utf8")
    .split("\n")
    .find((l) => l.startsWith("prs="));
  return JSON.parse(line.slice("prs=".length));
}

const pr = (over) => ({
  number: 1,
  mergeable: "CONFLICTING",
  isDraft: false,
  isCrossRepository: false,
  author: { login: "human", is_bot: false },
  headRefName: "feature",
  headRefOid: "cafe1",
  baseRefName: "main",
  state: "OPEN",
  // gh materializes every requested --json field, so `labels` is always an
  // array (empty when the PR has none) — never absent or null.
  labels: [],
  ...over,
});

// Second precision, no milliseconds: jq's fromdateiso8601 (which both the age
// window and the attempt-mark freshness read use) rejects fractional seconds,
// and GitHub's own timestamps carry none.
const isoHoursAgo = (hours) =>
  new Date(Date.now() - hours * 3600 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

test("push scan emits only eligible CONFLICTING PRs, dropping the rest", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(
    fixture,
    JSON.stringify([
      pr({ number: 1, headRefName: "f1" }),
      pr({ number: 2, isDraft: true }), // draft → dropped
      pr({ number: 3, isCrossRepository: true }), // fork → dropped
      pr({ number: 4, author: { login: "bot", is_bot: true } }), // bot → dropped
      pr({ number: 5, mergeable: "MERGEABLE" }), // clean → dropped
      // opted out after a failed landing → dropped
      pr({ number: 6, labels: [{ name: "auto-resolve-blocked" }] }),
      pr({ number: 7, headRefName: "f7", labels: [{ name: "enhancement" }] }),
    ]),
  );
  fakeGh(dir, [fixture]);
  const prs = runDiscover(dir);
  assert.deepEqual(prs, [
    { number: 1, head_ref: "f1", base_ref: "main" },
    { number: 7, head_ref: "f7", base_ref: "main" },
  ]);
});

test("a CONFLICTING PR carrying auto-resolve-blocked is dropped", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(
    fixture,
    JSON.stringify([
      pr({ number: 1, headRefName: "f1" }),
      pr({ number: 2, labels: [{ name: "auto-resolve-blocked" }] }),
    ]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir), [
    { number: 1, head_ref: "f1", base_ref: "main" },
  ]);
});

test("no eligible PRs yields an empty array (resolve job is skipped)", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({ mergeable: "MERGEABLE" })]));
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir), []);
});

test("a PR reporting UNKNOWN is re-queried until it settles to CONFLICTING", () => {
  const dir = scratch();
  const unknown = join(dir, "unknown.json");
  const conflicting = join(dir, "conflicting.json");
  writeFileSync(unknown, JSON.stringify([pr({ mergeable: "UNKNOWN" })]));
  writeFileSync(conflicting, JSON.stringify([pr({})]));
  // First pass sees UNKNOWN, second sees CONFLICTING.
  fakeGh(dir, [unknown, conflicting]);
  const prs = runDiscover(dir, { maxPasses: 3 });
  assert.deepEqual(prs, [{ number: 1, head_ref: "feature", base_ref: "main" }]);
});

test("the age window drops a PR whose newest commit is stale, keeps an active one", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(
    fixture,
    JSON.stringify([
      pr({ number: 1, headRefName: "fresh" }),
      pr({ number: 2, headRefName: "stale", headRefOid: "cafe2" }),
    ]),
  );
  writeFileSync(
    join(dir, "commits-1.json"),
    JSON.stringify([{ committedDate: isoHoursAgo(1) }]),
  );
  writeFileSync(
    join(dir, "commits-2.json"),
    JSON.stringify([{ committedDate: isoHoursAgo(48) }]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir, { maxAgeHours: "24" }), [
    { number: 1, head_ref: "fresh", base_ref: "main" },
  ]);
});

test("a PR with no commit dates at all has no evidence of activity and is dropped", () => {
  // The doubt is spent on NOT resolving: an unreadable/empty commit list must
  // not read as "recently active".
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({})]));
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir, { maxAgeHours: "24" }), []);
});

test("AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS=0 disables the window", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({})]));
  writeFileSync(
    join(dir, "commits-1.json"),
    JSON.stringify([{ committedDate: isoHoursAgo(9000) }]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir, { maxAgeHours: "0" }), [
    { number: 1, head_ref: "feature", base_ref: "main" },
  ]);
});

test("a head the resolver already attempted (fresh mark) is skipped", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({})]));
  writeFileSync(
    join(dir, "statuses-cafe1.json"),
    JSON.stringify([
      { context: "auto-resolve/attempted", created_at: isoHoursAgo(1) },
    ]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir), []);
});

test("a mark older than the TTL is treated as no mark", () => {
  // Default TTL is 6h; a 7h-old mark must not suppress the head — whatever
  // that run concluded, the code that concluded it may since have been fixed.
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({})]));
  writeFileSync(
    join(dir, "statuses-cafe1.json"),
    JSON.stringify([
      { context: "auto-resolve/attempted", created_at: isoHoursAgo(7) },
    ]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir), [
    { number: 1, head_ref: "feature", base_ref: "main" },
  ]);
});

test("a released mark no longer suppresses the head", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({})]));
  writeFileSync(
    join(dir, "statuses-cafe1.json"),
    JSON.stringify([
      { context: "auto-resolve/attempted", created_at: isoHoursAgo(2) },
      {
        context: "auto-resolve/attempted-released",
        created_at: isoHoursAgo(1),
      },
    ]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir), [
    { number: 1, head_ref: "feature", base_ref: "main" },
  ]);
});

test("AUTO_RESOLVE_IGNORE_ATTEMPT_MARK=true re-emits a freshly-marked head", () => {
  const dir = scratch();
  const fixture = join(dir, "list.json");
  writeFileSync(fixture, JSON.stringify([pr({})]));
  writeFileSync(
    join(dir, "statuses-cafe1.json"),
    JSON.stringify([
      { context: "auto-resolve/attempted", created_at: isoHoursAgo(1) },
    ]),
  );
  fakeGh(dir, [fixture]);
  assert.deepEqual(runDiscover(dir, { ignoreMark: true }), [
    { number: 1, head_ref: "feature", base_ref: "main" },
  ]);
});
