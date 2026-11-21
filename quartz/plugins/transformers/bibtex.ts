import type { Code, Heading, PhrasingContent, Root, RootContent, Text } from "mdast"

import { VFile } from "vfile"

/** Extracts text content from MDAST phrasing content nodes. */
function getTextContent(children: PhrasingContent[]): string {
  return children.map((child) => (child.type === "text" ? child.value : "")).join("")
}

import type { QuartzTransformerPlugin } from "../types"
import type { FrontmatterData } from "../vfile"

/**
 * Extracts the last name from an author string.
 * Handles "First Last" and "Last, First" formats.
 */
function getLastName(author: string): string {
  if (author.includes(",")) {
    return author.split(",")[0].trim()
  }
  const parts = author.trim().split(/\s+/)
  return parts[parts.length - 1]
}

/**
 * Converts a hyphenated slug to PascalCase.
 * e.g., "shard-theory" → "ShardTheory", "design" → "Design"
 */
function slugToPascalCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}

/**
 * Generates a citation key: LastName + Year + PascalCaseSlug
 */
function generateCitationKey(authors: readonly string[], year: number, slug: string): string {
  const lastName = getLastName(authors[0])
  const pascalSlug = slugToPascalCase(slug)
  return `${lastName}${year}${pascalSlug}`
}

/**
 * Escapes a value for use inside a BibTeX `"…"`-delimited field.
 * Backslashes and double quotes are the only characters with structural
 * meaning inside such a field; we backslash-escape both.
 */
function escapeBibtexValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * The published paper a post announces. When present, the post's citation
 * points readers at the paper rather than at the website.
 */
export interface PaperCitation {
  readonly title: string
  readonly authors: readonly string[]
  readonly year: number
  readonly arxiv: string
  /** Proceedings the paper appeared in; omit for an arXiv-only preprint. */
  readonly booktitle?: string
}

/** Validates the `paper` frontmatter field, throwing on malformed input. */
export function parsePaperCitation(raw: unknown): PaperCitation | undefined {
  if (raw === undefined) {
    return undefined
  }
  const paper = raw as Partial<Record<keyof PaperCitation, unknown>>
  const hasAuthors =
    Array.isArray(paper.authors) &&
    paper.authors.length > 0 &&
    paper.authors.every((author) => typeof author === "string")
  if (
    typeof paper.title !== "string" ||
    !hasAuthors ||
    typeof paper.year !== "number" ||
    typeof paper.arxiv !== "string" ||
    (paper.booktitle !== undefined && typeof paper.booktitle !== "string")
  ) {
    throw new Error(
      `Invalid "paper" frontmatter: expected title, authors, year, and arxiv (plus optional booktitle); got ${JSON.stringify(raw)}`,
    )
  }
  return paper as PaperCitation
}

const AUTHOR_FIELD_PREFIX = '  author = "'

/** Joins authors with BibTeX's required " and ", one author per line. */
function formatAuthors(authors: readonly string[]): string {
  const indent = " ".repeat(AUTHOR_FIELD_PREFIX.length)
  return authors.map(escapeBibtexValue).join(` and\n${indent}`)
}

function formatEntry(
  entryType: string,
  citationKey: string,
  authors: readonly string[],
  fields: readonly (readonly [string, string | number])[],
): string {
  const body = fields.map(([name, value]) =>
    typeof value === "number"
      ? `  ${name} = ${value}`
      : `  ${name} = "${escapeBibtexValue(value)}"`,
  )
  return [
    `@${entryType}{${citationKey},`,
    [`${AUTHOR_FIELD_PREFIX}${formatAuthors(authors)}"`, ...body].join(",\n"),
    "}",
  ].join("\n")
}

function generatePaperEntry(paper: PaperCitation, citationSlug: string): string {
  const citationKey = generateCitationKey(paper.authors, paper.year, citationSlug)
  const url = `https://arxiv.org/abs/${paper.arxiv}`
  if (paper.booktitle) {
    return formatEntry("inproceedings", citationKey, paper.authors, [
      ["title", paper.title],
      ["booktitle", paper.booktitle],
      ["year", paper.year],
      ["url", url],
    ])
  }
  return formatEntry("misc", citationKey, paper.authors, [
    ["title", paper.title],
    ["year", paper.year],
    ["eprint", paper.arxiv],
    ["archivePrefix", "arXiv"],
    ["url", url],
  ])
}

/**
 * Generates a BibTeX entry for an article, or `null` when it has no
 * `date_published`. Undated drafts get no citation: publication-date
 * enforcement lives in source_file_checks (gated to pre-merge PRs), so the
 * build must stay green for an unpublished draft. Posts announcing a paper
 * (`paper` frontmatter) cite the paper instead of the post.
 */
export function generateBibtexEntry(
  frontmatter: FrontmatterData,
  baseUrl: string,
  slug: string,
): string | null {
  const datePublished = frontmatter.date_published
  if (!datePublished) {
    return null
  }

  const permalink = frontmatter.permalink as string | undefined
  const citationSlug = permalink ?? slug

  const paper = parsePaperCitation(frontmatter.paper)
  if (paper) {
    return generatePaperEntry(paper, citationSlug)
  }

  const authors =
    frontmatter.authors && frontmatter.authors.length > 0 ? frontmatter.authors : ["Alex Turner"]
  const year = new Date(datePublished as string | Date).getFullYear()
  const citationKey = generateCitationKey(authors, year, citationSlug)

  return formatEntry("misc", citationKey, authors, [
    ["title", frontmatter.title],
    ["year", year],
    ["url", `https://${baseUrl}/${citationSlug}`],
  ])
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
          if (!bibtexContent) {
            return
          }
          const insertIndex = findInsertionIndex(tree)
          const citationNodes = createCitationNodes(bibtexContent)

          tree.children.splice(insertIndex, 0, ...citationNodes)
        },
      ]
    },
  }
}
