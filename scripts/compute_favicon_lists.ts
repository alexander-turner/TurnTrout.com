/**
 * CLI helper that outputs the set of domain entries whose favicons should appear
 * in the built site, as determined by `shouldIncludeFavicon` with real counts.
 *
 * Called by scripts/built_site_checks.py so that the Python validation
 * mirrors the exact same inclusion predicate used by the Quartz transformer.
 *
 * Usage: npx tsx scripts/compute_favicon_lists.ts
 */
import { defaultPath } from "../quartz/components/constants"
import {
  readFaviconCounts,
  shouldIncludeFavicon,
  transformUrl,
  getFaviconUrl,
} from "../quartz/plugins/transformers/favicons"

async function main() {
  const faviconCounts = await readFaviconCounts()

  // Compute the set of underscore-separated domain names that pass shouldIncludeFavicon
  const includedDomains: string[] = []
  for (const [pathWithoutExt] of faviconCounts) {
    // Build path with extension (special paths like URLs and .svg/.ico are preserved)
    const pathWithExt =
      pathWithoutExt.startsWith("http") || /\.(?:svg|ico)$/.test(pathWithoutExt)
        ? pathWithoutExt
        : `${pathWithoutExt}.png`

    const transformedPath = transformUrl(pathWithExt)
    if (transformedPath === defaultPath) continue

    const url = getFaviconUrl(transformedPath)
    if (!shouldIncludeFavicon(url, pathWithoutExt, faviconCounts)) continue

    // Extract domain part: /static/images/external-favicons/example_com -> example_com
    const match = pathWithoutExt.match(/external-favicons\/(?<domain>.+)$/)
    if (match?.groups?.domain) {
      includedDomains.push(match.groups.domain)
    }
  }

  console.log(JSON.stringify({ includedDomains }))
}

main()
