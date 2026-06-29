// Promote the `## Unreleased` block in CHANGELOG.md to a dated version section.
//
// Invoked from `.github/scripts/version-bump.sh` after a successful
// `pnpm publish`. Reads the drafted release notes from environment variables so
// commit-message content is never interpolated into a shell heredoc:
//
//   NEW_VERSION        — the semver string, e.g. "1.2.3"
//   RELEASE_DATE       — "YYYY-MM-DD" in UTC
//   CHANGELOG_SECTION  — markdown body for the new dated section
//
// Behavior:
// - Writes diagnostics to stderr, successes to stdout.
// - Unexpected errors are logged and the process still exits 0. `pnpm publish`
//   has already succeeded by this point, and a CHANGELOG failure must not abort
//   the surrounding bash script (which still needs to create and push the git
//   tag).
// - File write is atomic (temp file + rename) so a crash mid-write leaves the
//   original CHANGELOG intact.
//
// Self-contained on purpose (node builtins only): the release workflow may run
// a trusted copy of this file, which only works if it imports nothing in-repo.

import { writeFileSync, readFileSync, renameSync } from "node:fs";
import { dirname, basename, join } from "node:path";

const CHANGELOG_PATH = "CHANGELOG.md";

/**
 * @param {string} message
 */
function warn(message) {
  process.stderr.write(`CHANGELOG update: ${message}\n`);
}

/**
 * Write `contents` to `path` atomically: write a sibling temp file, then rename
 * it over the target. A crash mid-write leaves the original file intact.
 * @param {string} path
 * @param {string} contents
 */
function atomicWrite(path, contents) {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}

/**
 * @returns {{newVersion: string, releaseDate: string, section: string} | null}
 */
function readEnv() {
  const required = ["NEW_VERSION", "RELEASE_DATE", "CHANGELOG_SECTION"];
  const values = {};
  for (const name of required) {
    const value = process.env[name];
    if (!value) {
      warn(`missing required env var ${name}; skipping.`);
      return null;
    }
    values[name] = value;
  }
  return {
    newVersion: values.NEW_VERSION,
    releaseDate: values.RELEASE_DATE,
    section: values.CHANGELOG_SECTION,
  };
}

/**
 * Strip a leading "## [vX.Y.Z]" heading the model may have emitted despite
 * being told "body only", then trim trailing whitespace. Returns the empty
 * string if nothing substantive is left.
 * @param {string} raw
 * @returns {string}
 */
function normalizeBody(raw) {
  return raw.replace(/^\s*## \[[^\]]+\][^\n]*\n+/, "").trimEnd();
}

/**
 * Locate the `## Unreleased` block and return the text before it and the text
 * after it (starting at the next `## ` heading). Returns null if there is no
 * Unreleased heading.
 * @param {string} source
 * @returns {{before: string, afterBlock: string} | null}
 */
function splitAroundUnreleased(source) {
  const markerMatch = source.match(/^## Unreleased[ \t]*$/m);
  if (!markerMatch || markerMatch.index === undefined) return null;

  const blockStart = markerMatch.index + markerMatch[0].length;
  const rest = source.slice(blockStart);
  const nextHeadingOffset = rest.search(/\n## /);
  const bodyEnd =
    nextHeadingOffset === -1 ? source.length : blockStart + nextHeadingOffset;

  return {
    before: source.slice(0, markerMatch.index),
    afterBlock: source.slice(bodyEnd),
  };
}

function promoteUnreleased() {
  const env = readEnv();
  if (!env) return;

  const source = readFileSync(CHANGELOG_PATH, "utf8");
  const split = splitAroundUnreleased(source);
  if (!split) {
    warn(`no "## Unreleased" heading in ${CHANGELOG_PATH}; skipping.`);
    return;
  }

  const body = normalizeBody(env.section);
  if (!body) {
    warn("drafted changelog body is empty; skipping.");
    return;
  }

  const dated = `## [${env.newVersion}] - ${env.releaseDate}\n\n${body}\n`;
  const updated =
    `${split.before}## Unreleased\n\n${dated}` +
    split.afterBlock.replace(/^\n+/, "\n");

  atomicWrite(CHANGELOG_PATH, updated);
  process.stdout.write(
    `Promoted Unreleased → [${env.newVersion}] - ${env.releaseDate} in ${CHANGELOG_PATH}\n`,
  );
}

try {
  promoteUnreleased();
} catch (err) {
  // Exit 0 deliberately: pnpm publish has already succeeded at this point in
  // the release flow; a CHANGELOG hiccup must not abort the surrounding bash
  // script and skip the tag push.
  warn(`failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
}
