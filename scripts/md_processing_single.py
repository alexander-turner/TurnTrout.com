import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
import html
from urllib.parse import unquote
import regex

try:
    from . import utils as script_utils
    from . import md_import_helpers as helpers
except ImportError:
    import utils as script_utils
    import md_import_helpers as helpers


# Data processing functions
def read_maybe_generate_json() -> dict:
    """Read or generate JSON data for all posts."""
    if not os.path.exists("/tmp/all_posts_md.json"):
        subprocess.run(["node", "process_json.cjs"], check=True)
    with open("/tmp/all_posts_md.json", "r") as f:
        return json.load(f)


def strip_referral_url(url: str) -> str:
    """Remove referral prefix from LessWrong URLs."""
    prefix = "https://www.lesswrong.com/out?url="
    if not url.startswith(prefix):
        return ""
    target_url = url.partition(prefix)[2]
    return unquote(target_url)


# Metadata processing
pairs = (
    ("permalink", "slug"),
    ("lw-was-draft-post", "draft"),
    ("lw-is-af", "af"),
    ("lw-is-debate", "debate"),
    ("lw-page-url", "pageUrl"),
    ("lw-linkpost-url", "linkUrl"),
    ("lw-is-question", "question"),
    ("lw-posted-at", "postedAt"),
    ("lw-last-modification", "modifiedAt"),
    ("lw-curation-date", "curatedDate"),
    ("lw-frontpage-date", "frontpageDate"),
    ("lw-was-unlisted", "unlisted"),
    ("lw-is-shortform", "shortform"),
    ("lw-num-comments-on-upload", "commentCount"),
    ("lw-base-score", "baseScore"),
    ("lw-vote-count", "voteCount"),
    ("af-base-score", "afBaseScore"),
    ("af-num-comments-on-upload", "afCommentCount"),
)


def _convert_title(title: str) -> str:
    """Convert title to a string that can be used in YAML."""
    title = title.replace('"', "'")
    manualTitleReplacements = {
        "Nonrobust'": "Nonrobust”",
    }
    for key, val in manualTitleReplacements.items():
        title = title.replace(key, val)
    return f'"{title}"' # Escape in case of colons

def reassign_sequence(post_info: dict[str, Any]) -> dict[str, Any]:
    if post_info["permalink"] in helpers.sequence_reassign_dict:
        seq_info = helpers.sequence_reassign_dict[post_info["permalink"]]
        post_info["sequence-link"] = seq_info["sequence-link"]
        post_info["lw-sequence-title"] = seq_info["sequence-title"]

        for order in ("prev", "next"):
            if f"{order}-slug" in seq_info:
                post_info[f"{order}-post-slug"] = seq_info[f"{order}-slug"]
                post_info[f"{order}-post-title"] = _convert_title(seq_info[f"{order}-title"])
    return post_info

