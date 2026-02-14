import { PageLayout, SharedLayout } from "../../quartz/cfg"
import ArticleTitle from "../../quartz/components/ArticleTitle"
import AuthorList from "../../quartz/components/Authors"
import ContentMeta from "../../quartz/components/ContentMeta"
import Footer from "../../quartz/components/Footer"
import Head from "../../quartz/components/Head"
import Navbar from "../../quartz/components/Navbar"
import TableOfContents from "../../quartz/components/TableOfContents"

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
  right: [TableOfContents(), ContentMeta()],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [ArticleTitle()],
  left: [Navbar()],
  right: [TableOfContents(), ContentMeta()],
}
