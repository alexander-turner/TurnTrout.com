# Quarterly tag-suggestion prompt

You are auditing the tag taxonomy of a personal blog (turntrout.com). The blog
covers AI alignment, rationality, mathematics, self-improvement, privacy, and
personal essays. Posts live in `website_content/` as Markdown with YAML
frontmatter containing a `tags:` list.

Your job: propose **new** tags that would meaningfully improve navigation, and
flag taxonomy problems. Do **not** invent tags just to have more of them — the
bar is a genuinely useful new dimension that several existing posts share and
that no current tag captures.

## What you are given

- **Current taxonomy**: every existing tag with the number of posts using it.
- **Catalog**: every post's title, description, and current tags.

## What to produce

Write a concise Markdown report with these sections:

1. **Proposed new tags** — a table with columns: `Tag | # posts it would cover |
   Example posts (titles) | Why it's worth adding`. Order by strength. Only
   include a tag if it would cover at least ~3 posts and does not substantially
   duplicate an existing tag. For each, note any overlap with an existing tag so
   the reviewer can judge.
2. **Tags to reconsider** — over-broad tags (one tag on a large fraction of all
   posts does little to discriminate), near-duplicate tags, or tags used on only
   one post. Omit this section if there's nothing to say.
3. **Hygiene** — any inconsistent tag entries you can detect from the catalog
   (e.g. quoted vs. unquoted, singular vs. plural, casing drift). Omit if none.

Keep it skimmable. This report is a starting point for a human review, not a
final decision — do not claim to have applied any changes. Recommend, with a
short rationale, which 1–3 proposals are the strongest.
