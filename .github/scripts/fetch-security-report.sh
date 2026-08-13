#!/usr/bin/env bash
# Collect open security alerts (Dependabot, code scanning, secret scanning,
# pnpm audit, Socket.dev) into a single Markdown report. Writes the report to
# $REPORT_PATH and exports SECURITY_REPORT (first 50KB) to $GITHUB_ENV.
#
# turntrout.com is a statically generated site with no server runtime, so this
# repo's Dependabot Alerts section splits on the alert's `dependency.scope`
# (GitHub's own runtime/development classification): "Runtime" packages end up
# in the built output and reach visitors' browsers, while "Development"
# packages only ever execute in the build/CI environment. Server-side
# vulnerability classes (SQLi, auth bypass, session hijacking, etc.) can't be
# exploited in either case since there's no server — the triage prompt applies
# that judgment. Both groups are still reported: a "Development"-scope RCE or
# malicious-package alert is a real supply-chain risk to the CI pipeline, so
# scope alone must not silently drop alerts.
#
# Inputs (env):
#   GH_TOKEN       GitHub token (Dependabot/secret APIs require security_events scope)
#   REPO           owner/repo
#   GITHUB_ENV     Path to GitHub Actions env file (optional outside CI)
#   REPORT_PATH    Output report file (default: /tmp/security-report.md)

# --jq arguments are literal jq expressions; $-tokens in jq strings (e.g.
# `\(.number)`) are intentional and shouldn't be shell-expanded.
# shellcheck disable=SC2016

set -uo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set}"
: "${REPO:?REPO must be set (owner/repo)}"
GITHUB_ENV="${GITHUB_ENV:-/dev/null}"
REPORT_PATH="${REPORT_PATH:-/tmp/security-report.md}"

# Append a section heading + `gh api` result to the report. Passes $REPO into
# jq via `--arg repo` (not string interpolation) to keep jq parsing safe even
# if the repo name later contains special characters.
# echo-fallback-ok: this is a best-effort, per-section aggregator — one alert
# source failing must not abort the whole report. The fallback text names the
# failure explicitly ("could not fetch ... check repo permissions") rather than
# rendering as clean/empty data, and the report's only consumer (a human or the
# downstream Claude triage step) already reads that placeholder as "no signal
# available", never as "no alerts exist".
gh_api_section() {
  local heading="$1" endpoint="$2" jq_expr="$3" fallback="$4"
  {
    echo ""
    echo "$heading"
  } >>"$REPORT_PATH"
  # echo-fallback-ok: best-effort aggregator, see the function-level comment above.
  gh api "$endpoint" --arg repo "$REPO" --jq "$jq_expr" \
    >>"$REPORT_PATH" 2>&1 || echo "$fallback" >>"$REPORT_PATH"
}

echo "## Dependabot Alerts" >"$REPORT_PATH"
dependabot_tmp=$(mktemp)
# echo-fallback-ok: same best-effort-section reasoning as gh_api_section above.
if gh api "repos/${REPO}/dependabot/alerts?state=open&per_page=100" \
  --arg repo "$REPO" \
  --jq '.[] | "\(.dependency.scope // "unclassified")\t- **\(.security_advisory.severity | ascii_upcase)**: [\(.security_advisory.summary)](https://github.com/\($repo)/security/dependabot/\(.number)) in `\(.dependency.package.name)` (\(.dependency.package.ecosystem))"' \
  >"$dependabot_tmp" 2>&1; then
  {
    echo ""
    echo "### Runtime (ships to visitors' browsers)"
    grep '^runtime' "$dependabot_tmp" | cut -f2- || echo "_None._"
    echo ""
    echo "### Development (build/CI only — no visitor-facing exposure, but still a supply-chain risk if RCE/malicious-package)"
    grep '^development' "$dependabot_tmp" | cut -f2- || echo "_None._"
    echo ""
    echo "### Unclassified (GitHub didn't report a scope — verify manually before assuming build-only)"
    grep -v -e '^runtime' -e '^development' "$dependabot_tmp" | cut -f2- || echo "_None._"
  } >>"$REPORT_PATH"
else
  cat "$dependabot_tmp" >>"$REPORT_PATH"
  echo "_Could not fetch Dependabot alerts (check repo permissions)._" >>"$REPORT_PATH"
fi

gh_api_section \
  "## Code Scanning Alerts" \
  "repos/${REPO}/code-scanning/alerts?state=open&per_page=100" \
  '.[] | "- **\(.rule.severity // .rule.security_severity_level | ascii_upcase)**: [\(.rule.description)](https://github.com/\($repo)/security/code-scanning/\(.number)) at `\(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)`"' \
  "_No code scanning alerts or code scanning not enabled._"