def get_lw_metadata(post_info: dict[str, Any]) -> dict:
    metadata = dict((key, post_info[val]) for (key, val) in pairs)
    metadata["permalink"] = helpers.permalink_conversion[post_info["slug"]]

    metadata["publish"] = "true" if not metadata["lw-was-draft-post"] else "false"

    metadata["title"] = title = _convert_title(post_info["title"])
    if "contents" in post_info and (post_info["contents"]):
        metadata["lw-latest-edit"] = post_info["contents"]["editedAt"]
        metadata["lw-is-linkpost"] = not (
            metadata["lw-page-url"] == metadata["lw-linkpost-url"]
        )
        if metadata["lw-is-linkpost"]:
            metadata["lw-linkpost-url"] = strip_referral_url(
                metadata["lw-linkpost-url"]
            )
        else:
            del metadata["lw-linkpost-url"]

    if "coauthors" in post_info and post_info["coauthors"]:
        authors = []
        if post_info["author"]: 
            author_name = post_info["author"]
            if author_name in helpers.username_dict:
                author_name = helpers.username_dict[author_name]
            authors.append(author_name)
        else: # Some posts don't have an author
            authors.append("Alex Turner")
        
        for coauthor in post_info["coauthors"]:
            display_name = coauthor["displayName"]
            if display_name in helpers.username_dict:
                display_name = helpers.username_dict[display_name]
            authors.append(display_name)
        if len(authors) > 2:
            author_str = ", ".join(authors[:-1]) + f", and {authors[-1]}"
        elif len(authors) == 2:
            author_str = f"{authors[0]} and {authors[1]}"
        else:
            author_str = authors[0]
        metadata["authors"] = author_str

    metadata["tags"] = [entry["name"] for entry in post_info["tags"]]
    # Sort the tags
    metadata["tags"].sort()
    metadata["tags"] = set(filter(lambda x: x in helpers.keep_tags, metadata["tags"]))
    metadata["tags"] = list(
        map(
            lambda tag: (
                helpers.tag_rename_dict[tag] if tag in helpers.tag_rename_dict else tag
            ),
            metadata["tags"],
        )
    )
    metadata["tags"] = [tag.replace(" ", "-") for tag in metadata["tags"]]
    metadata["tags"] = list(
        map(lambda tag: tag.lower() if tag != "AI" else tag, metadata["tags"])
    )

    if not metadata["tags"]:
        print(f"ALERT: {metadata['title']} has no tags\n")

    metadata["aliases"] = [post_info["slug"]]
    if "podcastEpisode" in post_info and (episode := post_info["podcastEpisode"]):
        metadata["lw-podcast-link"] = episode["episodeLink"]

    if "sequence" in post_info and (sequence := post_info["sequence"]):
        metadata["lw-sequence-title"] = _convert_title(sequence["title"])
        metadata["lw-sequence-image-grid"] = sequence["gridImageId"]
        metadata["lw-sequence-image-banner"] = sequence["bannerImageId"]

        # If not here, someone else's sequence perhaps
        if sequence["_id"] in helpers.sequence_hash_to_slugs:
            metadata["sequence-link"] = helpers.sequence_hash_to_slugs[sequence["_id"]]
            for order in ("prev", "next"):
                if post_info[f"{order}Post"]:
                    slug: str = post_info[f"{order}Post"]["slug"]
                    if slug in helpers.permalink_conversion:
                        slug = helpers.permalink_conversion[slug]
                    metadata[f"{order}-post-slug"] = slug

                    order_title: str = _convert_title(post_info[f"{order}Post"]["title"])
                    metadata[f"{order}-post-title"] = order_title
    if metadata['permalink'] in helpers.sequence_reassign_dict:
        metadata = reassign_sequence(metadata)

        

    if "reviewWinner" in post_info and (review_info := post_info["reviewWinner"]):
        metadata["lw-review-art"] = review_info["reviewWinnerArt"]
        metadata["lw-review-competitor-count"] = review_info["competitorCount"]
        metadata["lw-review-year"] = review_info["reviewYear"]
        metadata["lw-review-ranking"] = review_info["reviewRanking"]
        metadata["lw-review-category"] = review_info["category"]

    metadata["lw-reward-post-warning"] = helpers.MARKDOWN_BASE_WARNING in post_info["contents"]["markdown"]

    # Whether post should default to using full-width images
    metadata["use-full-width-images"] = False

    return metadata


def add_quartz_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    """Add Quartz-specific metadata to the existing metadata."""
    publication_timestamp: str = meta["lw-posted-at"]
    # Parse the timestamp (Z indicates UTC timezone)
    dt = datetime.fromisoformat(publication_timestamp[:-1])  # Remove the trailing 'Z'

    # Format into desired string
    formatted_date = dt.strftime("%m/%d/%Y")
    meta["date_published"] = formatted_date

    meta["original_url"] = meta["lw-page-url"]
    return meta


def _entry_to_yaml(key: str, val: Any) -> str:
    yaml = f"{key}: "
    if isinstance(val, list):
        yaml += "\n"
        for item in val:
            yaml += f'  - "{item}"\n'
        return yaml
    elif isinstance(val, bool):
        val = f'"{str(val).lower()}"'
    yaml += f"{val}\n"
    return yaml


def metadata_to_yaml(meta: dict[str, Any]) -> str:
    """Convert metadata dictionary to YAML format."""
    yaml = "---\n"
    for key, val in meta.items():
        yaml += _entry_to_yaml(key, val)
    yaml += "---\n"
    return yaml


def _produceNewFootnote(match, is_footnote_text: bool) -> str:
    # Take first 3 characters because sometimes i used different names for same footnote ref
    cleaned_match = regex.sub(r"[^a-zA-Z0-9 ]", "", match.group(1)).lower().strip()[:3]
    return (
        ("\n" if is_footnote_text else "")  # Start with newline if footnote text
        + rf"[^{cleaned_match}]"
        + (":" if is_footnote_text else "")
    )


def process_latex_footnotes(text: str) -> str:
    """EG $^1$ TEXT -> [^1]: TEXT"""

    def process_match(match) -> str:
        paragraphs = match.group().split("\n\n")
        return paragraphs[0] + "\n\n" + "\n\n".join("    " + p for p in paragraphs[1:])

    # Find multiline footnotes for this style, and indent follow-on paragraphs
    multiline_pattern = r"(?<=^\$\^\d\$)(.*\n\n)([^\$].*)+"
    text = regex.sub(multiline_pattern, process_match, text, flags=regex.MULTILINE)

    # Footnote (manual latex) --- convert end fnref first
    text = regex.sub(
        r"^\s*\$(\^(?:\d+))\$",
        "\n" + r"[\1]:",
        text,
        flags=regex.MULTILINE,
    )

    # Turn the actual fnref into a real footnote
    text = regex.sub(r"\$(\^\d+)\$", r"[\1]", text)
    return text


