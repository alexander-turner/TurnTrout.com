#!/usr/bin/env fish

set -l GIT_ROOT (git rev-parse --show-toplevel)
set -l DEFAULT_CSS_FILE "$GIT_ROOT/public/index.css"

argparse --name "check-css-vars" --max-args 1 -- $argv
or return

set -l css_file
if test -n "$argv"
    set css_file $argv[1]
else
    set css_file $DEFAULT_CSS_FILE
end

set -l IGNORE_PATTERNS 'shiki|problems|public/index.css'

# Run stylelint, filter output (ignoring patterns and empty/whitespace lines),
# and capture potential errors
set -l warnings_found (pnpm exec stylelint "$css_file" \
            --config "$GIT_ROOT/config/stylelint/.variables-only-stylelintrc.json" \
            &| grep -vE $IGNORE_PATTERNS \
            | grep .)

if test -n "$warnings_found"
    echo "Error: Found unknown CSS variable(s):"

    set -l formatted_errors (pnpm exec stylelint "$css_file" \
            --config "$GIT_ROOT/config/stylelint/.variables-only-stylelintrc.json" \
            &| grep -vE $IGNORE_PATTERNS)
    echo "$formatted_errors"
    exit 1
end