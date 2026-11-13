import { opensPullRequest } from "./lib-shell-intent.mjs";
/**
 * PreToolUse reminder: opening a pull request requires the `pr-creation` skill to
 * have been invoked in this session.
 *
 * Covers both routes an agent actually reaches for: the `gh pr create` CLI and any
 * MCP `create_pull_request` tool, whatever server it is mounted under. Locking one of
 * two equivalent doors just routes the agent through the other, which is what a
 * Bash-only matcher did in a web session where the MCP tool is the default route.
 *
 * A REMINDER, not a containment boundary — which is what bounds its scope. It checks
 * that the Skill tool was called, not that the compress-critique-fix loop ran, and it
 * covers only the routes `opensPullRequest` names. The deny text claims only those.
 */
import { createSkillGate } from "./lib-skill-gate.mjs";

/** The skill whose invocation this reminder requires. */
export const REQUIRED_SKILL = "pr-creation";

/**
 * The deny text. It names the step to take and nothing else: a message that also
 * names a way around the gate hands a workaround to the agent it just blocked.
 * @param {string} toolName @returns {string}
 */
export function denyReason(toolName) {
  return (
    `Opening a PR requires the \`${REQUIRED_SKILL}\` skill, not invoked in this ` +
    `session (blocked: ${toolName}). Call the Skill tool with ` +
    `skill="${REQUIRED_SKILL}", follow it — above all the compress-critique-fix ` +
    `loop over the diff and the PR body, which is the point of the gate — then ` +
    `retry this exact call. It will be allowed.`
  );
}

/**
 * A deny reason for this payload, or null to pass.
 * @type {(payload: any) => string|null}
 */
export const judgePrSkill = createSkillGate({
  skill: REQUIRED_SKILL,
  triggered: opensPullRequest,
  reason: denyReason,
});
