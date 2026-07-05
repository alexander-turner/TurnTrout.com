/**
 * Schema for build-time external-link annotations (title + abstract shown in
 * hover popovers). Shared by the fetcher script, the transformer/emitter, and
 * the browser popover code, so it must stay free of node imports.
 */

export interface LinkAnnotationAttribution {
  /** Human-readable source, e.g. "Wikipedia". */
  text: string
  /** License short name, e.g. "CC BY-SA 4.0". */
  license: string
  license_url: string
}

export interface LinkAnnotation {
  /** Provider identifier, e.g. "wikipedia". */
  source: string
  title: string
  /**
   * Sanitized-by-construction HTML: built from the provider's *plain text*
   * abstract via hast text nodes, never from provider HTML.
   */
  abstract_html: string
  attribution: LinkAnnotationAttribution
  /** ISO date the annotation was fetched. */
  retrieved: string
}

/** Keyed by canonical URL (see `canonicalizeUrl` in quartz/util/urls.ts). */
export type LinkAnnotations = ReadonlyMap<string, LinkAnnotation>

/** Site-absolute URL of the emitted annotations JSON. */
export const LINK_ANNOTATIONS_STATIC_PATH = "/static/link-annotations.json"

/** Class marking an external link that has a committed annotation. */
export const ANNOTATED_LINK_CLASS = "annotated"

function requireString(entry: Record<string, unknown>, field: string, context: string): string {
  const value = entry[field]
  if (typeof value !== "string" || value === "") {
    throw new Error(`${context}: field "${field}" must be a non-empty string`)
  }
  return value
}

/**
 * The fetcher only ever emits plain text wrapped in simple formatting tags,
 * so anything else in a committed manifest is either hand-edit damage or an
 * injection attempt. Attributes are disallowed entirely.
 */
const ALLOWED_ABSTRACT_TAGS: ReadonlySet<string> = new Set([
  "p",
  "em",
  "strong",
  "i",
  "b",
  "sub",
  "sup",
])
const ABSTRACT_TAG_REGEX = /<\s*\/?\s*([a-z0-9-]*)([^>]*)>?/gi

/**
 * `license_url` lands directly in an `href`, so it must be a real https URL —
 * a hand-edited `javascript:` value would otherwise become click-to-execute.
 */
function requireHttpsUrl(entry: Record<string, unknown>, field: string, context: string): string {
  const value = requireString(entry, field, context)
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${context}: field "${field}" must be a valid URL, got "${value}"`)
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${context}: field "${field}" must use https, got "${value}"`)
  }
  return value
}

/** `retrieved` feeds date arithmetic (`--max-age-days`); NaN dates would silently pass. */
function requireIsoDate(entry: Record<string, unknown>, field: string, context: string): string {
  const value = requireString(entry, field, context)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${context}: field "${field}" must be a parseable date, got "${value}"`)
  }
  return value
}

function requireSafeAbstractHtml(entry: Record<string, unknown>, context: string): string {
  const value = requireString(entry, "abstract_html", context)
  for (const match of value.matchAll(ABSTRACT_TAG_REGEX)) {
    const [, tagName, rest] = match
    if (!ALLOWED_ABSTRACT_TAGS.has(tagName.toLowerCase()) || rest !== "") {
      throw new Error(
        `${context}: abstract_html may only contain attribute-free ` +
          `${[...ALLOWED_ABSTRACT_TAGS].join("/")} tags, found "${match[0]}"`,
      )
    }
  }
  return value
}

/**
 * Validates parsed annotations JSON, throwing a descriptive error on any
 * malformed entry so a bad manifest fails the build loudly.
 */
export function validateLinkAnnotations(
  parsed: unknown,
  source: string,
): Map<string, LinkAnnotation> {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`)
  }

  const annotations = new Map<string, LinkAnnotation>()
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const context = `${source} entry for ${key}`
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${context} must be an object`)
    }
    const entry = value as Record<string, unknown>
    const attributionRaw = entry.attribution
    if (attributionRaw === null || typeof attributionRaw !== "object") {
      throw new Error(`${context}: field "attribution" must be an object`)
    }
    const attribution = attributionRaw as Record<string, unknown>
    annotations.set(key, {
      source: requireString(entry, "source", context),
      title: requireString(entry, "title", context),
      abstract_html: requireSafeAbstractHtml(entry, context),
      attribution: {
        text: requireString(attribution, "text", `${context}.attribution`),
        license: requireString(attribution, "license", `${context}.attribution`),
        license_url: requireHttpsUrl(attribution, "license_url", `${context}.attribution`),
      },
      retrieved: requireIsoDate(entry, "retrieved", context),
    })
  }
  return annotations
}
