/**
 * Shared favicon configuration: hostname normalization and computed
 * whitelist/blacklist arrays.
 *
 * Imported by both the Quartz transformer (linkfavicons.ts) and the
 * Python validation helper (scripts/compute_favicon_lists.ts) so that
 * the inclusion predicate is defined in one place.
 */
import { parse as parseDomain } from "psl"

import {
  specialFaviconPaths,
  specialDomainMappings,
  faviconCountWhitelist,
  faviconSubstringBlacklist,
  googleSubdomainWhitelist,
} from "../components/constants"

/**
 * Normalizes a hostname by removing subdomains and extracting the root domain.
 * Converts subdomains like "blog.openai.com" to their root domain "openai.com".
 * Properly handles multi-part TLDs like "co.uk" (e.g., "blog.example.co.uk" -> "example.co.uk").
 *
 * Special cases:
 * - Applies cross-domain mappings (e.g., transformer-circuits.pub -> anthropic.com)
 * - Preserves whitelisted Google subdomains (scholar.google.com, play.google.com, etc.)
 * - Preserves all StackExchange subdomains (math.stackexchange.com, gaming.stackexchange.com, etc.)
 *
 * @param hostname - The hostname to normalize
 * @returns The root domain or mapped domain, or the original hostname if parsing fails
 */
export function normalizeHostname(hostname: string): string {
  // Preserve StackExchange subdomains
  if (/^[^.]+\.stackexchange\.com$/.test(hostname)) {
    return hostname
  }

  for (const mapping of specialDomainMappings) {
    if (mapping.pattern.test(hostname)) {
      return mapping.to
    }
  }

  // Use psl library to extract root domain (handles multi-part TLDs correctly)
  const parsed = parseDomain(hostname)
  // Return the registered domain if valid, otherwise return original hostname
  if (parsed.error !== undefined || !parsed.domain) {
    return hostname
  }
  return parsed.domain
}

/**
 * Normalize an underscore-separated hostname entry through the same PSL pipeline
 * used for real hostnames, so entries like "playpen_icomtek_csir_co_za" are
 * automatically reduced to "csir_co_za" — matching what getQuartzPath produces.
 */
export function normalizeFaviconListEntry(entry: string): string {
  const hostname = entry.replaceAll("_", ".")
  const normalized = normalizeHostname(hostname)
  return normalized.replaceAll(".", "_")
}

/**
 * Whitelist uses substring matching, so raw entries work fine (e.g., "apple_com"
 * matches any path containing that substring). No PSL normalization needed.
 */
export const faviconCountWhitelistComputed = [
  ...Object.values(specialFaviconPaths),
  ...faviconCountWhitelist,
  ...googleSubdomainWhitelist.map((subdomain) => `${subdomain.replaceAll(".", "_")}_google_com`),
]

/**
 * Blacklist entries are normalized through the same PSL pipeline as hostnames,
 * so entries with full subdomains (e.g., "playpen_icomtek_csir_co_za") are
 * reduced to their registered domain form (e.g., "csir_co_za") to match
 * what getQuartzPath produces.
 */
export const faviconSubstringBlacklistComputed =
  faviconSubstringBlacklist.map(normalizeFaviconListEntry)
