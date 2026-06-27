---
title: "Test section: Code blocks"
permalink: test-section-code-blocks
no_dropcap: "true"
tags:
  - website
description: Auto-generated isolated section fixture (Code blocks) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Code blocks

Inline code ligature kerning: `$var` must be interpolated into `#{$var}`. See also `===`, `!==`, `=>`, and `custom-property-no-missing-interpolation`.

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
