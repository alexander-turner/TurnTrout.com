# Smart Graphs Implementation Plan

## Critique of Current Direction

### What's right
- Cataloging all ~100 data visualizations across ~22 articles was necessary groundwork
- Identifying that all plots are baked AVIF images with no local data files clarifies the scope

### What's wrong or risky

**1. Scope creep is the biggest risk.** There are ~100 plots of wildly different types (line charts, scatter plots, heatmaps, vector field overlays on mazes, token probability colormaps, box plots, histograms, multi-panel figures). Trying to support all of them is a multi-month project. Most of these plots (maze vector fields, token-level heatmaps, multi-panel comparison grids) don't meaningfully benefit from interactivity — a static image is already the right format.

**2. Client-side charting libraries conflict with the site's philosophy.** The site aggressively renders everything server-side (KaTeX → HTML, Mermaid → inline SVG). Zero client JS for content rendering. Adding Plotly (~1MB), Chart.js (~60KB), or even Observable Plot (~30KB + D3 deps) as a client-side runtime would be a significant departure from the architecture and would hurt performance.

**3. Data availability is the real bottleneck, not rendering.** The user explicitly said "I'll import the data later." Without data, we can only build infrastructure. The infrastructure should be simple enough that adding data later is trivial, not a complex migration.

**4. Premature abstraction.** Building a general-purpose "chart from YAML spec" system before knowing what the actual data looks like risks building the wrong thing. Better to start with one concrete chart type and expand.

### Revised direction

Build a **build-time SVG chart renderer** that follows the existing Mermaid pattern:
- Author writes a fenced code block with chart spec + data
- Quartz transformer renders it to inline SVG at build time (zero client JS for basic rendering)
- A tiny progressive-enhancement script (~2-3KB) adds tooltips on hover
- Start with **line charts only** (the most common type across the blog), then expand

---

## Implementation Plan

### Phase 1: Core infrastructure — `chart` fenced code block → SVG

**Step 1: Create the chart data format**

Support YAML in fenced code blocks, following the Mermaid pattern:

````markdown
```chart
type: line
title: Layer Horizon vs Loss of GPT2-XL (48 layers)
x:
  label: Layer Horizon
  type: number
y:
  label: Loss
  scale: linear
series:
  - name: Loss
    color: var(--darkblue)
    data:
      - [1, 8.92]
      - [5, 6.41]
      - [10, 4.87]
      - [25, 3.38]
      - [48, 3.14]
annotations:
  - type: horizontal-line
    value: 3.1418
    label: Baseline
    style: dashed
```
````

Also support CSV file references for larger datasets:

````markdown
```chart
type: line
title: Residual Stream Norm by Layer
x:
  label: Layer Index
  field: layer
y:
  label: L2 Norm (log scale)
  field: norm
  scale: log
data: ./data/residual-stream-norms.csv
series:
  - name: resid_post
    field: resid_post
    color: var(--blue)
  - name: mlp_out
    field: mlp_out
    color: var(--red)
```
````

**Step 2: Create the Quartz transformer plugin**

New file: `quartz/plugins/transformers/charts.ts`

- Register as a rehype (HAST) plugin
- Find `<code>` elements with `language-chart` class (how Quartz handles fenced code blocks)
- Parse the YAML spec
- If `data` references a CSV file, read it relative to the content file's directory
- Generate an SVG element using D3 (server-side only — d3-scale, d3-shape, d3-axis, d3-array)
- Replace the code block with the rendered SVG
- Embed data points as `data-*` attributes on SVG elements for client-side tooltip hydration
- Set explicit `width`, `height`, and `viewBox` to prevent layout shift

Dependencies to add:
- `d3-scale`, `d3-shape`, `d3-axis`, `d3-array`, `d3-format`, `d3-selection` (minimal D3 modules, ~15KB total server-side only — not shipped to client)
- `js-yaml` (already used by Quartz for frontmatter parsing)

**Step 3: Implement the SVG renderer for line charts**

`quartz/plugins/transformers/charts/line-renderer.ts`

Responsibilities:
- Accept parsed chart spec + data
- Compute scales (linear, log) from data ranges with sensible padding
- Render axes with tick marks and labels
- Render line paths with proper interpolation
- Render data points as small circles with `data-x` and `data-y` attributes
- Apply CSS variables for colors (works with light/dark theme automatically)
- Support annotations (horizontal/vertical reference lines, labels)
- Output a complete SVG element (HAST node)

