set -l GIT_ROOT (git rev-parse --show-toplevel)
set -l TEMP_DICT "/tmp/candidate_wordlist.txt"
set -l PERM_DICT "$GIT_ROOT/config/spellcheck/.wordlist.txt"
set -l SLUG_REGEX "(?:(?=.{10,})[\da-zA-Z]+(\-[\da-zA-Z]+){2,}|bignote-\w+)"
set -l FILES website_content/**.md # Respects gitignore by default
set -l PLUGINS spell indefinite-article repeated-words syntax-urls frontmatter

$GIT_ROOT/scripts/spellcheck.sh --generate-dictionary $TEMP_DICT

# Check if spellchecker found errors
if test $status -ne 0
    if not test -f $TEMP_DICT
        echo (set_color red) "Error: Temporary dictionary was not created" (set_color normal)
        exit 1
    end

    # Open the temporary dictionary with Neovim and a notification
    nvim $TEMP_DICT -c 'lua vim.api.nvim_notify("Delete invalid words which should not be added to the dictionary.", vim.log.levels.INFO, {})'

    # Exit if temp dict is empty
    if not test -s $TEMP_DICT
        exit 1
    end

    # Append valid words to the permanent dictionary and remove the temporary one
    cat $TEMP_DICT >>$PERM_DICT
    trash-put $TEMP_DICT

    # Run spellcheck again with the updated dictionary
    $GIT_ROOT/scripts/spellcheck.sh; or exit
end