def fix_footnotes(text: str) -> str:
    # Footnote invocation replacement (from LW format)
    text = regex.sub(r"\[\\\[([^\]]*)\\\]\]\(.*?\)", r"[^\1]", text)
    # Footnote content replacement (from LW format)
    text = regex.sub(r"(\d+)\.\s*\*{2}\[\^\]\(.*?\)\*{2}\s*", r"[^\1]: ", text)

    # Footnote (manual latex, in text)
    text = process_latex_footnotes(text)

    # Footnotes with semantic tags --- end fnref
    fn_text = "(?:FOOTNOTE|FN):?"
    text = regex.sub(
        rf"^\s*\**{fn_text} *([A-Za-z0-9\., ]+)\**",
        lambda x: _produceNewFootnote(x, is_footnote_text=True),
        text,
        flags=regex.MULTILINE | regex.IGNORECASE,
    )
    # $^{\text{FN: retarget}}$
    text = regex.sub(
        r"\$\^{?\\text{" + fn_text + r" ([A-Za-z0-9\., ]+)}}?\$",
        lambda x: _produceNewFootnote(x, is_footnote_text=False),
        text,
        flags=regex.MULTILINE | regex.IGNORECASE,
    )

    # Ensure separation after hyperlink
    return regex.sub(r"\)([a-zA-Z0-9])", r") \1", text)


def parse_latex(markdown: str) -> str:
    # Turn into block mode if it should be display math
    markdown = regex.sub(
        r"(?:[^\$]|^)\$\\begin\{(align|equation)\}",
        r"$$\\begin{\1}",
        markdown,
        flags=regex.MULTILINE,
    )
    markdown = regex.sub(
        r"\\end\{(align|equation)\} *\$(?!\$)",
        r"\\end{\1}$$",
        markdown,
        flags=regex.MULTILINE,
    )

    # Have proper newlines for equations in display mode
    display_math_pattern = r"(?<=\$\$)(.*?)(?=\$\$)"  # Capture content within $$ ... $$
    inner_slash_pattern = (
        r"(?<!\\)\\(?=\s)"  # Match single \ not preceded or followed by another \
    )

    def _replace_inner(match):
        return match.group(0).replace("\\", "\\\\")

    markdown = regex.sub(
        inner_slash_pattern, _replace_inner, markdown, flags=regex.DOTALL
    )

    # Add newline after the beginning of display math
    markdown = regex.sub(r"(?<=\$\$)(?=[^\n])", r"\n", markdown, flags=regex.MULTILINE)
    # Add newline before the end of display math
    markdown = regex.sub(r"(?<=[^\n])(?=\$\$)", r"\n", markdown, flags=regex.MULTILINE)

    # Don't have single numbers
    markdown = regex.sub(r"\$([+-]?\d+(\.\d+)?)\$", r"\1", markdown)

    # Take as input display mode math text, between $$ and $$
    def replace_cases_and_add_text(display_match) -> str:
        display_text = display_match.group(0)  # All text between $$ and $$

        cases_pattern = r"\$\$\n(?<beforeCases>.*?)\\cases\{(?<inCases>.*?)\}\n\$\$"
        cases_match = regex.search(cases_pattern, display_text, flags=regex.DOTALL)

        if not cases_match:  # No cases found
            return display_text

        before_content = cases_match.group("beforeCases")
        cases_content = cases_match.group("inCases")

        # Replace & ... \\ with & \text{...} \\ within cases_content
        def replace_ampersand(inner_cases_match):
            return (
                f"&\\text{{{inner_cases_match.group(1)}}}{inner_cases_match.group(2)}"
            )

        cases_content = regex.sub(r"&(.*?)(\\\\|$)", replace_ampersand, cases_content)

        # Construct the final replacement using the modified cases_content
        replacement = f"$$\n\\begin{{align}}{before_content}\\begin{{cases}}{cases_content}\\end{{cases}}\\end{{align}}\n$$"
        return replacement

    # Original pattern to match the entire cases environment
    display_math_pattern = r"\$\$\n(.*?)\n\$\$"
    markdown = regex.sub(
        display_math_pattern, replace_cases_and_add_text, markdown, flags=regex.DOTALL
    )

    # Don't use mathmode for text without text
    math_text_pattern = (
        r"(?:\\text(?:tt|it|bf)?{)?([a-zA-Z][a-zA-Z ]+[a-zA-Z](?:_\d)?)}?"
    )
    math_exposed_text_pattern = r"\$" + math_text_pattern + r"\$"
    markdown = regex.sub(math_exposed_text_pattern, r"`\1`", markdown)

    return markdown


