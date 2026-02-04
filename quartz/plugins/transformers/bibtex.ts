import type { Code, Heading, PhrasingContent, Root, RootContent, Text } from "mdast"

import Cite from "citation-js"
import { VFile } from "vfile"

/** Extracts text content from MDAST phrasing content nodes. */
function getTextContent(children: PhrasingContent[]): string {
  return children.map((child) => (child.type === "text" ? child.value : "")).join("")
}

import type { QuartzTransformerPlugin } from "../types"
import type { FrontmatterData } from "../vfile"

/**
 * Generates a BibTeX entry for an article using citation.js.
 * @throws Error if date_published is not present in frontmatter on CI
 */
export function generateBibtexEntry(
  frontmatter: FrontmatterData,
  baseUrl: string,
  slug: string,
): string {
  const title = frontmatter.title
  const authors = frontmatter.authors ?? ["Alex Turner"]

  const datePublished = frontmatter.date_published
  if (!datePublished && process.env.CI) {
    throw new Error(`date_published is required for BibTeX generation (slug: ${slug})`)
  }

  const date = datePublished ? new Date(datePublished as string | Date) : new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  const permalink = frontmatter.permalink as string | undefined
  const url = `https://${baseUrl}/${permalink ?? slug}`

  // Use 'literal' to pass author names as-is - citation.js handles formatting
  const cslEntry = {
    type: "webpage",
    title,
    author: authors.map((name) => ({ literal: name })),
    issued: { "date-parts": [[year, month]] },
    URL: url,
    accessed: {
      "date-parts": [[new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]],
    },
  }

  const cite = new Cite(cslEntry)
  return cite.format("bibtex", { format: "text" })
}

/**
 * Finds the index where Citation section should be inserted.
 * Returns the index of the first h1 containing "Appendix", or end of document.
 */
export function findInsertionIndex(tree: Root): number {
  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]
    if (node.type === "heading" && node.depth === 1) {
      const text = getTextContent(node.children).toLowerCase()
      if (text.includes("appendix")) {
        return i
      }
    }
  }
  return tree.children.length
}

/**
 * Creates MDAST nodes for the Citation section.
 */
export function createCitationNodes(bibtexContent: string): RootContent[] {
  const heading: Heading = {
    type: "heading",
    depth: 1,
    children: [{ type: "text", value: "Citation" } as Text],
  }
  const codeBlock: Code = {
    type: "code",
    lang: "bibtex",
    value: bibtexContent.trim(),
  }
  return [heading, codeBlock]
}

interface BibtexOptions {
  baseUrl?: string
}

/**
 * Transformer that adds a BibTeX citation block to articles with createBibtex: true.
 * Inserts before the first "Appendix" h1 or at the end of the document.
 * Uses MDAST so the code block flows through rehype-pretty-code for syntax highlighting.
 */
export const Bibtex: QuartzTransformerPlugin<BibtexOptions> = (opts?: BibtexOptions) => {
  const baseUrl = opts?.baseUrl ?? "turntrout.com"

  return {
    name: "BibtexTransformer",
    markdownPlugins() {
      return [
        () => (tree: Root, file: VFile) => {
          const frontmatter = file.data.frontmatter
          if (!frontmatter?.createBibtex) {
            return
          }

          const slug = file.data.slug ?? ""
          const bibtexContent = generateBibtexEntry(frontmatter, baseUrl, slug)
          const insertIndex = findInsertionIndex(tree)
          const citationNodes = createCitationNodes(bibtexContent)

          tree.children.splice(insertIndex, 0, ...citationNodes)
        },
      ]
    },
  }
}
