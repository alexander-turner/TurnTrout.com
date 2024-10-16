import { QuartzTransformerPlugin } from "../types"
import { replaceRegex, fractionRegex, numberRegex } from "./utils"
import assert from "assert"
import { Element, Text, Root, Parent, ElementContent } from "hast"
import { visit } from "unist-util-visit"
import { Transformer } from "unified"

/**
 * Flattens text nodes in an element tree
 * @returns An array of Text nodes
 */
export function flattenTextNodes(
  node: Element | ElementContent,
  ignoreNode: (n: Element) => boolean,
): Text[] {
  if (ignoreNode(node as Element)) {
    return []
  }

  if (node.type === "text") {
    return [node as Text]
  }

  if (node.type === "element" && "children" in node) {
    return node.children.flatMap((child) => flattenTextNodes(child, ignoreNode))
  }

  // For other node types (like comments), return an empty array
  return []
}

/**
 * Extracts text content from an element
 * @returns The extracted text content
 */
export function getTextContent(
  node: Element,
  ignoreNodeFn: (n: Element) => boolean = () => false,
): string {
  return flattenTextNodes(node, ignoreNodeFn)
    .map((n) => n.value)
    .join("")
}

/**
 * Checks for matching smart quotes
 * @throws An error if quotes are mismatched
 */
export function assertSmartQuotesMatch(input: string): void {
  if (!input) return

  const quoteMap: Record<string, string> = { "”": "“", "“": "”" }
  const stack: string[] = []

  for (const char of input) {
    if (char in quoteMap) {
      if (stack.length > 0 && quoteMap[stack[stack.length - 1]] === char) {
        stack.pop()
      } else {
        stack.push(char)
      }
    }
  }

  assert.strictEqual(stack.length, 0, `Mismatched quotes in ${input}`)
}

export const markerChar = "\uE000"
const chr = markerChar
/* Sometimes I want to transform the text content of a paragraph (e.g.
by adding smart quotes). But that paragraph might contain multiple child
elements. If I transform each of the child elements individually, the
transformation might fail or be mangled. For example, consider the
literal string "<em>foo</em>" The transformers will see '"', 'foo', and
'"'. It's then impossible to know how to transform the quotes.

This function allows applying transformations to the text content of a
paragraph, while preserving the structure of the paragraph. 
  1. Append a private-use unicode char to end of each child's text content.  
  2. Take text content of the whole paragraph and apply
    transform to it
  3. Split the transformed text content by the unicode char, putting
    each fragment back into the corresponding child node. 
  4. Assert that stripChar(transform(textContentWithChar)) =
    transform(stripChar(textContent)) as a sanity check, ensuring
    transform is invariant to our choice of character. 
  
  NOTE/TODO this function is, in practice, called multiple times on the same
  node via its parent paragraphs. Beware non-idempotent transforms.
  */
/**
 * Applies transformations to element text content
 */
export function transformElement(
  node: Element,
  transform: (input: string) => string,
  ignoreNodeFn: (input: Element) => boolean = () => false,
  checkTransformInvariance = true,
): void {
  if (!node?.children) {
    throw new Error("Node has no children")
  }
  // Append markerChar and concatenate all text nodes
  const textNodes = flattenTextNodes(node, ignoreNodeFn)
  const markedContent = textNodes.map((n) => n.value + markerChar).join("")

  const transformedContent = transform(markedContent)

  // Split and overwrite. Last fragment is always empty because strings end with markerChar
  const transformedFragments = transformedContent.split(markerChar).slice(0, -1)

  if (transformedFragments.length !== textNodes.length) {
    throw new Error("Transformation altered the number of text nodes")
  }

  textNodes.forEach((n, index) => {
    n.value = transformedFragments[index]
  })

  if (checkTransformInvariance) {
    const strippedContent = markedContent.replace(markerChar, "")
    const strippedTransformed = transformedContent.replace(markerChar, "")
    assert.strictEqual(transform(strippedContent), strippedTransformed)
  }
}

