---
title: "Test section: Code blocks"
permalink: test-section-code-blocks
no_dropcap: "true"
avoidIndexing: true
tags:
  - website
description: Auto-generated isolated section fixture (Code blocks) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Code blocks

Inline code ligature kerning: `$var` must be interpolated into `#{$var}`. See also `===`, `!==`, `=>`, and `custom-property-no-missing-interpolation`.

Inline code left spacing after a crowding glyph: with the help of [`TomSmith`](#code-blocks), I got feedback from experts in military and surveillance law. In particular, I got feedback from the foremost expert on the law behind human / AI integration in war—a former chief judge on the US military appeals court. He said my Framework was "actually pretty good" 🙂 and suggested improvements. The monospace keeps a small gap mid-line but stays flush when it wraps to the start of a line.

Inline code flush against a glued delimiter: parentheses (`code`), brackets \[`code`\], braces \{`code`\}, quotes "`code`", a slash AI/`code`, a hyphen re-`code`, and equals x=`code` all hug the code, while a space `the regex` or an em dash—`code` keeps the small gap.

```json
"lint-staged": {
 "*.{js, jsx, ts, tsx, css, scss, json}": "prettier --write",
 "*.fish": "fish_indent",
 "*.sh": "shfmt -i 2 -w",
 "*.py": [
     "autoflake --in-place",
     "isort",
     "autopep8 --in-place",
     "black"
    ]
}
```

```javascript
const testVar = 5;

function loseTheGame(numTimes: number): void {
    for (let i = 0; i < numTimes; i++) {
        console.log("You just lost the game!");
    }
}
```

```plaintext
This is a plain code block without a language specified.
```

```plaintext
This block has an intentionally long line so the default soft-wrap has something to chew on: lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
```

```plaintext
This block has short lines.
Each line fits easily on screen.
No wrapping needed here.
```