md_url_pattern = regex.compile(r"\[([^][]+)\](\(((?:[^()]+|(?2))+\)))")


def _get_urls(markdown: str) -> list[str]:
    urls = []
    for re_match in md_url_pattern.finditer(markdown):
        _, _, url = re_match.groups()
        urls.append(url)

    return urls


# people getting hurt table
# "But now we have to."
# balance table col widths
#  “fdsajl; fs”—(spaces) vector.
# 0.994
# Check that no ' or " exist outside of code blocks --- in all formattinghtml. Add tests.
# Loading order for eg fonts
# full width images


# Turn links to my LW posts into internal links
hash_to_slugs = {}
def remove_prefix_before_slug(url: str) -> str:
    """Remove the LessWrong URL prefix and convert to internal link."""
    if not url.endswith(")"):
        raise AssertionError

    for website_hash, slug in hash_to_slugs.items():
        lw_regex = regex.compile(
            rf"(?:https?://)?www\.(?:lesswrong|alignmentforum)\.com.*?{website_hash}.*?#?(.*)(?=\))"
        )

        # Check for links to my sequences and redirect to the posts page
        for sequence_hash, new_slug in helpers.sequence_hash_to_slugs.items():
            if url.endswith(sequence_hash + ")"):
                url = f"/{new_slug})"

        # Capture anchor information after the slug (if present)
        re_match = regex.search(lw_regex, url)
        if re_match:
            full_match = re_match.group(0)
            url = f"/{slug})"
            # Extract the anchor part (e.g., "#section-title")
            if "#" in full_match:
                # Lesswrong slugger is different than mine; convert.
                anchor_replacements = {
                    "_": "-",
                    "'": "",
                    "--": "-",
                }
                anchor = full_match.split("#")[1]
                for before, after in anchor_replacements.items():
                    anchor = anchor.replace(before, after)
                anchor = anchor.replace("--", "-")  # Error for eg appendices
                url = f"/{slug}#{anchor})"

            return url

    return url  # Return the original URL if no slug match


def get_slug(url: str) -> Optional[str]:
    if "/" in url and "#" in url:
        return url.split("/")[1].split("#")[0]
    else:
        return None


skip_conversion_substrings = (
    "commentId=",
    "jJrCTRwTZDZDc3XLx", # Old comments didn't have commentId :(
    "turntrout-s-shortform-feed",
)
def replace_urls(markdown: str, current_slug: str = "") -> str:
    """Replace LessWrong URLs with internal links."""
    urls: list[str] = _get_urls(markdown)
    for url in urls:
        if any(substring in url for substring in skip_conversion_substrings):
            continue  # Skip comments or shortform; would otherwise show as post

        sanitized_url: str = remove_prefix_before_slug(url)
        if current_slug and (
            get_slug(sanitized_url) == current_slug
        ):  # Site represents same-page anchors this way
            sanitized_url = "#" + sanitized_url.split("#")[1]
        markdown = markdown.replace(url, sanitized_url)
    return markdown


