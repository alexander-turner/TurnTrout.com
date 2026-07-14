import {
  ArticleTitle,
  AuthorList,
  ContentMeta,
  Head,
  Navbar,
  TableOfContents,
} from "../../quartz/components"
import { PageLayout, SharedLayout } from "../../quartz/components/types"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Head(),
  left: [Navbar()],
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [ArticleTitle(), AuthorList()],
  left: [Navbar()],
  right: [TableOfContents(), ContentMeta()],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [ArticleTitle()],
  left: [Navbar()],
  right: [TableOfContents(), ContentMeta()],
}
