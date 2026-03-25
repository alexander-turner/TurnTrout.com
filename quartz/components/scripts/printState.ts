// Shared print-mode state. Both spa.inline.ts and scrollHandler.ts need to
// gate scroll handling during print transitions to prevent layout reflow
// issues (e.g. Brave dismissing the print dialog).

const printQuery = window.matchMedia("print")
let isPrintingFlag = false

window.addEventListener("beforeprint", () => (isPrintingFlag = true))
window.addEventListener("afterprint", () => (isPrintingFlag = false))

/** Returns true when the browser is in a print transition or print media is active. */
export function isPrinting(): boolean {
  return isPrintingFlag || printQuery.matches
}
