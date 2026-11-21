/** A snippet of markup that puts probe content inside one styled context. */
export interface ContextWrapper {
  name: string
  open: string
  close: string
  bolded: boolean
}

// Every rule that applies the faux-bold text-shadow, plus the .right reset
// that removes it. Shared by the specs that hold the mixin's two invariants:
// the favicon nudge that travels with the shadow (faviconInkGap.spec.ts) and
// the underline weight the shadow must leave alone (boldUnderline.spec.ts).
export const FAUX_BOLD_WRAPPERS: readonly ContextWrapper[] = [
  { name: "strong", open: "<strong>", close: "</strong>", bolded: true },
  { name: "title-cell", open: '<div class="title-cell">', close: "</div>", bolded: true },
  {
    name: "admonition-title",
    open: '<span class="admonition-title-inner">',
    close: "</span>",
    bolded: true,
  },
  {
    name: "right-reset",
    open: '<div class="right"><strong>',
    close: "</strong></div>",
    bolded: false,
  },
]
