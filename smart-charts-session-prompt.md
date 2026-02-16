# Task: Build smart chart infrastructure and convert the layer-horizon article

## Goal

Build a build-time SVG chart renderer for this Quartz-based blog, following the existing Mermaid pattern. Then convert the single line chart in `website_content/layer-horizon.md` from a static AVIF image to a `chart` fenced code block that renders as inline SVG at build time.

## Context

Read `plan.md` at the repo root for the full implementation plan. This session implements Phases 1 and 2 of that plan.

The site renders everything server-side (KaTeX, Mermaid diagrams). Mermaid uses `rehype-mermaid` as a rehype plugin in `quartz/processors/parse.ts` with `strategy: "inline-svg"`. Our chart renderer should follow a similar pattern: process fenced code blocks at build time, output inline SVG, ship zero JS for rendering (only a tiny tooltip enhancement script).

## Target article

`website_content/layer-horizon.md` has exactly **1 line chart** (line 67):

- **Title**: "Layer Horizon vs Loss of GPT2-XL (48 layers)"
- **X-axis**: Layer horizon (0 to 48, step size 2 — so ~25 data points)
- **Y-axis**: Loss (smoothly falls from ~9 at horizon=0 down to ~3.14)
- **Annotation**: Horizontal dashed baseline at loss = 3.1418
- **Pattern**: Roughly exponential decay toward baseline

The image is currently: `![alt text](https://assets.turntrout.com/static/images/posts/layer-horizon-gpt2xl.avif)`

The chart sits inside a blockquote (it's a quote from Joseph Miller). The replacement `chart` code block should also be inside that blockquote.

**Data**: I'll provide the exact data points. For now, use these approximate values read from the chart:

```
layer_horizon, loss
0, 8.92
2, 7.85
4, 6.95
6, 6.20
8, 5.60
10, 5.10
12, 4.65
14, 4.28
16, 3.97
18, 3.74
20, 3.56
22, 3.44
24, 3.36
26, 3.30
28, 3.26
30, 3.23
32, 3.21
34, 3.20
36, 3.19
38, 3.18
40, 3.17
42, 3.16
44, 3.16
46, 3.15
48, 3.15
```

## What to build

### 1. Chart transformer plugin

Create `quartz/plugins/transformers/charts.ts` (and supporting files under `quartz/plugins/transformers/charts/` if needed for organization).

- Register as a **rehype plugin** in the unified pipeline at `quartz/processors/parse.ts` (similar to how `rehype-mermaid` is registered)
- Find `<code>` elements with `language-chart` class
- Parse the YAML chart spec
- Generate inline SVG and replace the code block
- Set explicit `width`, `height`, and `viewBox` to prevent layout shift

### 2. Line chart SVG renderer

- Use D3 modules server-side only (`d3-scale`, `d3-shape`, `d3-axis`, `d3-array`, `d3-format`, `d3-selection`) for scale computation and path generation
- These D3 modules are NOT shipped to the client — they're build-time only
- Render axes with tick marks and labels
- Render line paths
- Render data points as circles with `data-x` and `data-y` attributes (for tooltip hydration)
- Support annotations (horizontal reference lines with labels)
- Use CSS variables for colors so dark/light theme works automatically:
  - Axis lines: `var(--midground-faint)`
  - Text: `var(--foreground)`
  - Series colors: `var(--darkblue)`, `var(--red)`, etc.
- Use the site's font: `var(--bodyFont)`

### 3. Chart CSS

Add styles to `quartz/styles/custom.scss`:
- `.smart-chart` container (responsive width, margin)
- Axis styling, grid lines, series lines, data points
- `.smart-chart-tooltip` positioned tooltip
- Dark mode support via `[data-theme="dark"]`
- Hover states (highlight point on hover)

### 4. Client-side tooltip script (~2-3KB)

Create `quartz/static/scripts/chart-tooltips.js`:
- Event delegation on `.smart-chart circle[data-x]`
- Show tooltip with formatted x/y values on hover
- Touch support (tap to show, tap elsewhere to hide)
- Progressive enhancement — charts are fully readable without JS

### 5. Register the plugin

- Export from `quartz/plugins/transformers/index.ts`
- Add to the transformer pipeline in `config/quartz/quartz.config.ts`

### 6. Convert the layer-horizon chart

Replace the `![alt](url)` image in `website_content/layer-horizon.md` with a `chart` fenced code block using the data above. Keep it inside the blockquote. Keep the `<br/>Figure:` caption.

### 7. Unit tests

Create `quartz/plugins/transformers/charts.test.ts` with **100% branch coverage** (project requirement). Test YAML parsing, scale computation, SVG output structure, annotation rendering, and error cases.

## Chart spec format

The YAML spec in fenced code blocks should look like:

````markdown
```chart
type: line
title: "Layer Horizon vs Loss of GPT2-XL (48 layers)"
x:
  label: Layer Horizon
y:
  label: Loss
series:
  - name: Loss
    color: "var(--darkblue)"
    data:
      - [0, 8.92]
      - [2, 7.85]
      ...
annotations:
  - type: horizontal-line
    value: 3.1418
    label: Baseline
    style: dashed
```
````

## Key constraints

- **Build-time only**: D3 runs at build time, SVG is inlined. Zero client JS for chart rendering.
- **100% test coverage**: Required by project config (`jest.config.js`).
- **CSS variables for theming**: Colors adapt to light/dark mode automatically.
- **No layout shift**: Use explicit `viewBox` with aspect ratio. The site targets CLS < 0.05.
- **Match existing patterns**: Follow how other transformer plugins are structured in this codebase.
- Run `pnpm test` and `pnpm check` before committing to verify nothing is broken.

## Reference files

- `quartz/processors/parse.ts` — Where rehype plugins (including Mermaid) are registered
- `quartz/plugins/transformers/gfm.ts` — Example transformer plugin with rehype processing
- `quartz/plugins/transformers/index.ts` — Plugin exports
- `config/quartz/quartz.config.ts` — Plugin registration
- `quartz/styles/custom.scss` — Site styles
- `website_content/layer-horizon.md` — Target article (line 67 has the chart)
- `plan.md` — Full implementation plan with design decisions
