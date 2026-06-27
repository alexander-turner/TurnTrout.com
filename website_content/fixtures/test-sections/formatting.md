---
title: "Test section: Formatting"
permalink: test-section-formatting
no_dropcap: "true"
tags:
  - website
description: Auto-generated isolated section fixture (Formatting) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Formatting

- Normal
- _Italics_
- **Bold**
- _**Bold italics**_
- ~~Strikethrough~~

<abbr class="small-caps"><code>This is smallcaps applied to a code element.</code></abbr>

## Special fonts

<!-- spellchecker-disable -->
Elvish
: <span class="elvish"><span class="elvish-tengwar" lang="qya">    ⸱</span><span class="elvish-translation">Ah! like gold fall the leaves in the wind,</span></span>
: <span class="elvish"><span class="elvish-tengwar" lang="qya"> :</span><span class="elvish-translation">in the song of her voice, holy, and queenly.</span></span>
: <span class="elvish"><span class="elvish-tengwar" lang="qya">  ⸱  ⸱ </span><span class="elvish-translation">Now lost, lost to those from the East is Valimar!</span></span>

<!-- spellchecker-enable -->

Scrawled handwriting
: <span class="bad-handwriting"><b>TERROR</b></span>

Gold script
: _<span class=”gold-script”>Tips hat</span>_

Corrupted text
: <span class=”corrupted”>The corruption creeps ever closer...</span>

Acidic display font
: <span class="acidic">Silence</span>

Acidic display font, in context
: International Association of <span class="acidic">Silence</span> on the Ethics of AI

## Italic punctuation

Enclosing punctuation should render upright (roman) while letter forms remain italic. Apostrophes in contractions should stay italic.

### 8pt italic

| Character | Old (slanted) | New (upright) |
| :-- | :-- | :-- |
| Parentheses | <span class="italic-old">(quickly)</span> | _(quickly)_ |
| Brackets | <span class="italic-old">[briefly]</span> | _[briefly]_ |
| Braces | <span class="italic-old">\{gently\}</span> | _\{gently\}_ |
| Double quotes | <span class="italic-old">“softly”</span> | _“softly”_ |
| Single quotes | <span class="italic-old">‘lightly’</span> | _‘lightly’_ |
| Apostrophe | <span class="italic-old">don’t</span> | _don’t_ |
| Mixed | <span class="italic-old">(it’s “fine," he said)</span> | _(it’s “fine," he said)_ |
| f-ligatures | <span class="italic-old">(fifty officials)</span> | _(fifty officials)_ |

### 12pt italic

| Character | Old (slanted) | New (upright) |
| :-- | :-- | :-- |
| Parentheses | <span class="italic-12-old">(quickly)</span> | <span class="italic-12">(quickly)</span> |
| Brackets | <span class="italic-12-old">[briefly]</span> | <span class="italic-12">[briefly]</span> |
| Braces | <span class="italic-12-old">\{gently\}</span> | <span class="italic-12">\{gently\}</span> |
| Double quotes | <span class="italic-12-old">"softly"</span> | <span class="italic-12">"softly"</span> |
| Single quotes | <span class="italic-12-old">‘lightly’</span> | <span class="italic-12">‘lightly’</span> |
| Apostrophe | <span class="italic-12-old">don’t</span> | <span class="italic-12">don’t</span> |
| Mixed | <span class="italic-12-old">(it’s “fine," he said)</span> | <span class="italic-12">(it’s “fine," he said)</span> |
| f-ligatures | <span class="italic-12-old">(fifty officials)</span> | <span class="italic-12">(fifty officials)</span> |
  
- _The Elements of Typographic Style (Hartley & Marks, 2004)_ is a good book.
- _Parentheses (like these), brackets [like these], and braces \{like these\} should all be upright._
- _**Bold italic (parentheses) and [brackets]**_
- _**We need a <span>deep (nesting)</span> test.**_
- _Here's `code(not_wrapped)` but (these are wrapped)._