Design constraints:
- Default chart width: 100% of container (responsive via `viewBox`)
- Use the site's font (`var(--bodyFont)` / system font) for labels
- Colors from CSS variables so they adapt to dark mode
- Axis lines use `var(--midground-faint)`, text uses `var(--foreground)`

**Step 4: CSS for charts**

Add to `quartz/styles/custom.scss`:

- `.smart-chart` container styles (width, margin, responsive)
- `.smart-chart-tooltip` — positioned absolutely, styled consistently with popovers
- Axis styling (tick marks, grid lines, labels)
- Series styling (line width, point radius)
- Dark mode adaptations via `[data-theme="dark"]`
- Print styles (ensure charts render well in print)
- Hover states (highlight point, dim other series)

**Step 5: Client-side tooltip enhancement**

New file: `quartz/static/scripts/chart-tooltips.js` (~2-3KB)

- Uses event delegation (matches existing pattern in `collapsible-listeners.js`)
- Listens for `mouseover`/`mouseout` on `.smart-chart circle[data-x]` elements
- Shows a tooltip with the x/y values formatted per the chart spec
- Positions tooltip near the cursor, constrained to viewport
- Touch support: tap to show, tap elsewhere to hide
- Progressive enhancement: charts are fully readable without JS

### Phase 2: Register plugin and test

**Step 6: Register the transformer in the Quartz config**

Edit `config/quartz/quartz.config.ts` to add `Plugin.Charts()` to the transformers list.

**Step 7: Add a test chart to Test-page.md**

Add 2-3 example chart code blocks to the test page to validate:
- A simple line chart with inline data
- A multi-series line chart
- A line chart with log scale y-axis

**Step 8: Unit tests**

`quartz/plugins/transformers/charts.test.ts`

Test the YAML parsing, data loading, scale computation, and SVG output. Must hit 100% branch coverage per project requirements.

### Phase 3: Additional chart types (future, not in this PR)

- Scatter plots
- Bar charts / histograms
- Box plots
- Multi-panel layouts

### Phase 4: Data migration (future, user-driven)

- User provides data files or inline data for specific articles
- Replace `![alt](image.avif)` with ````chart` blocks one article at a time
- Can keep AVIF as `<noscript>` fallback if desired

---

## File changes summary

| File | Action | Description |
|------|--------|-------------|
| `quartz/plugins/transformers/charts.ts` | **Create** | Main transformer plugin: parses chart code blocks, dispatches to renderers |
| `quartz/plugins/transformers/charts/line-renderer.ts` | **Create** | Line chart SVG renderer using D3 |
| `quartz/plugins/transformers/charts/types.ts` | **Create** | TypeScript types for chart specs |
| `quartz/plugins/transformers/charts/parse.ts` | **Create** | YAML parsing + validation for chart specs |
| `quartz/plugins/transformers/charts.test.ts` | **Create** | Unit tests (100% coverage) |
| `quartz/plugins/transformers/index.ts` | **Edit** | Export new Charts plugin |
| `quartz/static/scripts/chart-tooltips.js` | **Create** | Client-side tooltip progressive enhancement |
| `quartz/styles/custom.scss` | **Edit** | Add chart CSS |
| `config/quartz/quartz.config.ts` | **Edit** | Register Charts transformer |
| `website_content/Test-page.md` | **Edit** | Add example charts for validation |
| `package.json` | **Edit** | Add D3 module dependencies |

---

## Key design decisions

1. **Build-time SVG, not client-side rendering** — Matches Mermaid pattern, zero JS for chart content
2. **D3 modules server-side only** — Not shipped to browser; only ~2-3KB tooltip script goes to client
3. **CSS variables for theming** — Automatic dark/light mode, consistent with site design
4. **YAML spec in fenced code blocks** — Natural Markdown authoring, parseable at build time
5. **Line charts first** — Most common chart type (~40% of the blog's data plots), proves the pattern
6. **Progressive enhancement** — Charts fully readable without JS; tooltips are a bonus
7. **Explicit dimensions** — `viewBox` with aspect ratio prevents layout shift (CLS budget: 0.05)
