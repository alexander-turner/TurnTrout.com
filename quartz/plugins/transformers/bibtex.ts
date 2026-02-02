import type { Element, Root } from "hast"

import Cite from "citation-js"
import { h } from "hastscript"
import humanparser from "humanparser"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { QuartzTransformerPlugin } from "../types"
import type { FrontmatterData } from "../vfile"

import { troutContainerId } from "./trout_hr"

/**
 * Cache for storing generated BibTeX content, keyed by slug.
 * Populated during transform phase, accessed during emit phase by populateContainers.
 */
const bibtexCache = new Map<string, string>()

/**
 * Gets the cached BibTeX content for a given slug.
 * @param slug - The slug of the page
 * @returns The BibTeX content, or undefined if not found
 */
export function getBibtexForSlug(slug: string): string | undefined {
  return bibtexCache.get(slug)
}

/**
 * Clears the bibtex cache. Used primarily for testing.
 */
export function clearBibtexCache(): void {
  bibtexCache.clear()
}

// skipcq: JS-D1001
export function isBibtexCachePopulated(): boolean {
  return bibtexCache.size > 0
}

/**
 * Parses a single author name into CSL-JSON author format using humanparser.
 * Handles edge cases like compound surnames (van Beethoven), suffixes (Jr., III), etc.
 */
function parseAuthorName(authorName: string): { given?: string; family: string } {
  const trimmed = authorName.trim()
  if (!trimmed) {
    return { family: "Unknown" }
  }

  const parsed = humanparser.parseName(trimmed)

  // Handle single-word names (e.g., "Madonna") where humanparser puts it in firstName
  if (!parsed.lastName) {
    return { family: parsed.firstName || "Unknown" }
  }

  // Construct given name from firstName and middleName
  const givenParts = [parsed.firstName, parsed.middleName].filter(Boolean)
  const given = givenParts.length > 0 ? givenParts.join(" ") : undefined

  return { given, family: parsed.lastName }
}

/**
 * Parses an array of author names into CSL-JSON author format.
 */
export function parseAuthors(authors: string[]): Array<{ given?: string; family: string }> {
  return authors.map(parseAuthorName)
}

/**
 * Generates a BibTeX entry for an article using citation.js.
 * @throws Error if date_published is not present in frontmatter
 */
export function generateBibtexEntry(
  frontmatter: FrontmatterData,
  baseUrl: string,
  slug: string,
): string {
  const title = frontmatter.title
  const authors = frontmatter.authors ?? ["Alex Turner"]

  // Require publication date (only enforce on CI to allow local development)
  const datePublished = frontmatter.date_published
  if (!datePublished && process.env.CI) {
    throw new Error(`date_published is required for BibTeX generation (slug: ${slug})`)
  }

  // Use current date as fallback for local development
  const date = datePublished ? new Date(datePublished as string | Date) : new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // CSL uses 1-indexed months

  // Generate URL from permalink or slug
  const permalink = frontmatter.permalink as string | undefined
  const url = `https://${baseUrl}/${permalink ?? slug}`

  // Create CSL-JSON entry - citation.js generates the citation key automatically
  const cslEntry = {
    type: "webpage",
    title,
    author: parseAuthors(authors),
    issued: { "date-parts": [[year, month]] },
    URL: url,
  }

  // Convert to BibTeX using citation.js
  const cite = new Cite(cslEntry)
  let bibtex = cite.format("bibtex", { format: "text" })

  // Strip citation.js's aggressive title-case protection braces
  // It wraps every capitalized word like {Word} which is noisy for non-LaTeX use
  bibtex = bibtex.replace(/title = \{(?<titleContent>.+)\}/s, (_match, titleContent: string) => {
    // Remove protective braces around single words: {Word} → Word
    const cleaned = titleContent.replace(/\{(?<word>\w+)\}/g, "$<word>")
    return `title = {${cleaned}}`
  })

  return bibtex
}

/**
 * Creates a BibTeX details block element for displaying citation information.
 * This helper is shared between the transformer and the populateContainers emitter.
 */
export function createBibtexDetailsBlock(bibtexContent: string): Element {
  return h("details", { class: "bibtex-citation" }, [
    h("summary", "Cite this article (BibTeX)"),
    h("pre", [h("code", { class: "language-bibtex" }, bibtexContent)]),
  ])
}

/**
 * Finds the trout ornament element and its parent in the tree.
 * @returns Object containing the parent element and the index of the ornament
 * @throws Error if the ornament is not found
 */
function findOrnamentLocation(tree: Root): { parent: Root; index: number } {
  let result: { parent: Root; index: number } | null = null

  visit(tree, "element", (node: Element, index, parent) => {
    if (
      node.tagName === "div" &&
      node.properties?.id === troutContainerId &&
      parent?.type === "root" &&
      index !== undefined
    ) {
      result = { parent, index }
      return false // Stop traversing
    }
    return true
  })

  if (!result) {
    throw new Error(`Trout ornament with id "${troutContainerId}" not found in tree`)
  }

  return result
}

/**
 * Inserts a BibTeX code block with a "Citation" heading before the trout ornament.
 * @throws Error if the trout ornament is not found in the tree
 */
export function insertBibtexBeforeOrnament(tree: Root, bibtexContent: string): void {
  const { parent, index } = findOrnamentLocation(tree)

  const citationHeading = h("h1", "Citation")
  const bibtexBlock = createBibtexDetailsBlock(bibtexContent)

  parent.children.splice(index, 0, citationHeading, bibtexBlock)
}

/**
 * Transforms the AST to add a BibTeX citation block before the trout ornament.
 * Also caches the BibTeX content for later use by populateContainers.
 */
function bibtexTransform(tree: Root, file: VFile, baseUrl: string) {
  const frontmatter = file.data.frontmatter

  if (!frontmatter?.createBibtex) {
    return
  }

  const slug = file.data.slug ?? ""
  const bibtexContent = generateBibtexEntry(frontmatter, baseUrl, slug)

  // Cache for populateContainers to use later
  bibtexCache.set(slug, bibtexContent)

  insertBibtexBeforeOrnament(tree, bibtexContent)
}

interface BibtexOptions {
  baseUrl?: string
}

// skipcq: JS-D1001
export const Bibtex: QuartzTransformerPlugin<BibtexOptions> = (opts?: BibtexOptions) => {
  const baseUrl = opts?.baseUrl ?? "turntrout.com"

  return {
    name: "BibtexTransformer",
    htmlPlugins: () => [() => (tree: Root, file: VFile) => bibtexTransform(tree, file, baseUrl)],
  }
}