/**
 * Replaces quotes with smart quotes
 * @returns The text with smart quotes
 */
export function niceQuotes(text: string) {
  // Single quotes //
  // Ending comes first so as to not mess with the open quote (which
  // happens in a broader range of situations, including e.g. 'sup)
  const endingSingle = `(?<=[^\\s“'])['](?!=')(?=${chr}?(?:s${chr}?)?(?:[\\s.!?;,\\)—\\-]|$))`
  text = text.replace(new RegExp(endingSingle, "gm"), "’")
  // Contractions are sandwiched between two letters
  const contraction = `(?<=[A-Za-z]${chr}?)['](?=${chr}?[a-zA-Z])`
  text = text.replace(new RegExp(contraction, "gm"), "’")

  // Beginning single quotes
  const beginningSingle = `((?:^|[\\s“"])${chr}?)['](?=${chr}?\\S)`
  text = text.replace(new RegExp(beginningSingle, "gm"), "$1‘")

  const beginningDouble = new RegExp(
    `(?<=^|\\s|[\\(\\/\\[\\{\\-—]|${chr})(${chr}?)["](${chr}?)(?=\\.{3}|[^\\s\\)\\—,!?${chr};:/.\\}])`,
    "gm",
  )
  text = text.replace(beginningDouble, "$1“$2")
  // Open quote after brace (generally in math mode)
  text = text.replace(new RegExp(`(?<=\\{)(${chr}? )?["]`, "g"), "$1“")

  // note: Allowing 2 chrs in a row
  const endingDouble = `([^\\s\\(])["](${chr}?)(?=${chr}|[\\s/\\).,;—:\\-\\}!?]|$)`
  text = text.replace(new RegExp(endingDouble, "g"), "$1”$2")

  // If end of line, replace with right double quote
  text = text.replace(new RegExp(`["](${chr}?)$`, "g"), "”$1")
  // If single quote has a right double quote after it, replace with right single and then double
  text = text.replace(new RegExp(`'(?=”)`, "g"), "’")

  // Periods inside quotes
  const periodRegex = new RegExp(`(?<![!?])(${chr}?)([’”])(${chr}?)(?!\\.\\.\\.)\\.`, "g")
  text = text.replace(periodRegex, "$1.$2$3")

  // Commas outside of quotes
  const commaRegex = new RegExp(`(?<![!?]),(${chr}?[”’])`, "g")
  text = text.replace(commaRegex, "$1,")

  return text
}

// Give extra breathing room to slashes with full-width slashes
/**
 * Replaces slashes with full-width slashes
 * @returns The text with full-width slashes
 */
export function fullWidthSlashes(text: string): string {
  const slashRegex = new RegExp(
    `(?<![\\d/])(${chr}?)[ ](${chr}?)/(${chr}?)[ ](${chr}?)(?=[^\\d/])`,
    "g",
  )
  return text.replace(slashRegex, "$1$2 ／$3$4")
}

// Number ranges should use en dashes, not hyphens.
//  Allows for page numbers in the form "p.206-207"
/**
 * Replaces hyphens with en dashes in number ranges
 * @returns The text with en dashes in number ranges
 */
export function enDashNumberRange(text: string): string {
  return text.replace(
    new RegExp(`\\b(?<!\\.)((?:p\\.?)?\\d+${chr}?)-(${chr}?\\d+)(?!\\.)\\b`, "g"),
    "$1–$2",
  )
}

/**
 * Replaces various dash types with appropriate alternatives
 * @returns The text with improved dash usage
 */
