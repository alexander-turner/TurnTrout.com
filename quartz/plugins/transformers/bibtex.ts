import type { Element, Root } from "hast"
import { h } from "hastscript"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { QuartzTransformerPlugin } from "../types"
import type { FrontmatterData } from "../vfile"
import { troutContainerId } from "./trout_hr"

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
 * Escapes special LaTeX/BibTeX characters in a string.
 * Uses a placeholder strategy to avoid double-escaping.
 */
export function escapeBibtexString(str: string): string {
  // Use placeholders for complex replacements to avoid double-escaping
  const BACKSLASH_PLACEHOLDER = "\x00BACKSLASH\x00"
  const TILDE_PLACEHOLDER = "\x00TILDE\x00"
  const CARET_PLACEHOLDER = "\x00CARET\x00"

  return (
    str
      // First, replace characters that produce complex sequences with placeholders
      .replace(/\\/g, BACKSLASH_PLACEHOLDER)
      .replace(/~/g, TILDE_PLACEHOLDER)
      .replace(/\^/g, CARET_PLACEHOLDER)
      // Now escape simple characters
      .replace(/[{}]/g, "\\$&")
      .replace(/&/g, "\\&")
      .replace(/%/g, "\\%")
      .replace(/\$/g, "\\$")
      .replace(/#/g, "\\#")
      .replace(/_/g, "\\_")
      // Finally, replace placeholders with their LaTeX equivalents
      .replace(new RegExp(BACKSLASH_PLACEHOLDER, "g"), "\\textbackslash{}")
      .replace(new RegExp(TILDE_PLACEHOLDER, "g"), "\\textasciitilde{}")
      .replace(new RegExp(CARET_PLACEHOLDER, "g"), "\\textasciicircum{}")
  )
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
    `  author = {${escapeBibtexString(author)}},`,
    `  title = {${escapeBibtexString(title)}},`,
    `  year = {${year}},`,
    `  month = ${month},`,
    `  url = {${url}},`,
    `  note = {Accessed: ${new Date().toISOString().split("T")[0]}}`,
    `}`,
  ]

  return lines.join("\n")
}

/**
 * Inserts a BibTeX code block before the trout ornament.
 */
export function insertBibtexBeforeOrnament(tree: Root, bibtexContent: string): boolean {
  let inserted = false

  visit(tree, "element", (node: Element, index, parent: Element | null) => {
    if (
      !inserted &&
      index !== undefined &&
      node.tagName === "div" &&
      node.properties?.id === troutContainerId &&
      parent
    ) {
      const bibtexBlock = h("details", { class: "bibtex-citation" }, [
        h("summary", "Cite this article (BibTeX)"),
        h("pre", [h("code", { class: "language-bibtex" }, bibtexContent)]),
      ])

      parent.children.splice(index, 0, bibtexBlock)
      inserted = true
      return false // Stop traversing
    }
    return true
  })

  return inserted
}

/**
 * Transforms the AST to add a BibTeX citation block before the trout ornament.
 */
function bibtexTransform(tree: Root, file: VFile, baseUrl: string) {
  const frontmatter = file.data.frontmatter

  if (!frontmatter?.createBibtex) {
    return
  }

  const slug = file.data.slug ?? ""
  const bibtexContent = generateBibtexEntry(frontmatter, baseUrl, slug)

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
