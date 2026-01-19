#!/usr/bin/env fish

# Script to push current changes to a throwaway git branch, create a PR for DeepSource analysis,
# wait for completion, list issues, cleanup the PR and branch.
# Returns exit code 1 if there are any issues found.

set -g branch_name "deepsource-analysis-"(date +%s)
set -g original_branch (git branch --show-current)
set -g exit_code 0
set -g cleanup_done 0
set -g pr_number ""

# Cleanup function to delete the throwaway branch and PR
function cleanup_branch
    if test $cleanup_done -eq 1
        return
    end
    set -g cleanup_done 1
    
    echo ""
    echo "Cleaning up..."
    
    # Close and delete PR if it was created
    if test -n "$pr_number"
        echo "Closing PR #$pr_number"
        gh pr close $pr_number --delete-branch 2>/dev/null
    end
    
    # Switch back to original branch
    if test "$original_branch" != ""
        git checkout $original_branch 2>/dev/null
    end
    
    # Delete local branch if it still exists
    git branch -D $branch_name 2>/dev/null
    
    # Delete remote branch if it still exists
    git push origin --delete $branch_name 2>/dev/null
    
    echo "Cleanup complete"
end

# Set up signal handlers for fish
function handle_interrupt --on-signal INT
    cleanup_branch
    exit 130
end

function handle_term --on-signal TERM
    cleanup_branch
    exit 143
end

echo "Creating throwaway branch: $branch_name"

# Create and checkout new branch
if not git checkout -b $branch_name
    echo "Error: Failed to create branch"
    exit 1
end

# Stage all changes
echo "Staging all changes..."
git add -A

# Commit changes
echo "Committing changes..."
if not git commit -m "chore: temporary commit for DeepSource analysis" --allow-empty
    echo "Error: Failed to commit changes"
    cleanup_branch
    exit 1
end

# Push to remote
echo "Pushing to remote..."
if not git push -u origin $branch_name
    echo "Error: Failed to push to remote"
    cleanup_branch
    exit 1
end

# Create a draft PR to trigger DeepSource analysis
echo "Creating draft PR to trigger DeepSource analysis..."
set pr_output (gh pr create --draft --title "DeepSource Analysis (temporary)" --body "Temporary PR for DeepSource analysis. Will be auto-closed." 2>&1)

if test $status -ne 0
    echo "Error: Failed to create PR"
    echo $pr_output
    cleanup_branch
    exit 1
end

# Extract PR number from output
set -g pr_number (echo $pr_output | string match -r '#(\d+)' | string replace '#' '')
if test -z "$pr_number"
    # Try alternative extraction
    set -g pr_number (echo $pr_output | string match -r 'pull/(\d+)' | string replace 'pull/' '')
end

echo "Created PR #$pr_number"

# Wait for DeepSource analysis to complete
echo "Waiting for DeepSource analysis to complete..."
echo "(Analysis is triggered by the PR)"
echo "(Press Ctrl+C to cancel and cleanup)"

set -l max_attempts 60
set -l attempt 0
set -l analysis_complete 0

while test $attempt -lt $max_attempts
    set attempt (math $attempt + 1)
    
    # Try to get issues for this branch/PR
    set -l issues_json (deepsource issues list --format json 2>&1)
    set -l issues_status $status
    
    if test $issues_status -eq 0
        echo "Analysis complete!"
        set analysis_complete 1
        break
    end
    
    # Check if error is due to analysis still running vs actual error
    if string match -q "*not found*" $issues_json; or string match -q "*No issues*" $issues_json
        echo "Analysis complete!"
        set analysis_complete 1
        break
    end
    
    echo "Waiting... (attempt $attempt/$max_attempts)"
    sleep 5
end

if test $analysis_complete -eq 0
    echo "Error: Analysis timed out after "(math $max_attempts \* 5)" seconds"
    set exit_code 1
else
    # List issues in human-readable format
    echo ""
    echo "=== DeepSource Issues ==="
    set -l issues_output (deepsource issues list 2>&1)
    set -l list_status $status
    
    if test $list_status -eq 0
        echo $issues_output
        
        # Check if there are any issues by looking at the output
        if string match -q "*No issues found*" $issues_output; or test (string length "$issues_output") -eq 0
            echo ""
            echo "✓ No issues found!"
            set exit_code 0
        else
            echo ""
            echo "✗ Issues found - see above"
            set exit_code 1
        end
    else
        # If we can't list issues, try to get count from JSON
        set -l issues_json (deepsource issues list --format json 2>&1)
        if test $status -eq 0
            # Parse JSON to count issues (simple check for empty array or object)
            if string match -q "*[]*" $issues_json; or string match -q "*{}*" $issues_json
                echo "✓ No issues found!"
                set exit_code 0
            else
                echo "Issues detected in JSON output:"
                echo $issues_json
                echo ""
                echo "✗ Issues found - see above"
                set exit_code 1
            end
        else
            echo "Warning: Could not retrieve issues list"
            echo $issues_output
            set exit_code 1
        end
    end
end

# Cleanup before exit
cleanup_branch
exit $exit_code
