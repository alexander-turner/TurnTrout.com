#!/usr/bin/env fish

# Query DeepSource analysis results and print issues.
# Returns exit code 1 if issues found.
#
# Usage:
#   run_deepsource_cli.fish                  # Create temp PR, wait for analysis (pre-push)
#   run_deepsource_cli.fish --commit <SHA>   # Query existing analysis by commit SHA
#   run_deepsource_cli.fish --branch <name>  # Query latest commit on a branch

set -g mode "create-pr"
set -g commit_sha ""
set -g branch_name_arg ""

# Parse arguments
set -l i 1
while test $i -le (count $argv)
    switch $argv[$i]
        case --commit
            set i (math $i + 1)
            set -g mode "commit"
            set -g commit_sha $argv[$i]
        case --branch
            set i (math $i + 1)
            set -g mode "branch"
            set -g branch_name_arg $argv[$i]
        case --help -h
            echo "Usage: run_deepsource_cli.fish [--commit <SHA>] [--branch <name>]"
            echo ""
            echo "Options:"
            echo "  --commit <SHA>    Query analysis for a specific commit"
            echo "  --branch <name>   Query analysis for the latest commit on a branch"
            echo "  (no args)         Create temp PR, wait for analysis (pre-push mode)"
            exit 0
    end
    set i (math $i + 1)
end

# Resolve the DeepSource auth token
set -g ds_token ""
if test -f ~/.deepsource/config.toml
    set -g ds_token (string match -r 'token = "([^"]+)"' < ~/.deepsource/config.toml)[2]
end
if test -z "$ds_token" -a -n "$DEEPSOURCE_PAT"
    set -g ds_token $DEEPSOURCE_PAT
end
test -z "$ds_token"; and echo "Error: No DeepSource token found. Run 'deepsource auth login' first." && exit 1

# Resolve the GitHub repo owner/name for dashboard URLs
set -g repo_owner "alexander-turner"
set -g repo_name "TurnTrout.com"
if set -l remote_url (git remote get-url origin 2>/dev/null)
    set -l match (string match -r '(?:github\.com[:/])([^/]+)/([^/.]+)' $remote_url)
    if test (count $match) -ge 3
        set -g repo_owner $match[2]
        set -g repo_name $match[3]
    end
end

