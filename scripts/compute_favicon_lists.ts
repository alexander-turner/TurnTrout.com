/**
 * CLI helper that outputs the computed favicon whitelist and blacklist as JSON.
 *
 * Called by scripts/built_site_checks.py so that the Python validation
 * mirrors the exact same inclusion predicate used by the Quartz transformer.
 *
 * Usage: npx tsx scripts/compute_favicon_lists.ts
 */
import {
  faviconCountWhitelistComputed,
  faviconSubstringBlacklistComputed,
} from "../quartz/util/favicon-config"

console.log(
  JSON.stringify({
    whitelist: faviconCountWhitelistComputed,
    blacklist: faviconSubstringBlacklistComputed,
  }),
)
