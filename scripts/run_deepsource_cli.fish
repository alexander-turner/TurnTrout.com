#!/usr/bin/env fish

# Returns exit code 1 if issues found.

set -g branch_name "deepsource-analysis-"(date +%s)
set -g original_branch (git branch --show-current)
set -g pr_number ""
set -g cleanup_done 0

function cleanup_branch
    test $cleanup_done -eq 1; and return
    set -g cleanup_done 1
    test -n "$pr_number"; and gh pr close $pr_number --delete-branch >/dev/null 2>&1
    test -n "$original_branch"; and git checkout $original_branch >/dev/null 2>&1
    git branch -D $branch_name >/dev/null 2>&1
    git push origin --delete $branch_name >/dev/null 2>&1
end

function handle_interrupt --on-signal INT
    cleanup_branch
    exit 1
end

function handle_term --on-signal TERM
    cleanup_branch
    exit 1
end

function fail
    echo "Error: $argv[1]"
    cleanup_branch
    exit 1
end

git checkout -b $branch_name >/dev/null 2>&1 || exit 1
git add -A >/dev/null 2>&1
git commit -m "chore: temporary commit for DeepSource analysis" --allow-empty --no-verify >/dev/null 2>&1 || fail "Failed to commit"
git push -u origin $branch_name >/dev/null 2>&1 || fail "Failed to push"

set pr_output (gh pr create --draft --title "DeepSource Analysis (temporary)" --body "Temporary PR for DeepSource analysis. Will be auto-closed." 2>&1)
test $status -eq 0 || fail "Failed to create PR\n$pr_output"

set -g pr_number (echo $pr_output | string match -r '#(\d+)' | string replace '#' '' | head -n1)
test -z "$pr_number"; and set -g pr_number (echo $pr_output | string match -r 'pull/(\d+)' | string replace 'pull/' '' | head -n1)
test -z "$pr_number"; and fail "Could not extract PR number from output:\n$pr_output"

echo "Waiting for DeepSource analysis on PR #$pr_number... (Press Ctrl+C to cancel)"

# Wait for DeepSource checks to appear and extract URLs
set analysis_ready 0
set deepsource_urls ""
for attempt in (seq 60)
    set check_data (gh pr view $pr_number --json statusCheckRollup 2>/dev/null)
    if test $status -eq 0
        set deepsource_urls (echo $check_data | jq -r '.statusCheckRollup[] | select(.__typename == "StatusContext" and (.context | startswith("DeepSource"))) | .targetUrl' 2>/dev/null | string collect)
        if test -n "$deepsource_urls"
            set analysis_ready 1
            break
        end
    end
    sleep 5
end
test $analysis_ready -eq 0; and fail "Analysis timed out"

# Print DeepSource dashboard links
if test -n "$deepsource_urls"
    echo -e "\nDeepSource Analysis URLs:"
    echo $deepsource_urls | while read -l url
        test -n "$url"; and echo "  $url"
    end
    echo ""
end

echo -e "\n=== DeepSource Issues ==="
set issues_output (deepsource issues list 2>&1)
test $status -ne 0; and fail "Could not fetch issues\n$issues_output"

echo $issues_output

set exit_code 0
if string match -q "*Issues found*" $issues_output
    echo -e "\n✗ Issues found - see above"
    set exit_code 1
else if test -z "$issues_output"; or string match -q "*No issues*" $issues_output; or string match -q "*0 issues*" $issues_output
    echo -e "\n✓ No issues found!"
else
    echo -e "\n✗ Issues found - see above"
    set exit_code 1
end

cleanup_branch
exit $exit_code