# Fixing some broken urls and other apparent casualties of markdown conversion
replacement = {
    r"Hoffmann,Ruettler,Nieder\(2011\) AnimBehav\.pdf": "Hoffmann,Ruettler,Nieder(2011)AnimBehav.pdf",
    "is_in": "is _in",
    "<em>openai.com/o</em>penai-five/": "openai.com/openai-five/",
    r"\(<em>h</em>ttps://": "(https://",
    "茂": "ï",
    # Weird invisible unicode which act as spaces
    "": "",
    "": "",  # This is a form feed character, which is a whitespace character
    "◻️": "∎",  # Official end of proof symbol
    "lesserwrong.com": "lesswrong.com",
    # Latex substitutions
    r"\\DeclareMathOperator\*?{\\argmax}{arg\\,max}": "",
    r"\\DeclareMathOperator\*?{\\argmin}{arg\\,min}": "",
    r"\\DeclareMathOperator\*?{\\min}{min\\,min}": "",
    # Dead links need redirect
    "https://i.stack.imgur.com": "https://i.sstatic.net",
    "✔️": "✓",  # too hard to see emoji in dark mode
    r"\biff\b": "IFF",
    r"_\._": r"\.",  # Delete this annoying failure to italicize
    "\xa0": " ",  # NBSP to normal space
    r"\* \* \*": "<hr/>\n",  # Fix horizontal rules
    r"\<\|endoftext\|\>": "<endoftext>",
    "2019/2020": "2019 & 2020",
    "_ [_Anki_](https://apps.ankiweb.net/) _.": "[Anki](https://apps.ankiweb.net/).",
    r"^Table: ": "\nTable: ",  # Ensure that captions aren't folded into a new table row
    # A bunch of replacements specific to the GPT-2 steering post
    r'("[\w ]*" ?)-( ?"[\w ]*")': r"\1 − \2",  # Minus sign for steering vectors
    '" wedding"': "“ wedding”",  # Smart quotes have trouble with this one
    r' 9/11 because" -': " 9/11 because” −",  # Minus sign for steering vectors
    '" +"': "“ ”",  # For wedding vector minus space
    "Position 0": "Pos. 0",  # For GPT2 post
    'say goose +"': "say goose ”",
    '" +anger': "“ anger",
    r"`\\-": r"` −",  # Space for inline code in GPT2 post
    r"(−|\\-)`": r"− `",  # Space for inline code in GPT2 post
    r"\*\*Prompt given to the model\*\*": "Prompt given to the model",
    "is as of": "as of",
    "### Love - Hate": "### Love − Hate",
    r"\(RL/supervised\) ": "{RL, supervised}-",
    '"(weddings?) "': "“\1 ”",
    '" worst"': "“ worst”",
    r"\| I hate you because \|": "| --- |\n| I hate you because |",
    r"\$\$ ?\n ?\\mathbf\{versus\} ?\n ?\$\$": "",
    r"Table:  Prompt given to the model.*": "",
    '" you’re such a good': "“ you’re such a good",
    'talk about weddings constantly "': "talk about weddings constantly ”",
    'talk about weddings a lot. "': "talk about weddings a lot.”",
    '" weddings"': "“ weddings”",
    r"}\$\(be": "}$ (be",
    "experimens": "experiment",
    r"Pos\\b": "Pos.",
    r"Coeff\\b": "Coeff.",
    r"ReLu": "ReLU",
    r"Appendix__Related_work": "Appendix_1_Related_Work",
    # Other posts
    r"d̴iv̢erge͏nc̸e͟": "<span class='corrupted'>divergence</span>",
    r"i͟nstab̕il̡i̡t̷y": "<span class='corrupted'>instability</span>",
    r"https://openai\.com/content/images/2017/05/image4\.gif": "./static/images/mujoco-right.gif",  # Dead link in satisficer post
    r"\$(\-?)\\frac{(\d)}{(\d)}\$": r"\1\2/\3",  # Display fractions natively
    r"corrigibility\$\$": "corrigibility",  # Mistake in Formalizing Policy-modification corrigibility
    r"\$_\\text{([^}]+)}\$": r"<sub>\1</sub>",  # Use real subscripts
    r"turn''": 'turn"',  # Smart quotes -- issue with "Formalizing Policy Modification Corrigibility" post
    r"(?<!\$)t\=(\d+)(?!\$)": r"\$t=\1\$",  # LaTeX formatting for t= in "Formalizing Policy Modification Corrigibility"
    "<hr/>\n\n\n1\\.": "[^1]:",  # Manual footnote in Fear of dark post
    r"\[↩︎\]\(#fnref-[\w\-]+\)": "",
    r"2\.  If we collectively think more": "[^2]: If we collectively think more",  # Manual footnote in Optimism impact post
    r"\$\\leftrightarrow\$": "⇔",  # LaTeX to unicode
    r" . (?=Put in cards for key concepts and practice using the concepts.)": ". ",  # Issue after link in anki post
    r"\n(?=\*\*A:\*\*)": r"\n\n",  # Not enough newlines before A: in inner/outer
    r"non- (?=\$unknown)": "non-",  # Issue in "Open-Category Classification"
    r"\\bEval\\b": "`Eval`",  # TODO check only in
    r"\$-\$": "-",  # I used to use subtraction signs for em dashes lol
    r"\. (\d)\)": r".\n\1.",  # Create lists from paragraphs
    r"\[([^\]]+)\]\([^\)]*?mindingourway\.com/[^\)]*\)": r'"\1"',  # Remove links to mindingourway (because I consider Nate to be a malefactor and don't want to increase worship of him)
    r"“\)": '")',  # Incorrect smart quote in whitelisting article
    "\n_Rare LEAKED": "Figure: _Rare LEAKED",  # Whitelisting caption for Mickey image
    r"_Edit: \[a potential solution": r"Edit: _[a potential solution",  # Italics around the edit mangles it
    r"- it doesn't matter here": r"—it doesn't matter here",  # Edge case in AI post, not working due to how HTML elements get mashed together
    r"_Edit \[a potential solution": r"Edit: _[a potential solution",  # Italics around the edit mangles it
    r"- it doesnt matter here": r"—it doesn't matter here",  # Edge case in A post, not working due to how HTML elements get mashed together
    r"_I_t's": "It's", # Typo in ostruction post
    r"_Facebook\\_user5821_": "`Facebook_user5821`", 
    r"_If you haven't read the prior posts, please do so now. This sequence can be spoiled._": "> [!warning]\n> If you haven’t read the prior posts, please do so now. This sequence can be spoiled.",
    r"not impede most meaningful goals": "not impede most meaningful goals.",
    r"EDIT: However, if you": "\nEDIT: However, if you",
    r"off\'\' ": "off\" ",
    r"\.5\*\.75": "0.5×0.75",
    r"rand\\_region\\_5": "`rand_region_5`",
    r"W′\$": "W'$",
    r"steeply-diminishing": "steeply diminishing",
    r"diminishing returns for relevant gears-level gains": "diminishing returns",
    r"_, and more\.": ", and more.",
    r"listened to on_": "listened to on",
    r"_,_": ",",
    r"\`\*{2}(.*)\*{2}\`": r"**`\1`**",
    r"^\n*<hr\/>": "",
    r"Eliezer is pretty dang clever, and t": "T",
    r"Scheduling: The remainder of the sequence will be released after some delay.": "",
    r"(the set of utility functions we might specify)": "`the set of utility functions we might specify`",
    r"wiki\.lesswrong\.com/wiki/([^\)]*?)(?=\))": lambda match: f"lesswrong.com/tag/{match.group(1).lower()}", # Lower-case tag entries
    r"eq\.\n *1\.": "eq. 1)", # Typo in superhuman post
    r"design choice issue”\.": "design choice issue.”",
    r"guaranteed -to-exist": "guaranteed-to-exist",
    r"\"care about things.\" i.e.": "\"care about things\", i.e.",
    r"gwern(?!\.net)": "`gwern`",
    "argmaxing": "argmax’ing",
    r"argmaxed": "argmax’ed",
    r"□": "∎",
    r"\{align\}": "{align*}",
    r"u-(A?OH)": r"u<sub>\1</sub>",
    "modelling": "modeling", # Prefer American spelling
}

