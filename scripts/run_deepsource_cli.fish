#!/usr/bin/env fish

# Push to throwaway branch, create PR for DeepSource analysis, wait for completion, list issues, cleanup.
# Returns exit code 1 if issues found.

set -g branch_name "deepsource-analysis-"(date +%s)
set -g original_branch (git branch --show-current)
set -g pr_number ""
set -g cleanup_done 0

function cleanup_branch
    test $cleanup_done -eq 1; and return
    set -g cleanup_done 1
    echo -e "\nCleaning up..."
    test -n "$pr_number"; and gh pr close $pr_number --delete-branch 2>/dev/null
    test -n "$original_branch"; and git checkout $original_branch 2>/dev/null
    git branch -D $branch_name 2>/dev/null
    git push origin --delete $branch_name 2>/dev/null
    echo "Cleanup complete"
end

function handle_interrupt --on-signal INT; cleanup_branch; exit 130; end
function handle_term --on-signal TERM; cleanup_branch; exit 143; end

echo "Creating throwaway branch: $branch_name"
git checkout -b $branch_name; or exit 1

echo "Staging and committing changes..."
git add -A
git commit -m "chore: temporary commit for DeepSource analysis" --allow-empty; or begin; cleanup_branch; exit 1; end

echo "Pushing to remote..."
git push -u origin $branch_name; or begin; cleanup_branch; exit 1; end

echo "Creating draft PR..."
set pr_output (gh pr create --draft --title "DeepSource Analysis (temporary)" --body "Temporary PR for DeepSource analysis. Will be auto-closed." 2>&1)
test $status -eq 0; or begin; echo "Error: Failed to create PR\n$pr_output"; cleanup_branch; exit 1; end

set -g pr_number (echo $pr_output | string match -r '#(\d+)' | string replace '#' '')
test -z "$pr_number"; and set -g pr_number (echo $pr_output | string match -r 'pull/(\d+)' | string replace 'pull/' '')
echo "Created PR #$pr_number"

echo "Waiting for DeepSource analysis... (Press Ctrl+C to cancel)"
for attempt in (seq 60)
    # deepsource issues list works on the current branch
    deepsource issues list >/dev/null 2>&1; and break
    echo "Waiting... (attempt $attempt/60)"
    sleep 5
end

test $attempt -eq 60; and begin; echo "Error: Analysis timed out"; cleanup_branch; exit 1; end
echo "DeepSource analysis complete!"

echo -e "\n=== DeepSource Issues ==="
set issues_output (deepsource issues list 2>&1)
test $status -ne 0; and begin; echo "Error: Could not fetch issues\n$issues_output"; cleanup_branch; exit 1; end

echo $issues_output
set exit_code 0
if test -z "$issues_output"; or string match -q "*No issues*" $issues_output; or string match -q "*0 issues*" $issues_output
    echo -e "\n✓ No issues found!"
else
    echo -e "\n✗ Issues found - see above"
    set exit_code 1
end

cleanup_branch
exit $exit_code
