import type { ValidDateType } from "../plugins/vfile"

type Page = {
  slug: string
  title: string
}

export type Analytics =
  | null
  | {
      provider: "google"
      tagId: string
    }
  | {
      provider: "umami"
      websiteId: string
      host?: string
    }

export interface GlobalConfiguration {
  pageTitle: string
  /** Whether to display Wikipedia-style popovers when hovering over links */
  enablePopovers: boolean
  /** Analytics mode */
  analytics: Analytics
  /** Glob patterns to not search */
  ignorePatterns: string[]
  /** Whether to use created, modified, or published as the default type of date */
  defaultDateType: ValidDateType
  /** Base URL to use for CNAME files, sitemaps, and RSS feeds that require an absolute URL.
   *   Quartz will avoid using this as much as possible and use relative URLs most of the time
   */
  baseUrl?: string
  /** Navigation sidebar configuration */
  navbar: {
    pages: Page[]
  }
}