usernames = (
    "AI_WAIFU",
    "janus",
    "TheMajor",
    "daozaich",
    "elriggs",
    "habryka",
    "ofer",
    "tailcalled",
    "TurnTrout",
    "DivineMango",
    "Diffractor",
    "Dacyn",
    "sil ver"
)

multiline_replacements = {
    r"^\#+ Footnotes": "",  # Remove these sections
    r"^> {2,}(?=1\. don\'t)": "> ",  # Remove extra spacing after start of list item in satisficer post
    (r"^\$\$" + "\n{2,}"): "$$\n",  # For some reason there are random display math opens, TODO understand
    r"^ +\$\$": "$$",  # Remove extra spaces before
    r"^\(a\)": "1.",  # Use actual numbered lists.
    r"^\(b\)": "2.",
    r"^\(c\)": "3.",
    r"^Elicit.*\n": "",  # Delete elicit predictions
    r"^_\(Talk given.*$\n": "", # Delete this line with partial parenthetical
    r"^_If you're.*$\n": "", # Delete this line
    r"^- _Indirect_:": "\n- Indirect:",
    r"^\_(In this first essay,.*)\_": "In this first essay, I explore the adversarial robustness obstacle. In the next essay, I’ll point out how this is obstacle is an artifact of these design patterns, and not any intrinsic difficulty of alignment.\n> [!thanks]\n>Thanks to Erik Jenner, Johannes Treutlein, Quintin Pope, Charles Foster, Andrew Critch, `randomwalks`, and Ulisse Mini for feedback.",
    r"^_?If you are interested in working with me.*": "", # Delete offer to team up on MIRIx Discord --- no longer relevant
    r"^_(This post has been.*)_ *$(\n\n<hr/>)?": r"> [!info]\n>\1",
    r"^_(This insight was made possible.*)_": r"> [!thanks]\n>\1",
    r"^\$\$\nEliezer": "Eliezer",
    r"^ *Notes *$": "#### Notes", 
    r"^_(Peli did the stats work and drafted.*)_": r"> [!thanks] Contributions\n>\1",
}

def manual_replace(md: str) -> str:
    """Apply manual replacements to fix common issues in the markdown."""
    for key, val in replacement.items():
        md = regex.sub(key, val, md)
    for key, val in multiline_replacements.items():
        md = regex.sub(key, val, md, flags=regex.MULTILINE)
    for username in usernames:
        md = md.replace(username, f"`{username}`")
    return md


# Helper variables
QUOTE_START = r"> \[!quote\]\s*"
QUOTE_BODY = r"(?P<body>(?:>.*\n)+?)"
QUOTE_LINE_BREAK = r"(?:>\s*)*"
CITATION_SEPARATOR = r"> *\\?[~\-—–]+ *"
PRELINK_CONTENT = r"(?P<prelink>[ _\*]*[^\[\n]*)"
LINK_TEXT_CONTENT = r"(?P<linktext>[^_\*\]]+)"
URL_CONTENT = r"(?P<url>[^#].*?)"
POST_CITATION_CONTENT = r"(?P<postCitation>.*)$(?!\n>)" # Has to be the last line of blockquote

