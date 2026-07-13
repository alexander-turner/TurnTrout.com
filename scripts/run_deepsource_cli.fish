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

function handle_interrupt
    cleanup_branch
    exit 1
end

trap handle_interrupt INT TERM

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

# Wait for DeepSource checks to complete
set analysis_complete 0
set deepsource_data ""
for attempt in (seq 60)
    set check_data (gh pr view $pr_number --json statusCheckRollup 2>/dev/null)
    if test $status -eq 0
        # Check if DeepSource checks exist and are completed (not PENDING)
        set pending_count (echo $check_data | jq '[.statusCheckRollup[] | select(.__typename == "StatusContext" and (.context | startswith("DeepSource")) and .state == "PENDING")] | length' 2>/dev/null)
        set completed_count (echo $check_data | jq '[.statusCheckRollup[] | select(.__typename == "StatusContext" and (.context | startswith("DeepSource")) and .state != "PENDING")] | length' 2>/dev/null)
        
        if test "$completed_count" -gt 0 -a "$pending_count" -eq 0
            set deepsource_data $check_data
            set analysis_complete 1
            break
        else if test "$completed_count" -gt 0 -o "$pending_count" -gt 0
            echo -n "."  # Show progress
        end
    end
    sleep 5
end
echo ""  # New line after progress dots

test $analysis_complete -eq 0; and fail "Analysis timed out or did not complete"

echo -e "\n=== DeepSource Analysis Results ==="

# Parse and display results from each analyzer
set has_issues 0
echo $deepsource_data | jq -r '.statusCheckRollup[] | select(.__typename == "StatusContext" and (.context | startswith("DeepSource"))) | "\(.context)|\(.state)|\(.targetUrl)"' 2>/dev/null | while read -l line
    set parts (string split '|' $line)
    set analyzer $parts[1]
    set state $parts[2]
    set url $parts[3]
    
    echo "$analyzer: $state"
    echo "  $url"
    
    if test "$state" = "FAILURE"
        set has_issues 1
    end
end

set exit_code 0
if test $has_issues -eq 1
    echo -e "\n✗ Issues found - see URLs above for details"
    set exit_code 1
else
    echo -e "\n✓ No issues found!"
end

cleanup_branch
exit $exit_code