gh_api_section \
  "## Secret Scanning Alerts" \
  "repos/${REPO}/secret-scanning/alerts?state=open&per_page=100" \
  '.[] | "- **\(.state | ascii_upcase)**: \(.secret_type_display_name) — [Alert #\(.number)](https://github.com/\($repo)/security/secret-scanning/\(.number))"' \
  "_No secret scanning alerts or secret scanning not enabled._"

{
  echo ""
  echo "## pnpm audit"
} >>"$REPORT_PATH"
# Skip when there's no Node project — setup-base-env leaves pnpm uninstalled
# in that case, and `pnpm audit` would error out instead of returning "clean".
if [[ -f package.json ]]; then
  pnpm audit 2>&1 | head -100 >>"$REPORT_PATH"
  pnpm_rc=${PIPESTATUS[0]}
  # Exit 0 = clean, exit 1 = vulnerabilities found (expected); higher = real error
  [[ "${pnpm_rc:-0}" -le 1 ]] || echo "_pnpm audit encountered an error (exit code $pnpm_rc); output above may be incomplete._" >>"$REPORT_PATH"
else
  echo "_Skipped: no package.json (not a Node project)._" >>"$REPORT_PATH"
fi

{
  echo ""
  echo "## Socket.dev Alerts"
} >>"$REPORT_PATH"

# Bot username is "socket-security[bot]" (as of 2025); if Socket changes
# their bot name this will silently return no results.
socket_found=false
socket_tmp=$(mktemp)
pr_list_tmp=$(mktemp)
pr_list_err=$(mktemp)
trap 'rm -f "$dependabot_tmp" "$socket_tmp" "$pr_list_tmp" "$pr_list_err"' EXIT

# Branch on the PR-list fetch's exit code rather than discarding its stderr: a
# failed fetch (permissions/transient API error) must report "could not fetch"
# instead of yielding an empty list that reads as a clean "no alerts found".
if gh api "repos/${REPO}/pulls?state=open&per_page=5" --jq '.[].number' \
  >"$pr_list_tmp" 2>"$pr_list_err"; then
  while IFS= read -r pr_num; do
    [[ -n "$pr_num" ]] || continue
    # Fetch once into a temp file; avoids a second API call and command
    # substitution (which strips trailing newlines and merges multi-comment output).
    if ! gh api "repos/${REPO}/issues/${pr_num}/comments?per_page=30" \
      --jq '.[] | select(.user.login == "socket-security[bot]") | .body' \
      >"$socket_tmp" 2>/dev/null; then
      # Tolerate a single PR's comment fetch failing (permissions/transient API
      # error) — it must not abort the whole security report. Reset to empty so a
      # prior iteration's content can't leak into this PR's section.
      : >"$socket_tmp"
    fi
    if [[ -s "$socket_tmp" ]]; then
      socket_found=true
      {
        echo "### PR #${pr_num}"
        cat "$socket_tmp"
        echo ""
      } >>"$REPORT_PATH"
    fi
  done <"$pr_list_tmp"
  if [[ "$socket_found" = "false" ]]; then
    echo "_No Socket.dev alerts found in recent open PRs._" >>"$REPORT_PATH"
  fi
else
  echo "_Could not fetch open PRs for Socket.dev scan (check repo permissions)._" >>"$REPORT_PATH"
fi

cat "$REPORT_PATH"

# Use a random sentinel to prevent delimiter injection — report content comes
# from external sources (advisory descriptions, bot comments) that an attacker
# could craft to contain a static sentinel and inject arbitrary env vars.
if [[ -r /proc/sys/kernel/random/uuid ]]; then
  report_sentinel="REPORT_EOF_$(cat /proc/sys/kernel/random/uuid)"
elif command -v uuidgen >/dev/null 2>&1; then
  report_sentinel="REPORT_EOF_$(uuidgen)"
else
  report_sentinel="REPORT_EOF_$$_${RANDOM}_${RANDOM}"
fi
report_size=$(wc -c <"$REPORT_PATH" | tr -d '[:space:]')
if [[ "$report_size" -gt 50000 ]]; then
  echo "::warning::Security report is ${report_size} bytes; truncating to 50 KB for \$GITHUB_ENV. Full report is at $REPORT_PATH on the runner."
fi
{
  echo "SECURITY_REPORT<<${report_sentinel}"
  head -c 50000 "$REPORT_PATH"
  echo ""
  echo "${report_sentinel}"
} >>"$GITHUB_ENV"
