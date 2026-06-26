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

# Invoke the stylelint binary directly rather than via `pnpm exec`: pnpm 11's
# deps-status check can recreate node_modules and print install chatter that
# the capture below would mistake for stylelint warnings.
set -l STYLELINT "$GIT_ROOT/node_modules/.bin/stylelint"

# Run stylelint, filter output (ignoring patterns and empty/whitespace lines),
# and capture potential errors
set -l warnings_found ($STYLELINT "$css_file" \
            --config "$GIT_ROOT/config/stylelint/.variables-only-stylelintrc.json" \
            &| command grep -vE $IGNORE_PATTERNS \
            | command grep .)

if test -n "$warnings_found"
    echo "Error: Found unknown CSS variable(s):"

    set -l formatted_errors ($STYLELINT "$css_file" \
            --config "$GIT_ROOT/config/stylelint/.variables-only-stylelintrc.json" \
            &| command grep -vE $IGNORE_PATTERNS)
    echo "$formatted_errors"
    exit 1
end