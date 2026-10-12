## mermaid-js/mermaid#7410

My site [uses Mermaid diagrams](/design#mermaid-diagrams) for compact, searchable, and dynamically styled graphics. However, [the `a11y` accessibility checker](/design#accessibility) revealed a "bigly" problem. When a page contains multiple diagrams, some element IDs collide (like those for arrowhead markers and node containers). Thus, calling `url(#arrowhead)` in the third diagram might bind to a marker defined in the first. Arrowheads vanish, click handlers fire on the wrong diagram, and CSS styles corrupt.

The issue had been reported repeatedly since 2020 ([#1,318](https://github.com/mermaid-js/mermaid/issues/1318), [#3,267](https://github.com/mermaid-js/mermaid/issues/3267), [#3,433](https://github.com/mermaid-js/mermaid/issues/3433), [#4,346](https://github.com/mermaid-js/mermaid/issues/4346)) with no comprehensive fix in sight. In February 2026, I aimed Claude Code at this problem. This PR prefixed every element ID with its diagram's unique SVG container ID, making collisions impossible. I also ensured that all future diagram types generate unique IDs across diagrams.

## jestjs/jest#16006

Jest lacked a way to enumerate test cases without running them, unlike `pytest --collect-only`. This PR and [PR 16,259](https://github.com/jestjs/jest/pull/16259) fixed that.

## KaTeX/KaTeX#4171

KaTeX's TypeScript codebase carried dozens of escape-hatch `as any` casts left over from its earlier Flow-to-TypeScript migration. Each one silenced a type error instead of fixing it, so the compiler couldn't catch bugs in those spots. This PR replaced these with proper checks and tighter type definitions, then enables a lint rule so new `any` casts can't sneak back in.

## stylelint-scss/stylelint-scss#1195

I ran into the following issue:

1. I defined a CSS `--property`.
2. I defined the `--property` using the SCSS variable `$var`.
3. In this specific context, [browsers will not interpolate `$var`](https://sass-lang.com/documentation/style-rules/declarations/#custom-properties) which means the final CSS contains the literal "`$var`".

To fix the problem, `$var` must be interpolated into `#{$var}`. My `custom-property-no-missing-interpolation` rule catches and automatically fixes this mistake.
