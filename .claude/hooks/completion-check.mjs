#!/usr/bin/env node
/**
 * Stop: once this session has pushed, ask ONCE whether ALL the requested work is
 * finished, and block the stop until it answers. The check ARMS on whichever comes
 * first: a moment drawn uniformly from the window after the first push, or the
 * k-th stop that has something to certify after that push, k drawn uniformly from
 * 1 to ARMING_STOPS_MAX. Neither is predictable, and the stop count reaches a
 * session that pushes and quits inside the window. Before arming, and in a session
 * that never pushes, the stop is allowed silently.
 *
 * The push is RECORDED, never parsed: `.claude/settings.json` runs this file with
 * `--record-push` on PreToolUse under the `Bash(git push:*)` matcher, the same
 * matcher pre-push-check.sh trusts, so Claude Code decides what a push is and no
 * shell text is read here. The pings are bounded (default 3, `COMPLETION_CHECK_MAX`)
 * and the check is one-shot, so a session can never be trapped; `COMPLETION_CHECK=0`
 * disables it. An armed stop with nothing to certify — a turn that called no tool,
 * or whose only tool calls were empty `ReadNotifications` polls — is allowed WITHOUT
 * spending the one shot. Advisory posture: malformed events and state failures allow
 * the stop. Dependency-free on purpose: the template ships no node_modules.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isMain,
  readStdinJson,
  readTranscriptTail,
  sessionStatePath,
  writeFileNoFollow,
} from "./lib-hook-io.mjs";

/** The answer that ends the check. */
export const AFFIRMATION = "Yes.";

/**
 * What the agent leads with instead when work remains, so the operator can count
 * how often this check caught real unfinished work. Count only assistant replies
 * whose FIRST line is the marker: the literal also sits in this file, in its test,
 * and inside the question text itself.
 */
export const RESUMPTION = "**Resuming work**";

/** Times the question is asked before the stop is allowed. */
export const DEFAULT_MAX_PINGS = 3;

/** Width of the window after the first push that the arming moment is drawn from. */
export const PUSH_WINDOW_MS = 5 * 60 * 1000;

/** Largest k the arming stop count is drawn from, so the check arms within k stops. */
export const ARMING_STOPS_MAX = 3;

/**
 * Whether this reply answers the question. The answer must be the LAST non-empty
 * line, so the word inside a report ("Yes. the tests pass, but …") does not end the
 * check. Emphasis, backticks, case and the period are all ignored, so a cosmetic
 * difference cannot trap a session that did answer.
 * @param {string} text
 * @returns {boolean}
 */