QUOTE_PATTERNS = {
    "start_adm": QUOTE_START,
    "body": QUOTE_BODY,
    "line_break": QUOTE_LINE_BREAK,
    "pre_citation": CITATION_SEPARATOR + PRELINK_CONTENT,
    "link_text": LINK_TEXT_CONTENT,
    "link": r"\[[_\*]*" + LINK_TEXT_CONTENT + r"[_\*]*\]",
    "url": r"\(" + URL_CONTENT + r"\)",
    "md_url": r"\[[_\*]*" + LINK_TEXT_CONTENT + r"[_\*]*\]\(" + URL_CONTENT + r"\)",
    "post_citation": POST_CITATION_CONTENT,
}
LINK_CITATION_LINE = (
    QUOTE_PATTERNS["pre_citation"]
    + QUOTE_PATTERNS["md_url"]
    + QUOTE_PATTERNS["post_citation"]
)
PLAIN_CITATION_LINE = QUOTE_PATTERNS["pre_citation"] + QUOTE_PATTERNS["post_citation"]


def process_linked_citations(md: str) -> str:
    """
    Process quotes with linked citations.
    """
    pattern = (
        QUOTE_PATTERNS["start_adm"]
        + QUOTE_PATTERNS["body"]
        + QUOTE_PATTERNS["line_break"]
        + LINK_CITATION_LINE
    )
    target = r"> [!quote] \g<prelink>[\g<linktext>](\g<url>)\g<postCitation>\n\g<body>"
    return regex.sub(pattern, target, md)


def process_plain_text_citations(md: str) -> str:
    """
    Process quotes with plain text citations.
    """
    pattern = (
        QUOTE_PATTERNS["start_adm"]
        + QUOTE_PATTERNS["body"]
        + QUOTE_PATTERNS["line_break"]
        + PLAIN_CITATION_LINE
    )
    target = r"> [!quote] \g<prelink>\g<postCitation>\n\g<body>"
    return regex.sub(pattern, target, md, flags=regex.MULTILINE)


def move_citation_to_quote_admonition(md: str) -> str:
    """
    Move citation information in quote admonitions to the beginning of the quote.

    This function processes Markdown text to reformat quote admonitions by moving
    citation information (like author names or source links) from the end of the
    quote to the beginning, right after the "[!quote]" tag.

    The function handles three main cases:
    1. Quotes with linked citations at the end (e.g., "[Author Name](link)")
    2. Quotes with plain text citations at the end
    3. Quotes with linked citations on the last line (transformed to "> -- [Author Name](link)")

    Args:
        md (str): The input Markdown text to process.

    Returns:
        str: The processed Markdown text with reformatted quote admonitions.

    Example:
        Input:
        > [!quote]
        > This is a quote.
        > -- [Author Name](https://example.com)

        Output:
        > [!quote] [Author Name](https://example.com)
        > This is a quote.
    """
    # Check for linked citations on the last line
    last_line_pattern = (
        rf"^> *(?P<lastLine>[A-Za-z0-9,\. ]*{QUOTE_PATTERNS['md_url']}[ _\*]*)$"
    )
    md = regex.sub(last_line_pattern, r"> -- \1", md, flags=regex.MULTILINE)

    md = process_linked_citations(md)
    md = process_plain_text_citations(md)
    return md.rstrip("\n")


def thanks_admonition(md: str) -> str:
    """Convert 'Thanks XYZ' to >[!thanks]\n>XYZ."""
    pattern = r"^ *(_|\*\*|)((?:Thanks|I thank|Produced as).+?)\1 *$"
    target = r"> [!thanks]\n>\2"
    return regex.sub(pattern, target, md, flags=regex.MULTILINE)


def remove_warning(markdown: str) -> str:
    """Remove the warning message from power-seeking posts."""
    for warning in helpers.MARKDOWN_WARNINGS:  # TODO Fix
        if warning in markdown:
            markdown = markdown.split(warning)[-1]
    return markdown


