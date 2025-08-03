import { PageLayout, SharedLayout } from "./quartz/cfg"
import {
  ArticleTitle,
  AuthorList,
  ContentMeta,
  DesktopOnly,
  Footer,
  Head,
  Navbar,
  TableOfContents,
} from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Head(),
  header: [],
  left: [Navbar()],
  footer: Footer({
    links: {},
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [ArticleTitle(), AuthorList()],
  left: [Navbar()],
  right: [DesktopOnly(TableOfContents()), ContentMeta()],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [ArticleTitle()],
  left: [Navbar()],
  right: [DesktopOnly(TableOfContents()), ContentMeta()],
}
