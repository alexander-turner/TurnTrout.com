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

export const baseMargin = "0.5rem"
export const maxSidebarGap = "4rem" // 8 * baseMargin
export const maxContentWidth = pageWidth + rightSidebarWidth + 100 // 100 for gap
export const boldWeight = 700
export const semiBoldWeight = 600
export const normalWeight = 400
export const lineHeight = "1.8rem"
export const listPaddingLeft = "2rem"
export const fontScaleFactor = 1.2

// Colors
export const midgroundFaintDark = "#737994"
export const midgroundDark = "#aab3db"
export const midgroundFaintLight = "#9ca0b0"
export const midgroundLight = "#74747b"

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
} as const

export type Variables = typeof variables
