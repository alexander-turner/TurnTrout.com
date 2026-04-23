#!/usr/bin/env bash
set -euo pipefail

errors=0

error() {
  echo "ERROR: $1"
  errors=$((errors + 1))
}

echo "Validating configuration consistency..."
echo ""

# 1. All hook scripts referenced in .claude/settings.json exist on disk
echo "Checking Claude hook script paths..."
if [ -f .claude/settings.json ]; then
  commands=$(jq -r '.. | objects | select(.command?) | .command' .claude/settings.json 2>/dev/null || true)
  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue
    resolved=$(echo "$cmd" | sed 's|"\$CLAUDE_PROJECT_DIR"/\?|./|g; s|"||g; s|\$CLAUDE_PROJECT_DIR/\?|./|g')
    read -ra tokens <<<"$resolved"
    for token in "${tokens[@]}"; do
      case "$token" in
      ./.claude/hooks/* | ./.hooks/*)
        if [ ! -f "$token" ]; then
          error "Hook script missing: $token"
        fi
        ;;
      esac
    done
  done <<<"$commands"
else
  error ".claude/settings.json not found"
fi

# 2. All files in .hooks/ are executable
echo "Checking hook script permissions..."
for f in .hooks/*; do
  [ -f "$f" ] || continue
  if [ ! -x "$f" ]; then
    error "$f is not executable"
  fi
done

# 3. Workflow names in comment-on-failed-checks.yaml match sibling workflow name: fields
echo "Checking workflow name consistency..."
if [ -f .github/workflows/comment-on-failed-checks.yaml ]; then
  # Extract workflow names, stripping inline YAML comments (e.g. - "Name" # path)
  wf_names=$(sed -n '/workflows:/,/types:/{/^[[:space:]]*- /{ /^[[:space:]]*#/!{ s/^[[:space:]]*-[[:space:]]*//; s/"[[:space:]]*#.*$/"/; s/'"'"'[[:space:]]*#.*$/'"'"'/; s/^"//; s/"$//; s/'"'"'//g; p; }}}' .github/workflows/comment-on-failed-checks.yaml)
  while IFS= read -r wf_name; do
    [ -z "$wf_name" ] && continue
    found=false
    for wf_file in .github/workflows/*.yaml .github/workflows/*.yml; do
      [ -f "$wf_file" ] || continue
      file_name=$(grep -m1 '^name:' "$wf_file" 2>/dev/null | sed 's/^name:[[:space:]]*//; s/^"//; s/"$//; s/'"'"'//g' || true)
      if [ "$file_name" = "$wf_name" ]; then
        found=true
        break
      fi
    done
    if [ "$found" != true ]; then
      error "Workflow '$wf_name' listed in comment-on-failed-checks.yaml but not found in any workflow file"
    fi
  done <<<"$wf_names"
fi

# Summary
echo ""
if [ "$errors" -gt 0 ]; then
  echo "Validation failed with $errors error(s)"
  exit 1
else
  echo "All checks passed"
fi
