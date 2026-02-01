import type { Element, Root } from "hast"

import escapeLatex from "escape-latex"
import { h } from "hastscript"
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

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const

/**
 * Extracts the last name from an author string.
 * Takes the first author (before comma or ampersand), then the last word.
 * @throws Error if author string is empty or contains no valid name
 */
export function extractLastName(author: string): string {
  // split always returns at least one element, so [0] is always defined
  const firstAuthor = author.split(/[,&]/)[0].trim()
  const words = firstAuthor.split(/\s+/).filter((w) => w.length > 0)
  const lastName = words.at(-1)?.toLowerCase()
  if (!lastName) {
    throw new Error("Author name cannot be empty")
  }
  return lastName
}

/**
 * Generates a citation key from the author's last name, year, and title.
 * Example: "turner2022alignmentphd"
 * @throws Error if author is provided but empty
 */
export function generateCitationKey(author: string, year: number, title: string): string {
  const authorPart = extractLastName(author)

  // Convert title to lowercase, remove non-alphanumeric characters, take first 20 chars
  const titlePart = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20)

  return `${authorPart}${year}${titlePart}`
}

/**
 * Generates a BibTeX entry for an article.
 */
export function generateBibtexEntry(
  frontmatter: FrontmatterData,
  baseUrl: string,
  slug: string,
): string {
  const title = frontmatter.title
  const author = (frontmatter.authors as string | undefined) ?? "Alex Turner"

  // Parse date
  const datePublished = frontmatter.date_published
  const date = datePublished ? new Date(datePublished as string | Date) : new Date()
  const year = date.getFullYear()
  const month = MONTH_NAMES[date.getMonth()]

  // Generate URL from permalink or slug
  const permalink = frontmatter.permalink as string | undefined
  const url = `https://${baseUrl}/${permalink ?? slug}`

  // Generate citation key
  const citationKey = generateCitationKey(author, year, title)

  // Build the BibTeX entry
  const lines = [
    `@misc{${citationKey},`,
    `  author = {${escapeLatex(author)}},`,
    `  title = {${escapeLatex(title)}},`,
    `  year = {${year}},`,
    `  month = ${month},`,
    `  url = {${url}},`,
    `  note = {Accessed: ${new Date().toISOString().split("T")[0]}}`,
    "}",
  ]

  return lines.join("\n")
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
  const bibtexBlock = h("details", { class: "bibtex-citation" }, [
    h("summary", "Cite this article (BibTeX)"),
    h("pre", [h("code", { class: "language-bibtex" }, bibtexContent)]),
  ])

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