export function hyphenReplace(text: string) {
  // Handle dashes with potential spaces and optional marker character
  //  Being right after chr is a sufficient condition for being an em
  //  dash, as it indicates the start of a new line
  const preDash = new RegExp(`((?<markerBeforeTwo>${chr}?)[ ]+|(?<markerBeforeThree>${chr}))`)
  // Want eg " - " to be replaced with "—"
  const surroundedDash = new RegExp(
    `(?<=[^\\s>]|^)${preDash.source}[~–—-]+[ ]*(?<markerAfter>${chr}?)[ ]+`,
    "g",
  )

  // Replace surrounded dashes with em dash
  text = text.replace(surroundedDash, `$<markerBeforeTwo>$<markerBeforeThree>—$<markerAfter>`)

  // "Since--as you know" should be "Since—as you know"
  const multipleDashInWords = new RegExp(
    `(?<=[A-Za-z\\d])(?<markerBefore>${chr}?)[~–—-]{2,}(?<markerAfter>${chr}?)(?=[A-Za-z\\d])`,
    "g",
  )
  text = text.replace(multipleDashInWords, "$<markerBefore>—$<markerAfter>")

  // Handle dashes at the start of a line
  text = text.replace(new RegExp(`^(${chr})?[-]+ `, "gm"), "$1— ")

  // Create a regex for spaces around em dashes, allowing for optional spaces around the em dash
  const spacesAroundEM = new RegExp(
    `(?<markerBefore>${chr}?)[ ]*—[ ]*(?<markerAfter>${chr}?)[ ]*`,
    "g",
  )
  // Remove spaces around em dashes
  text = text.replace(spacesAroundEM, "$<markerBefore>—$<markerAfter>")

  // Handle special case after quotation marks
  const postQuote = new RegExp(`(?<quote>[.!?]${chr}?['"’”]${chr}?|…)${spacesAroundEM.source}`, "g")
  text = text.replace(postQuote, "$<quote> $<markerBefore>—$<markerAfter> ")

  // Handle em dashes at the start of a line
  const startOfLine = new RegExp(`^${spacesAroundEM.source}(?<after>[A-Z0-9])`, "gm")
  text = text.replace(startOfLine, "$<markerBefore>—$<markerAfter> $<after>")

  text = enDashNumberRange(text)

  return text
}

// Not used in the plugin, but useful for other purposes
/**
 * Applies multiple text transformations
 * @returns The transformed text
 */
export function applyTextTransforms(text: string): string {
  text = text.replace(/\u00A0/g, " ") // Replace non-breaking spaces
  text = massTransformText(text)
  text = niceQuotes(text)
  text = fullWidthSlashes(text)
  text = hyphenReplace(text)
  text = enDashNumberRange(text)
  text = plusToAmpersand(text)
  text = neqConversion(text)
  try {
    assertSmartQuotesMatch(text)
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(e.message)
    }
  }

  return text
}

const ACCEPTED_PUNCTUATION = [".", ",", "!", "?", ";", ":", "`", "”", '"']
const TEXT_LIKE_TAGS = ["p", "em", "strong", "b"]
const LEFT_QUOTES = ['"', "“", "‘"]

function getFirstTextNode(node: Parent): Text | null {
  if (!node) return null
  if (node.type === "text") {
    return node as unknown as Text
  } else if (node.children && node.children.length > 0 && node.children[0].type === "text") {
    return node.children[0] as unknown as Text
  } else {
    return null
  }
}

/**
 * Moves punctuation inside links and handles quotation marks before links.
 *
 * @param node - The current node being processed
 * @param index - The index of the current node in its parent's children array
 * @param parent - The parent node of the current node
 *
 * This function performs the following steps:
 * 1. Validates input parameters
 * 2. Identifies the link node
 * 3. Handles quotation marks before the link
 * 4. Identifies the text node after the link
 * 5. Moves acceptable punctuation from after the link to inside it
 */
