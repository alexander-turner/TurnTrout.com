export const pageWidth = 750
export const leftSidebarWidth = 200
export const rightSidebarWidth = 330
export const marginsBegin = 825
export const topSpacing = "2rem"
export const minDesktopWidth = pageWidth + leftSidebarWidth + rightSidebarWidth + 24 // Some extra margin for the gap
// Prevent overlap of rules when width equals minDesktopWidth
export const maxMobileWidth = minDesktopWidth - 0.02

export const mobileBreakpoint = 600
export const tabletBreakpoint = 1000
export const widerGapBreakpoint = minDesktopWidth + 300

const rawBaseMargin = 0.5
export const baseMargin = `${rawBaseMargin}rem`
export const maxSidebarGap = "4rem" // 8 * baseMargin
export const maxContentWidth = pageWidth + rightSidebarWidth + 100 // 100 for gap
export const boldWeight = 700
export const semiBoldWeight = 600
export const normalWeight = 400
export const lineHeight = "1.8rem"
export const listPaddingLeft = "1.875rem"
export const fontScaleFactor = 1.2

// Colors
export const backgroundDark = "#12141e"
export const backgroundLight = "#fcfcff"
export const foregroundDark = "#d6deff"
export const foregroundLight = "#4c4f69"
export const midgroundFaintDark = "#737994"
export const midgroundDark = "#aab3db"
export const midgroundFaintLight = "#9ca0b0"
export const midgroundLight = "#74747b"
export const liPaddingLeft = `${rawBaseMargin * 0.5}rem`

// WCAG AA-compliant overrides for Shiki github-light theme.
// Contrast ratios measured against code block background #f2f3f7
// (= color-mix(in srgb, #fcfcff 90%, #9ca0b0)).
// Must set `color` directly — overriding the CSS custom property doesn't work
// because inline styles (set by Shiki on each <span>) have higher specificity.
export const shikiRed = "#c11e2a" // Keywords/operators: #D73A49 (4.13:1) → 5.43:1
export const shikiOrange = "#a24100" // Parameters/attributes: #E36209 (3.15:1) → 5.75:1
export const shikiGray = "#57606a" // Comments: #6A737D (4.34:1) → 5.76:1
export const shikiGreen = "#116329" // Strings/literals: #22863A (4.17:1) → 6.67:1
export const shikiBlue = "#0550ae" // Constants/builtins: #005CC5 (5.68:1) → 7.25:1

// Shared variables between SCSS and TypeScript
export const variables = {
  pageWidth,
  mobileBreakpoint,
  tabletBreakpoint,
  leftSidebarWidth,
  rightSidebarWidth,
  marginsBegin,
  topSpacing,
  minDesktopWidth,
  maxMobileWidth,
  widerGapBreakpoint,
  maxSidebarGap,
  maxContentWidth,
  baseMargin,
  backgroundDark,
  backgroundLight,
  foregroundDark,
  foregroundLight,
  boldWeight,
  semiBoldWeight,
  normalWeight,
  lineHeight,
  listPaddingLeft,
  midgroundFaintDark,
  midgroundDark,
  midgroundFaintLight,
  midgroundLight,
  fontScaleFactor,
  liPaddingLeft,
  shikiRed,
  shikiOrange,
  shikiGray,
  shikiGreen,
  shikiBlue,
} as const

export type Variables = typeof variables