# Query DeepSource GraphQL API for a commit's analysis results.
# Uses inline SHA substitution (GraphQL variables error on DeepSource's API).
# Sets $query_result to the JSON response body.
function query_commit_analysis --argument-names sha
    set -g query_result (curl -s --max-time 30 \
        -H "Authorization: Bearer $ds_token" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ run(commitOid: \"'$sha'\") { runUid status branchName summary { occurrencesIntroduced occurrencesResolved } checks { edges { node { analyzer { name shortcode } status summary { occurrencesIntroduced occurrencesResolved } } } } } }"}' \
        https://api.deepsource.io/graphql/ 2>&1)
end

# Print results from the query. Returns 1 if issues found.
function print_results
    set -l run_status (echo $query_result | jq -r '.data.run.status' 2>/dev/null)
    set -l branch (echo $query_result | jq -r '.data.run.branchName // "unknown"' 2>/dev/null)
    set -l run_uid (echo $query_result | jq -r '.data.run.runUid // ""' 2>/dev/null)

    if test "$run_status" = "null" -o -z "$run_status"
        echo "Error: No analysis run found for this commit."
        echo "The commit may not have been pushed or DeepSource may not have analyzed it yet."
        return 1
    end

    echo "=== DeepSource Analysis Results ==="
    echo "Branch: $branch | Status: $run_status"
    if test -n "$run_uid"
        echo "Dashboard: https://app.deepsource.com/gh/$repo_owner/$repo_name/run/$run_uid/"
    end
    echo ""

    set -l has_issues 0
    set -l total_introduced (echo $query_result | jq -r '.data.run.summary.occurrencesIntroduced' 2>/dev/null)
    set -l total_resolved (echo $query_result | jq -r '.data.run.summary.occurrencesResolved' 2>/dev/null)

    # Print per-analyzer summaries
    set -l check_count (echo $query_result | jq '.data.run.checks.edges | length' 2>/dev/null)
    for idx in (seq 0 (math $check_count - 1))
        set -l analyzer (echo $query_result | jq -r ".data.run.checks.edges[$idx].node.analyzer.name" 2>/dev/null)
        set -l shortcode (echo $query_result | jq -r ".data.run.checks.edges[$idx].node.analyzer.shortcode" 2>/dev/null)
        set -l check_status (echo $query_result | jq -r ".data.run.checks.edges[$idx].node.status" 2>/dev/null)
        set -l introduced (echo $query_result | jq -r ".data.run.checks.edges[$idx].node.summary.occurrencesIntroduced" 2>/dev/null)
        set -l resolved (echo $query_result | jq -r ".data.run.checks.edges[$idx].node.summary.occurrencesResolved" 2>/dev/null)

        echo "--- $analyzer ($shortcode): $check_status ---"
        echo "  Introduced: $introduced | Resolved: $resolved"

        if test "$check_status" = "FAILURE"
            set has_issues 1
        end
        echo ""
    end

    if test $has_issues -eq 1 -o "$total_introduced" -gt 0
        echo "Issues found ($total_introduced introduced, $total_resolved resolved)"
        return 1
    else
        echo "No issues found ($total_resolved resolved)"
        return 0
    end
end

# ── Mode: Query by commit SHA ──
if test "$mode" = "commit"
    test -z "$commit_sha"; and echo "Error: --commit requires a SHA argument" && exit 1

    # Ensure full SHA
    if test (string length $commit_sha) -lt 40
        set -g commit_sha (git rev-parse "$commit_sha" 2>/dev/null)
        test $status -ne 0; and echo "Error: Could not resolve commit SHA" && exit 1
    end

    echo "Querying DeepSource for commit $commit_sha..."
    query_commit_analysis $commit_sha
    print_results
    exit $status

# ── Mode: Query by branch name ──
else if test "$mode" = "branch"
    test -z "$branch_name_arg"; and echo "Error: --branch requires a branch name" && exit 1

    # Resolve branch to commit SHA (try remote first, then local)
    set -g commit_sha (git rev-parse "origin/$branch_name_arg" 2>/dev/null)
    if test $status -ne 0
        set -g commit_sha (git rev-parse "$branch_name_arg" 2>/dev/null)
        test $status -ne 0; and echo "Error: Could not resolve branch '$branch_name_arg'" && exit 1
    end

    echo "Querying DeepSource for branch '$branch_name_arg' (commit $commit_sha)..."

    # Poll for results (analysis may still be running)
    for attempt in (seq 60)
        query_commit_analysis $commit_sha
        set -l run_status (echo $query_result | jq -r '.data.run.status // "null"' 2>/dev/null)

        if test "$run_status" = "SUCCESS" -o "$run_status" = "FAILURE"
            echo ""
            print_results
            exit $status
        else if test "$run_status" = "null"
            # No run found yet - might not be analyzed
            if test $attempt -eq 1
                echo -n "Waiting for analysis"
            end
            echo -n "."
            sleep 5
        else
            # PENDING or other in-progress status
            if test $attempt -eq 1
                echo -n "Analysis in progress"
            end
            echo -n "."
            sleep 5
        end
    end
    echo ""
    echo "Error: Analysis timed out after 5 minutes"
    exit 1

# ── Mode: Create temporary PR (pre-push, original behavior) ──
else
    set -g temp_branch "deepsource-analysis-"(date +%s)
    set -g original_branch (git branch --show-current)
    set -g pr_number ""
    set -g cleanup_done 0

    function cleanup_branch
        test $cleanup_done -eq 1; and return
        set -g cleanup_done 1
        test -n "$pr_number"; and gh pr close $pr_number --delete-branch >/dev/null 2>&1
        test -n "$original_branch"; and git checkout $original_branch >/dev/null 2>&1
        git branch -D $temp_branch >/dev/null 2>&1
        git push origin --delete $temp_branch >/dev/null 2>&1
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

    git checkout -b $temp_branch >/dev/null 2>&1 || exit 1
    git add -A >/dev/null 2>&1
    git commit -m "chore: temporary commit for DeepSource analysis" --allow-empty --no-verify >/dev/null 2>&1 || fail "Failed to commit"
    git push -u origin $temp_branch >/dev/null 2>&1 || fail "Failed to push"

    # Get the commit SHA of what we just pushed
    set -g commit_sha (git rev-parse HEAD)

    set pr_output (gh pr create --draft --title "DeepSource Analysis (temporary)" --body "Temporary PR for DeepSource analysis. Will be auto-closed." 2>&1)
    test $status -eq 0 || fail "Failed to create PR\n$pr_output"

    set -g pr_number (echo $pr_output | string match -r '#(\d+)' | string replace '#' '' | head -n1)
    test -z "$pr_number"; and set -g pr_number (echo $pr_output | string match -r 'pull/(\d+)' | string replace 'pull/' '' | head -n1)
    test -z "$pr_number"; and fail "Could not extract PR number from output:\n$pr_output"

    echo "Waiting for DeepSource analysis on PR #$pr_number (commit $commit_sha)..."

    # Poll for results via DeepSource API
    set analysis_complete 0
    for attempt in (seq 60)
        query_commit_analysis $commit_sha
        set -l run_status (echo $query_result | jq -r '.data.run.status // "null"' 2>/dev/null)

        if test "$run_status" = "SUCCESS" -o "$run_status" = "FAILURE"
            set analysis_complete 1
            break
        end
        echo -n "."
        sleep 5
    end
    echo ""

    if test $analysis_complete -eq 0
        fail "Analysis timed out or did not complete"
    end

    print_results
    set exit_code $status

    cleanup_branch
    exit $exit_code
end