export function isAffirmative(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const normalize = (/** @type {string} */ value) =>
    value.replace(/[`*_\s.]/g, "").toLowerCase();
  return normalize(lines.at(-1) ?? "") === normalize(AFFIRMATION);
}

/**
 * The question fed back to the agent when the stop is blocked.
 * @param {number} ping 1-based number of this ping
 * @param {number} max total pings allowed
 * @returns {string}
 */
export function question(ping, max) {
  return (
    `Completion check ${ping} of ${max}. Are you done with ALL work?\n\n` +
    "Re-read the original request and check every part of it, including any " +
    "work you named but left undone, and any fix your own diagnosis implies " +
    `(CLAUDE.md → Autonomy). If work remains, reply \`${RESUMPTION}\` as your ` +
    "first line and do it now — do not ask me anything and do not report back " +
    "until it is done.\n\n" +
    `If, and only if, everything is complete, reply with exactly \`${AFFIRMATION}\` ` +
    "as the last line of your reply. That ends this check. Do not answer " +
    `\`${AFFIRMATION}\` while work remains.`
  );
}

/**
 * @typedef {{type?: unknown, text?: unknown, id?: unknown, name?: unknown,
 *   tool_use_id?: unknown, content?: unknown}} TranscriptPart
 */

/** The exact empty-poll result text `ReadNotifications` returns. */
const EMPTY_POLL_RESULT = "No queued notifications.";

/** The tool whose empty result carries no signal — see the header comment. */
const EMPTY_POLL_TOOL = "ReadNotifications";

const isToolResult = (/** @type {TranscriptPart} */ part) =>
  part?.type === "tool_result";

/**
 * Text of a tool_result part, whether its `content` is a plain string or a block
 * array.
 * @param {TranscriptPart} part
 * @returns {string}
 */
function toolResultText(part) {
  const { content } = part;
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .flatMap((block) => (typeof block?.text === "string" ? [block.text] : []))
      .join("\n");
  return "";
}

/**
 * The turn that just ended, read backwards from the end of the JSONL transcript
 * and stopped at the user prompt that opened it: the last assistant text ("" when
 * the turn produced none) and whether the turn called a tool worth certifying. A
 * tool result is itself a user-role entry, so only an entry with no `tool_result`
 * part counts as the prompt that opened the turn. Subagent (sidechain) lines and
 * unparsable lines are skipped: neither is a reason to hold the session open.
 * @param {string} transcript raw JSONL
 * @returns {{reply: string, usedTools: boolean}}
 */
export function readTurn(transcript) {
  let reply = null;
  /** @type {{id: unknown, name: unknown}[]} */
  const toolUses = [];
  /** @type {Map<unknown, string>} */
  const toolResults = new Map();
  for (const line of transcript.split("\n").reverse()) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    // A subagent's lines carry the parent's session and would read as the main
    // thread's turn boundary, tool calls and reply.
    if (entry?.isSidechain === true) continue;
    const message = entry?.message;
    const parts = /** @type {TranscriptPart[]} */ (
      Array.isArray(message?.content) ? message.content : []
    );
    if (message?.role !== "assistant") {
      if (message?.role !== "user") continue;
      for (const part of parts)
        if (isToolResult(part))
          toolResults.set(part.tool_use_id, toolResultText(part));
      if (!parts.some(isToolResult)) break;
      continue;
    }
    for (const part of parts)
      if (part?.type === "tool_use")
        toolUses.push({ id: part.id, name: part.name });
    const text = parts
      .flatMap((part) =>
        part?.type === "text" && typeof part.text === "string"
          ? [part.text]
          : [],
      )
      .join("\n")
      .trim();
    if (reply === null && text !== "") reply = text;
  }
  // Each tool_use is matched to its tool_result by id, because the result text is
  // what decides an empty poll. A poll that finds something still counts.
  const usedTools = toolUses.some((use) => {
    if (use.name !== EMPTY_POLL_TOOL) return true;
    return toolResults.get(use.id)?.trim() !== EMPTY_POLL_RESULT;
  });
  return { reply: reply ?? "", usedTools };
}

/**
 * @typedef {{pushedAt: number|null, deadlineMs: number|null,
 *   stopsLeft: number, pings: number, done: boolean}} CheckState
 */

/** The state a session starts from: no push yet, so nothing to arm on. */
const FRESH = Object.freeze({
  pushedAt: null,
  deadlineMs: null,
  stopsLeft: 0,
  pings: 0,
  done: false,
});

/**
 * This session's state file, or null when the session id is not a safe filename.
 * @param {unknown} sessionId
 * @param {string} dir
 * @returns {string|null}
 */
export function statePath(sessionId, dir) {
  return sessionStatePath(sessionId, dir, ".json");
}

/**
 * The state in `path`, or the fresh state when the file is absent or unreadable —
 * an absent file is the normal first-event case, and a lost one costs at most a
 * redrawn arming moment. A number that fails to parse reads as its fresh value, so
 * a damaged record arms at this stop: arming early is the safe direction for a
 * check that only asks a question.
 * @param {string} path
 * @returns {CheckState}
 */
export function readState(path) {
  let saved;
  try {
    saved = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { ...FRESH };
  }
  const number = (/** @type {unknown} */ value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    pushedAt: number(saved?.pushedAt),
    deadlineMs: number(saved?.deadlineMs),
    stopsLeft: number(saved?.stopsLeft) ?? 0,
    pings: number(saved?.pings) ?? 0,
    done: saved?.done === true,
  };
}

/**
 * @param {string} path
 * @param {CheckState} state
 * @returns {boolean} whether `state` reached `path`. A blocked stop is only safe
 *   while the count advances, so every caller allows the stop when this fails.
 */
