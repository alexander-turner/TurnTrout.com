import fs from "fs"
import { chromium } from "playwright"
import puppeteer, { type Browser } from "puppeteer"

/** Hardened headless-Chrome flags for critical-CSS extraction in CI/Docker/sandboxes. */
const CRITICAL_CSS_PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu",
] as const

/**
 * Resolves a Chrome/Chromium executable for critical-CSS extraction.
 *
 * `puppeteer-core` bundles no browser, so a fresh checkout has none unless
 * `puppeteer browsers install chrome` has run. This repo always installs
 * Playwright for its tests, so its Chromium is a dependable fallback. An
 * explicit `PUPPETEER_EXECUTABLE_PATH` takes precedence. Returns undefined when
 * neither is present, letting puppeteer fall back to its own default lookup.
 */
export function resolveChromeExecutablePath(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH
  if (fromEnv) {
    return fromEnv
  }
  // `executablePath()` returns the computed path even when uninstalled, so probe disk.
  const playwrightChromium = chromium.executablePath()
  if (fs.existsSync(playwrightChromium)) {
    return playwrightChromium
  }
  return undefined
}

/**
 * Launches headless Chrome for penthouse via critical's `getBrowser` hook.
 *
 * penthouse-esm honors only a `getBrowser` callback—it ignores
 * `puppeteer.args`/`executablePath`—so all browser configuration lives here.
 */
export function launchCriticalCssBrowser(): Promise<Browser> {
  const executablePath = resolveChromeExecutablePath()
  return puppeteer.launch({
    headless: true,
    args: [...CRITICAL_CSS_PUPPETEER_ARGS],
    ...(executablePath ? { executablePath } : {}),
  })
}
