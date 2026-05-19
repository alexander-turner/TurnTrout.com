import { rgb } from "d3-color"
import { interpolateRgb } from "d3-interpolate"

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

export const backgroundDark = "#12141e"
export const backgroundLight = "#fcfcff"
export const foregroundDark = "#eff2ff"
export const foregroundLight = "#20212c"

const pct = (n: number): string => `${n}%`
export const midgroundStrongPctNum = 85
export const midgroundPctNum = 70
export const midgroundFaintPctNum = 50
export const midgroundFainterPctNum = 15
export const midgroundFaintestPctNum = 5
export const midgroundStrongPct = pct(midgroundStrongPctNum)
export const midgroundPct = pct(midgroundPctNum)
export const midgroundFaintPct = pct(midgroundFaintPctNum)
export const midgroundFainterPct = pct(midgroundFainterPctNum)
export const midgroundFaintestPct = pct(midgroundFaintestPctNum)

// Mirrors CSS `color-mix(in srgb, fg <pct>%, bg)`.
export function mixSrgb(fg: string, bg: string, fgPct: number): string {
  return rgb(interpolateRgb(fg, bg)(1 - fgPct / 100)).formatHex()
}

export const midgroundStrongLight = mixSrgb(foregroundLight, backgroundLight, midgroundStrongPctNum)
export const midgroundStrongDark = mixSrgb(foregroundDark, backgroundDark, midgroundStrongPctNum)
export const midgroundLight = mixSrgb(foregroundLight, backgroundLight, midgroundPctNum)
export const midgroundDark = mixSrgb(foregroundDark, backgroundDark, midgroundPctNum)
export const midgroundFaintLight = mixSrgb(foregroundLight, backgroundLight, midgroundFaintPctNum)
export const midgroundFaintDark = mixSrgb(foregroundDark, backgroundDark, midgroundFaintPctNum)

// Highlight is a translucent layer over --midground. Light/dark use slightly
// different alphas to preserve visual weight across modes.
export const highlightLightPct = "14%"
export const highlightDarkPct = "19%"

export const liPaddingLeft = `${rawBaseMargin * 0.5}rem`

// Palette colors — single source of truth for _palette.scss (generated) and critical CSS
export const darkPalette: Readonly<Record<string, string>> = {
  pink: "#fba7e4",
  red: "#e88283",
  maroon: "#d586a1",
  orange: "#e19b5b",
  yellow: "#e5c890",
  green: "#a6d189",
  teal: "#81c8be",
  sky: "#5bc4d7",
  blue: "#8caaee",
  lavender: "#9899d7",
  purple: "#ba8be9",
  gold: "#db9c01",
}

export const lightPalette: Readonly<Record<string, string>> = {
  pink: "#d020a3",
  red: "#be415c",
  orange: "#a45c19",
  yellow: "#7d751c",
  green: "#22820d",
  teal: "#037e85",
  sky: "#007cb4",
  blue: "#3e6ccb",
  lavender: "#4963fd",
  purple: "#6f42c1",
  gold: "#9b6700",
}

export const dropcapVerticalOffset = "0.15rem"
export const dropcapFontSize = "3.95rem"
export const dropcapMinHeight = "4.2rem"
export const dropcapPaddingRight = "0.1em"

// Design tokens — shared across SCSS files
export const borderRadius = 5
export const transitionDurationVeryQuick = "0.1s"
export const transitionDurationQuick = "0.2s"
export const transitionDurationMedium = "0.3s"
export const transitionDurationSlow = "0.5s"
export const fauxBoldOffset = "0.3px"

// Z-index scale — use these tokens instead of raw numbers so the stacking
// order is visible in one place.
//   zBelow     decorative layers painted under content
//   zBase      default stacking context (0)
//   zRaised    standard in-flow elements lifted above siblings
//   zAccent    small UI accents (e.g. toggle dots) above zRaised
//   zPopover   hover cards, tooltips
//   zSticky    sticky overlays above page content (e.g. video controller)
//   zNavbar    global site chrome
//   zModal     full-screen overlays (e.g. search)
//   zSkipLink  skip-to-content a11y link — always topmost
export const zBelow = -1
export const zBase = 0
export const zRaised = 1
export const zAccent = 3
export const zPopover = 10
export const zSticky = 100
export const zNavbar = 910
export const zModal = 999
export const zSkipLink = 9999

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
  midgroundStrongLight,
  midgroundStrongDark,
  midgroundStrongPct,
  midgroundPct,
  midgroundFaintPct,
  midgroundFainterPct,
  midgroundFaintestPct,
  highlightLightPct,
  highlightDarkPct,
  fontScaleFactor,
  liPaddingLeft,
  shikiRed,
  shikiOrange,
  shikiGray,
  shikiGreen,
  shikiBlue,
  dropcapVerticalOffset,
  dropcapFontSize,
  dropcapMinHeight,
  dropcapPaddingRight,
  borderRadius,
  transitionDurationVeryQuick,
  transitionDurationQuick,
  transitionDurationMedium,
  transitionDurationSlow,
  fauxBoldOffset,
  zBelow,
  zBase,
  zRaised,
  zAccent,
  zPopover,
  zSticky,
  zNavbar,
  zModal,
  zSkipLink,
} as const

export type Variables = typeof variables
