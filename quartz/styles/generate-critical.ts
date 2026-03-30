import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { darkPalette, lightPalette } from "./variables"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Generates the critical.scss file content from template
 * This CSS is manually appended to auto-generated critical CSS and inlined in HTML
 * SCSS variables (like $midground-faint-light) are replaced at build time with actual values
 * @returns The complete critical SCSS content as a string
 */
const generateCriticalScssContent = (): string => {
  return `:root {
  font-family: var(--font-main);
}

:root[data-theme="light"] {
  --midground-faint: #{$midground-faint-light};
  --midground: #{$midground-light};
}

:root[data-theme="dark"] {
  --midground-faint: #{$midground-faint-dark};
  --midground: #{$midground-dark};
}

#navbar-left h2 {
  color: var(--midground);
}

code,
pre {
  font-family: "FiraCode__subset", FiraCode, monospace;
}

article[data-use-dropcap="true"] {
  --dropcap-vertical-offset: #{$dropcap-vertical-offset};
  --dropcap-font-size: #{$dropcap-font-size};
  --before-color: var(--random-dropcap-color, var(--midground-faint));
  --font-main: "EBGaramond__subset", "EBGaramond";
  --font-italic: "EBGaramondItalic__subset", "EBGaramondItalic";
  --font-italic-situational: var(--font-italic);
  --font-dropcap-foreground: "EBGaramondInitialsF2__subset", "EBGaramondInitialsF2";
  --font-dropcap-background: "EBGaramondInitialsF1__subset", "EBGaramondInitialsF1";
}

article[data-use-dropcap="true"] > p:first-of-type {
  position: relative;
  min-height: #{$dropcap-min-height};
}

article[data-use-dropcap="true"] > p:first-of-type::before {
  content: attr(data-first-letter);
  text-transform: uppercase;
  float: left;
  width: var(--dropcap-font-size);
  font-size: var(--dropcap-font-size);
  line-height: 1;
  padding-right: #{$dropcap-padding-right};
  padding-top: var(--dropcap-vertical-offset);
  font-family: var(--font-dropcap-background);
  color: var(--before-color);
}

article[data-use-dropcap="true"] > p:first-of-type::first-letter {
  margin-left: calc(-1 * var(--dropcap-font-size) - #{$dropcap-padding-right});
  padding-top: var(--dropcap-vertical-offset);
  text-transform: uppercase;
  font-style: normal !important;
  float: left;
  color: var(--foreground);
  font-size: var(--dropcap-font-size);
  line-height: 1;
  padding-right: #{$dropcap-padding-right};
  font-family: var(--font-dropcap-foreground);
  font-weight: 500 !important;
}

article[data-use-dropcap="true"] > p:first-of-type::first-line {
  --font-italic-situational: var(--font-main) !important;
}

em {
  font-family: var(--font-italic-situational);
}

:root[data-theme="dark"],
.dark-mode {
  --background: #{$background-dark};
  --foreground: #{$foreground-dark};
  --red: ${darkPalette.red};
  --green: ${darkPalette.green};
  --blue: ${darkPalette.blue};
}

:root[data-theme="light"],
.light-mode {
  --background: #{$background-light};
  --foreground: #{$foreground-light};
  --red: ${lightPalette.red};
  --green: ${lightPalette.green};
  --blue: ${lightPalette.blue};
}

.float-right {
  float: right;
  max-width: 45%;
  margin: calc(1.5 * $base-margin) 0 calc(1.5 * $base-margin) calc(2 * $base-margin);
}

.sidebar {
  display: flex;
  flex-direction: column;
  margin-top: $top-spacing;
  box-sizing: border-box;
  flex-shrink: 0;
  height: fit-content;
}

@media all and (min-width: $min-desktop-width) {
  #quartz-body {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    gap: calc(0.5 * #{$max-sidebar-gap});
    margin: 0 auto;
  }

  .sidebar {
    position: sticky;
    top: $top-spacing;
    overflow-y: auto;
    max-height: calc(100vh - #{$top-spacing});
  }

  #left-sidebar {
    flex-basis: $left-sidebar-width;
    flex-shrink: 0.25;
    margin-left: calc(0.25 * #{$max-sidebar-gap});
    z-index: 1;
    order: 1;
  }

  #right-sidebar {
    padding-right: calc(0.5 * #{$max-sidebar-gap});
    flex-basis: $right-sidebar-width;
    flex-shrink: 1;
    order: 3;
  }

  #center-content {
    flex-grow: 1;
    flex-shrink: 1;
    max-width: $page-width;
    overflow-x: hidden;
    width: 100%;
    order: 2;
  }
}

@media all and (min-width: $wider-gap-breakpoint) {
  #quartz-body {
    gap: $max-sidebar-gap;
  }

  #left-sidebar {
    margin-left: 0;
  }

  #right-sidebar {
    margin-right: 0;
  }
}
`
}

/**
 * Generates and writes the critical SCSS file to disk
 * @throws Error if file writing fails
 */
export function generateCritical(): void {
  try {
    const outputPath = path.join(__dirname, "critical.scss")
    const scss = generateCriticalScssContent()
    fs.writeFileSync(outputPath, scss)
  } catch (error) {
    // Avoid logging the error itself (it may contain file path info)
    console.error("Error generating critical SCSS")
    throw error
  }
}

// Run generation if this is the main module
/* istanbul ignore next */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateCritical()
  console.log("Critical SCSS generated successfully!")
}