function save(path, state) {
  try {
    mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  } catch {
    return false;
  }
  return writeFileNoFollow(path, JSON.stringify(state));
}

/**
 * The PreToolUse arm: record when this session first ran a push. The matcher in
 * settings.json is what decided the command IS a push; this only stamps the time.
 * Later pushes leave the first stamp alone, so the arming window opens once.
 * @param {string} path the session's state file
 * @param {number} now epoch milliseconds
 * @returns {boolean} whether a first push was recorded by this call
 */
export function recordPush(path, now) {
  const state = readState(path);
  if (state.pushedAt !== null) return false;
  return save(path, { ...state, pushedAt: now });
}

/**
 * One Stop event: the response that blocks it with the question, or null to allow
 * it. The arming draw is taken once, from the recorded push, and persists — so a
 * redraw on every event cannot keep it out of reach. Only an affirmation or a spent
 * ping budget ends the check; a stop allowed for any other reason leaves it armed.
 * @param {{session_id?: unknown, transcript_path?: unknown}} payload the Stop payload
 * @param {{stateDir?: string, maxPings?: number, now?: () => number,
 *   random?: () => number}} [options] test overrides
 * @returns {{decision: string, reason: string}|null}
 */
export function run(payload, options = {}) {
  if (process.env.COMPLETION_CHECK === "0") return null;
  const dir =
    options.stateDir ??
    process.env.COMPLETION_CHECK_STATE_DIR ??
    join(tmpdir(), "claude-completion-check");
  const path = statePath(payload?.session_id, dir);
  const transcript = payload?.transcript_path;
  if (path === null || typeof transcript !== "string") return null;
  const envMax = Number(process.env.COMPLETION_CHECK_MAX);
  // Only a finite positive integer bounds the pings; `Infinity` would never end them.
  const max =
    options.maxPings ??
    (Number.isInteger(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_PINGS);
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;

  const state = readState(path);
  if (state.done || state.pushedAt === null) return null;
  // The draw is stored on first use, so every later Stop reads the same moment.
  const deadlineMs =
    state.deadlineMs ?? state.pushedAt + Math.floor(random() * PUSH_WINDOW_MS);
  const stopsLeft =
    state.deadlineMs === null
      ? 1 + Math.floor(random() * ARMING_STOPS_MAX)
      : state.stopsLeft;
  const armed = { ...state, deadlineMs, stopsLeft };

  const { reply, usedTools } = readTurn(readTranscriptTail(transcript));
  if (state.pings === 0) {
    // Nothing to certify neither counts toward the arming stop nor spends the one
    // shot: the question is still owed on the next turn that does work.
    if (!usedTools || reply === "") {
      save(path, armed);
      return null;
    }
    if (now() < deadlineMs && stopsLeft > 1) {
      save(path, { ...armed, stopsLeft: stopsLeft - 1 });
      return null;
    }
  } else if (isAffirmative(reply)) {
    // A question is outstanding, so the reply answers IT — with or without a tool
    // call. Before the first ping the reply answers the USER, so a turn that merely
    // ends in "Yes." must not spend the one shot on a question never asked.
    save(path, { ...armed, done: true });
    return null;
  }
  const ping = state.pings + 1;
  if (ping > max) {
    save(path, { ...armed, done: true });
    return null;
  }
  return save(path, { ...armed, pings: ping })
    ? { decision: "block", reason: question(ping, max) }
    : null;
}

if (isMain(import.meta.url)) {
  try {
    const raw = await readStdinJson();
    const payload =
      typeof raw === "object" && raw !== null
        ? /** @type {{session_id?: unknown, transcript_path?: unknown}} */ (raw)
        : {};
    if (process.argv.includes("--record-push")) {
      const dir =
        process.env.COMPLETION_CHECK_STATE_DIR ??
        join(tmpdir(), "claude-completion-check");
      const path = statePath(payload.session_id, dir);
      if (path !== null) recordPush(path, Date.now());
    } else {
      const response = run(payload);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  } catch {
    // Fail open: a malformed payload or an unwritable state directory allows the
    // stop, so this hook can never hold a session open on its own defect.
  }
}