export const rearrangeLinkPunctuation = (
  node: Element,
  index: number | undefined,
  parent: Element,
) => {
  if (index === undefined || !parent) {
    return
  }

  // Identify the link node
  let linkNode
  if (node?.tagName === "a") {
    linkNode = node
  } else if (node?.children && node.children.length > 0) {
    const lastChild = node.children[node.children.length - 1]
    if ("tagName" in lastChild && lastChild.tagName === "a") {
      linkNode = lastChild
    } else {
      return // No link nearby
    }
  } else {
    return // No link nearby
  }

  // Skip footnote links
  const href = linkNode.properties?.href
  if (typeof href === "string" && href.startsWith("#user-content-fn-")) {
    return
  }

  // Handle quotation marks before the link
  const prevNode = parent.children[index - 1]
  if (prevNode?.type === "text" && LEFT_QUOTES.includes(prevNode.value.slice(-1))) {
    const quoteChar = prevNode.value.slice(-1)
    prevNode.value = prevNode.value.slice(0, -1)

    const firstTextNode: Text | null = getFirstTextNode(linkNode)
    if (firstTextNode && firstTextNode?.type === "text") {
      firstTextNode.value = quoteChar + firstTextNode.value
    } else {
      // No text node found in linkNode
      // Create new text node as first child of linkNode
      const newTextNode = { type: "text", value: quoteChar }

      linkNode.children.unshift(newTextNode as ElementContent)
    }
  }

  // Identify the text node after the link
  const sibling = parent.children[index + 1]
  let textNode

  if (sibling && "type" in sibling) {
    const hasAttrs = "tagName" in sibling && "children" in sibling
    if (sibling.type === "text") {
      textNode = sibling
    } else if (
      hasAttrs &&
      TEXT_LIKE_TAGS.includes(sibling.tagName) &&
      sibling.children.length > 0
    ) {
      textNode = sibling.children[0]
    }
  }

  if (!textNode || !("value" in textNode) || !textNode.value) {
    return
  }

  // Move acceptable punctuation from after the link to inside it
  let firstChar = textNode.value.charAt(0)
  if (linkNode.children[linkNode.children.length - 1]?.type !== "text") {
    linkNode.children.push({ type: "text", value: "" })
  }
  const lastChild = linkNode.children[linkNode.children.length - 1]
  if (!("value" in lastChild)) {
    return
  }
  while (ACCEPTED_PUNCTUATION.includes(firstChar) && textNode.value.length > 0) {
    lastChild.value = lastChild.value + firstChar
    textNode.value = textNode.value.slice(1) // Remove the first char
    firstChar = textNode.value.charAt(0) // Get the next char
  }
}

export function neqConversion(text: string): string {
  return text.replace(/!=/g, "≠")
}

export function plusToAmpersand(text: string): string {
  const sourcePattern = `(?<=[a-zA-Z])\\+(?=[a-zA-Z])`
  const result = text.replace(new RegExp(sourcePattern, "g"), " \u0026 ")
  return result
}

const massTransforms: [RegExp | string, string][] = [
  [/\b(?:i\.i\.d\.|iid)/gi, "IID"],
  [/\b([Cc])afe\b/g, "$1afé"],
  [/\b([Cc])liche\b/g, "$1liché"],
  [/\b([Ee])xpose\b/g, "$1xposé"],
  [/\b([Dd])eja vu\b/g, "$1éjà vu"],
  [/\b([Nn])aive/g, "$1aïve"],
  [/\b([Dd])ojo/g, "$1ōjō"],
  [`(${numberRegex.source})[x\\*]\\b`, "$1×"], // Pretty multiplier
  [/\b(\d+)x(\d+)\b/g, "$1×$2"], // Multiplication sign
]

export function massTransformText(text: string): string {
  for (const [pattern, replacement] of massTransforms) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "g")
    text = text.replace(regex, replacement)
  }
  return text
}

// Node-skipping predicates //
/**
 *  Check for ancestors satisfying certain criteria
 */
export interface ElementMaybeWithParent extends Element {
  parent: ElementMaybeWithParent | null
}

