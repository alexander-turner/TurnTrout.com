#!/usr/bin/env fish

# Check for common mistake in intra-site MD urls: [](foo) instead of [](/foo)
function check_md_links
    set -l INVALID_MD_LINK_PATTERN "\]\([-A-Za-z_0-9:]+(\.md)?\)"
    set -g found_invalid false

    for file in $argv
        set -l grep_result (grep -E "$INVALID_MD_LINK_PATTERN" "$file")
        if test -n "$grep_result"
            if not $found_invalid
                echo "INVALID_MD_LINK: These files probably have invalid markdown URLs" >&2
                set -g found_invalid true
            end
            echo "File: $file" >&2
            echo "$grep_result" >&2
        end
    end

    if test $found_invalid = true
        exit 1
    else
        exit 0
    end
end

if not set -q GIT_ROOT
    set -g GIT_ROOT (git rev-parse --show-toplevel)
end


if test (count $argv) -eq 0
    set -g MD_FILES (find "$GIT_ROOT/content" -name "*.md" ! -path "*/drafts/*")
else 
    set -g MD_FILES $argv
end

check_md_links $MD_FILES
exit $status