def process_markdown(md: str, metadata: dict) -> str:
    """Main function to process and clean up the markdown content."""
    # print(md)
    md = manual_replace(md)

    md = remove_warning(md)  # Warning on power-seeking posts
    md = html.unescape(md)
    md = fix_footnotes(md)

    # unescape the new lines
    newlined = md.replace("\\\\", "\\").replace(r"\\([\[\]\(\)-])", "\\1")
    # fix the lists to not have extra newlines
    single_line_li_md = regex.sub(r"\n\n(\s*)(\d\.|\*) ", r"\n\1\2 ", newlined)
    # make the block quotes contiguous
    contig_md = regex.sub(r"(\>.*?)\n\n(?=\>)", r"\1\n>\n", newlined)

    # surround multiline block quotes with a quote admonition
    longquote_regex = r"((?:^>(?!\!)\s*.*(?:\r?\n|\r)){3,})"
    md = regex.sub(
        longquote_regex, r"> [!quote]\n>\n\1", contig_md, flags=regex.MULTILINE
    )
    md = move_citation_to_quote_admonition(md)
    
    # Convert "Thank you" to nice admonition
    md = thanks_admonition(md)

    # Make links to posts relative, now target turntrout.com
    md = replace_urls(md)

    # Standardize "eg" and "ie"
    for pattern in ("e.g.", "i.e."):
        source_pattern = pattern.replace(".", r"\.")
        optional_source_pattern = source_pattern.replace(r"\.", r"\.?")
        md = regex.sub(
            rf"(\b|(?<=\())(?!{source_pattern})(?:_|\*{1,2})?{optional_source_pattern}(?:_|\*{1,2})?,?\b",
            pattern,
            md,
            flags=regex.IGNORECASE,
        )
        md = regex.sub(source_pattern + r",", pattern, md)

    # Simplify eg 5*5 and \(5\times5\) to 5x5
    number_regex = r"[\-−]?(?:\d{1,3}(?:\,?\d{3})*(?:\.\d+)?|(?:\.\d+))"
    times_sign_regex = r"\s*?(?:\*|\\times)\s*?"
    times_regex_nums = (
        rf"(?:\\\()?({number_regex}|n){times_sign_regex}({number_regex}|n)(?:\\\))?"
    )
    coeff_regex = rf"(coeff){times_sign_regex}(\w+)"
    md = regex.sub(rf"{times_regex_nums}|{coeff_regex}", r"\1×\2", md)

    # Delete extra spaces around bullets
    bulleted_line = r" *\*(?!\*).*\n"
    md = regex.sub(rf"({bulleted_line}) *\n({bulleted_line})(?: *\n)?", r"\1\2", md)
    # Get rid of lines before list start \n\n**A-Outer:**
    md = regex.sub(r"\n *\n( *\*(?: .*)?\n)", r"\n\1", md)

    # single-line $ $ to $$ $$
    md = regex.sub(r"^ *\$([^\$].*[^\$])\$ *$", r"$$\1$$", md, flags=regex.MULTILINE)

    md = parse_latex(md)

    return md


# CLI argument parsing
def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Process Lightweight posts for Quartz import."
    )
    parser.add_argument("title_substring", help="Substring to match in post titles.")
    parser.add_argument(
        "--print", action="store_true", help="Print the generated Markdown."
    )
    return parser.parse_args()


def skip_post(post: dict, filepath: Path) -> bool:
    if not post["contents"]:
        return True
    if post["slug"] in helpers.SKIP_POSTS:
        return True
    
    if filepath.exists():
        existing_text_content: str = filepath.read_text(encoding="utf-8")
        if "skip_import" in existing_text_content:
            print(f"Skipping post {post['slug']} because it is marked to be skipped.")
            return True
    return False
        

# Main execution
if __name__ == "__main__":
    args = parse_args()
    title_substring = args.title_substring
    git_root = script_utils.get_git_root()

    data = read_maybe_generate_json()
    results = data["data"]["posts"]["results"]

    # Get all hashes
    for post in results:
        if not post["contents"]:
            continue
        if post["slug"] in helpers.SKIP_POSTS:
            continue
        current_hash = post["pageUrl"].split("/")[-2]
        hash_to_slugs[current_hash] = helpers.permalink_conversion[post["slug"]]

    if title_substring == "all":
        posts_to_generate = results
    else:
        matching_posts = [post for post in results if title_substring in post["title"]]

        if len(matching_posts) == 0:
            raise FileNotFoundError(
                f"Error: No posts found with title containing '{title_substring}'"
            )
        elif len(matching_posts) > 1:
            print(
                f"Error: Multiple posts found with title containing '{title_substring}':"
            )
            for post in matching_posts:
                print(f"- {post['title']}")
            sys.exit(1)

        posts_to_generate = [matching_posts[0]]

    for post in posts_to_generate:
        output_filename = f"{post['slug']}.md"
        output_path = Path(git_root) / "content" / "import" / output_filename
        if skip_post(post, output_path):
            continue

        metadata = get_lw_metadata(post)
        metadata = add_quartz_metadata(metadata)
        yaml = metadata_to_yaml(metadata)
        post_md = process_markdown(post["contents"]["markdown"], metadata)
        md = yaml + post_md

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md)
        if args.print:
            print(md)

        # print(f"Processed post: {post['title']}")
