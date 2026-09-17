/** Shared I/O helpers for Claude Code hook scripts. */

import {
  closeSync,
  fstatSync,
  openSync,
  readSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Write `content` to `path` without ever following a symlink there.
 *
 * PROBLEM CLASS — a hook writing to a PREDICTABLE path in a world-writable
 * directory. Anything that can create files there can pre-place a symlink at the
 * name the hook is about to use, and an ordinary write then lands on the link's
 * target instead. Unlinking first and creating exclusively (`wx`) means the write
 * either gets a fresh file or gets nothing.
 *
 * Returns false rather than throwing, so a caller for whom the write is
 * best-effort keeps its own control flow.
 * @param {string} path @param {string} content @param {number} [mode]
 * @returns {boolean}
 */
export function writeFileNoFollow(path, content, mode = 0o600) {
  try {
    unlinkSync(path);
  } catch {
    // No existing entry (the common case), or an unremovable one — either way the
    // exclusive create below is the real guard, and its own failure is returned.
  }
  let fd;
  try {
    fd = openSync(path, "wx", mode);
  } catch {
    return false;
  }
  try {
    writeFileSync(fd, content);
    return true;
  } finally {
    closeSync(fd);
  }
}

/**
 * True when this module is the process entry point (run directly as a CLI, not
 * imported). Guards an undefined `process.argv[1]` before resolving it, and
 * normalizes a relative invocation path to an absolute file URL before comparing.
 * @param {string} importMetaUrl  the caller's `import.meta.url`
 * @returns {boolean}
 */
export function isMain(importMetaUrl) {
  return (
    Boolean(process.argv[1]) &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  );
}

/**
 * Hard cap on hook stdin. A well-formed payload is at most a few MB; 64 MiB
 * leaves headroom while refusing a runaway sender before its bytes OOM the hook.
 */
export const MAX_STDIN_BYTES = 64 * 1024 * 1024;

/**
 * Read a stream to a single Buffer, refusing to buffer past `maxBytes`.
 * @param {AsyncIterable<Buffer>} stream
 * @param {number} [maxBytes]
 * @returns {Promise<Buffer>}
 */
export async function readAllBounded(stream, maxBytes = MAX_STDIN_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maxBytes)
      throw new Error(
        `hook stdin exceeds ${maxBytes} bytes; refusing to buffer`,
      );
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * @param {number} [maxBytes]
 * @returns {Promise<any>}
 */
export async function readStdinJson(maxBytes = MAX_STDIN_BYTES) {
  return JSON.parse((await readAllBounded(process.stdin, maxBytes)).toString());
}

/**
 * Dynamic-import `specifier`, yielding `{}` when the module cannot be loaded.
 * Hooks bind their npm packages through this instead of a bare static import: a
 * static import resolves before any try/catch, so a missing node_modules (a
 * fresh clone, or a cold start before session-setup's `pnpm install` finishes)
 * would crash the hook at load — the harness treats that as a non-blocking error
 * and the tool call proceeds UNGUARDED. Destructuring from the `{}` failure value
 * leaves each binding undefined, so the first use throws into the hook's own
 * catch and the hook takes its declared failure posture instead.
 * @param {string} specifier
 * @returns {Promise<Record<string, any>>}
 */
export async function lazyImport(specifier) {
  try {
    return await import(specifier);
  } catch {
    return {};
  }
}

/**
 * Message from a caught value (which is `unknown` under strict mode), appending
 * a one-level cause chain when the cause is itself an Error.
 * @param {unknown} err
 * @returns {string}
 */
export function errMessage(err) {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? `: ${err.cause.message}` : "";
  return err.message + cause;
}

/**
 * Bound on how much transcript a hook reads per invocation. A transcript grows
 * for the life of a session, so a whole-file read makes every event slower and
 * can outlive the hook's timeout in exactly the long sessions the hook is for.
 */
export const TRANSCRIPT_TAIL_BYTES = 8 * 1024 * 1024;

/**
 * Last `maxBytes` of the file at `path`, trimmed to whole JSONL lines (the
 * leading partial line after a mid-file start is dropped).
 * @param {string} path
 * @param {number} [maxBytes]
 * @returns {string}
 */
export function readTranscriptTail(path, maxBytes = TRANSCRIPT_TAIL_BYTES) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString("utf8");
    if (start === 0) return text;
    const nl = text.indexOf("\n");
    return nl === -1 ? "" : text.slice(nl + 1);
  } finally {
    closeSync(fd);
  }
}

/**
 * The state file a hook keeps for one session, or null when the session id is not
 * already a safe filename. The file sits in a shared `$TMPDIR`, so the id is a path
 * segment here and is validated rather than rewritten: a rewrite is many-to-one, so
 * two sessions could share one file and one session's state would drive the other's.
 * @param {unknown} sessionId
 * @param {string} dir
 * @param {string} suffix the file extension, `.segment` or `.json`
 * @returns {string|null}
 */
export function sessionStatePath(sessionId, dir, suffix) {
  if (typeof sessionId !== "string" || !/^[\w-]+$/.test(sessionId)) return null;
  return join(dir, `${sessionId}${suffix}`);
}