export function hasAncestor(
  node: ElementMaybeWithParent,
  ancestorPredicate: (anc: Element) => boolean,
): boolean {
  let ancestor: ElementMaybeWithParent | null = node

  while (ancestor) {
    if (ancestorPredicate(ancestor)) {
      return true
    }
    ancestor = ancestor.parent
  }

  return false
}

function isCode(node: Element): boolean {
  return node.tagName === "code"
}

/**
 * Sets the data-first-letter attribute for the first paragraph in an article
 */
export function setFirstLetterAttribute(tree: Root): void {
  // Find the first paragraph in the article
  const firstParagraph = tree.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "p",
  )

  if (!firstParagraph) {
    return
  }

  const firstLetter = getTextContent(firstParagraph).charAt(0)
  firstParagraph.properties = firstParagraph.properties || {}
  firstParagraph.properties["data-first-letter"] = firstLetter

  // If the first letter is an apostrophe, add a space before it
  const secondLetter = getTextContent(firstParagraph).charAt(1)
  if (secondLetter === "'" || secondLetter === "'") {
    const firstTextNode = firstParagraph.children.find(
      (child): child is Text => child.type === "text",
    )
    if (firstTextNode) {
      firstTextNode.value = firstLetter + " " + firstTextNode.value.slice(1)
    }
  }
}

// Main function //
// Note: Assumes no nbsp
/**
 * Main plugin function for applying formatting improvements
 * @returns A unified plugin
 */

interface Options {
  skipFirstLetter?: boolean // Debug flag
}

function toSkip(node: Element): boolean {
  if (node.type === "element") {
    const elementNode = node as ElementMaybeWithParent
    return ["code", "script", "style"].includes(elementNode.tagName)
  } else {
    return false
  }
}

export const improveFormatting = (options: Options = {}): Transformer<Root, Root> => {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      // A direct transform, instead of on the children of a <p> element
      if (
        node.type === "text" &&
        node.value &&
        !hasAncestor(parent as ElementMaybeWithParent, isCode)
      ) {
        replaceRegex(
          node,
          index as number,
          parent as Parent,
          fractionRegex,
          (match: RegExpMatchArray) => {
            return {
              before: "",
              replacedMatch: match[0],
              after: "",
            }
          },
          (
            _nd: unknown,
            _idx: number,
            prnt: Parent & { properties?: { className?: string } },
          ): boolean => {
            const className = prnt.properties?.className
            return !!(className?.includes("fraction") || className?.includes("no-fraction"))
          },
          "span.fraction",
        )
      }

      rearrangeLinkPunctuation(node as Element, index, parent as Element)
      // Parent-less nodes are the root of the article
      if ((!parent || !("tagName" in parent)) && node.type === "element") {
        transformElement(node, hyphenReplace, toSkip, false)
        transformElement(node, niceQuotes, toSkip, false)
        for (const transform of [
          neqConversion,
          enDashNumberRange,
          plusToAmpersand,
          massTransformText,
        ]) {
          transformElement(node, transform, toSkip, true)
        }

        try {
          assertSmartQuotesMatch(getTextContent(node))
        } catch {
          // Ignore errors
        }
        // Don't replace slashes in fractions, but give breathing room
        // to others
        const slashPredicate = (n: Element) => {
          if (typeof n.properties.className === "string") {
            return !n.properties.className.includes("fraction") && n?.tagName !== "a"
          } else {
            return false
          }
        }
        if (slashPredicate(node)) {
          transformElement(node, fullWidthSlashes, toSkip)
        }
      }
    })

    // If skipFirstLetter is not set, or it's set but false, set the attribute
    if (!("skipFirstLetter" in options) || !options.skipFirstLetter) {
      setFirstLetterAttribute(tree)
    }
  }
}

export const HTMLFormattingImprovement: QuartzTransformerPlugin = () => {
  return {
    name: "htmlFormattingImprovement",
    htmlPlugins() {
      return [improveFormatting]
    },
  }
}
