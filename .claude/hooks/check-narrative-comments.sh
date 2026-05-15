#!/bin/bash
# PostToolUse(Edit|Write): warn on comments narrating prior versions / regressions.
set -uo pipefail
input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[ -z "$file" ] && exit 0
case "$file" in *.md | *.mdx | *.json | *.yaml | *.yml | *.toml | *.html | *.svg | *.xml) exit 0 ;; esac
new=$(jq -r '.tool_input.new_string // .tool_input.content // empty' <<<"$input")
hits=$(grep -inE '^[[:space:]]*(//|/\*|#|\*[^/=]|<!--)' <<<"$new" |
	grep -iE '\b(previously|formerly|used to (be|do|use|have)|the old [[:alnum:]_-]+|prior (version|impl(ementation)?|behavior)|earlier (version|iteration|attempt)|regression(:| test for)|legacy (code|impl(ementation)?)|short-lived [[:alnum:]_-]+( [[:alnum:]_-]+)? fork|in the previous (version|iteration|attempt|impl(ementation)?))\b' || true)
[ -z "$hits" ] && exit 0
{
	echo "Narrative comments in $file (CLAUDE.md: comments describe current code, not history):"
	awk '{print "  "$0}' <<<"$hits"
} >&2
exit 2
