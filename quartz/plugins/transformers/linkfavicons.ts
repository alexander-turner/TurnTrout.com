import { visit } from "unist-util-visit"
import { createLogger } from "./logger_utils"
import { Readable } from "stream"
import fs from "fs"
import path from "path"
const logger = createLogger("linkfavicons")

export const MAIL_PATH = "https://assets.turntrout.com/static/images/mail.svg"
export const TURNTROUT_FAVICON_PATH =
  "https://assets.turntrout.com/static/images/turntrout-favicons/favicon.ico"
const QUARTZ_FOLDER = "quartz"
const FAVICON_FOLDER = "static/images/external-favicons"
export const DEFAULT_PATH = ""
export const FAVICON_URLS_FILE =
  "/Users/turntrout/Downloads/turntrout.com/quartz/plugins/transformers/.faviconUrls.txt"
export class DownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DownloadError"
  }
}

/**
 * Downloads an image from a given URL and saves it to the specified local path.
 *
 * @param url - The URL of the image to download.
 * @param imagePath - The local file path where the image should be saved.
 * @returns A Promise that resolves to true if the download was successful. Otherwise, it throws a DownloadError.
 */
export async function downloadImage(url: string, imagePath: string): Promise<Boolean> {
  logger.info(`Attempting to download image from ${url} to ${imagePath}`)
  const response = await fetch(url)

  if (!response.ok) {
    throw new DownloadError(`Failed to fetch image: ${url}. Status: ${response.status}`)
  }

  const contentType = response.headers.get("content-type")
  if (!contentType || !contentType.startsWith("image/")) {
    throw new DownloadError(`URL does not point to an image: ${url}. Content-Type: ${contentType}`)
  }

  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) === 0) {
    throw new DownloadError(`Empty image file: ${url}`)
  }

  if (!response.body) {
    throw new DownloadError(`No response body: ${url}`)
  }

  const body = Readable.fromWeb(response.body as any)

  await fs.promises.writeFile(imagePath, body)

  const stats = await fs.promises.stat(imagePath)

  if (stats.size === 0) {
    await fs.promises.unlink(imagePath)
    throw new DownloadError(`Downloaded file is empty: ${imagePath}`)
  }

  logger.info(`Successfully downloaded image to ${imagePath}`)
  return true
}

/**
 * Generates a Quartz-compatible path for a given hostname.
 *
 * @param hostname - The hostname to generate the path for.
 * @returns A string representing the Quartz path for the favicon.
 */
export function GetQuartzPath(hostname: string): string {
  logger.debug(`Generating Quartz path for hostname: ${hostname}`)
  hostname = hostname === "localhost" ? "turntrout.com" : hostname.replace(/^www\./, "")
  const sanitizedHostname = hostname.replace(/\./g, "_")
  const path = sanitizedHostname.includes("turntrout_com")
    ? TURNTROUT_FAVICON_PATH
    : `/${FAVICON_FOLDER}/${sanitizedHostname}.png`
  logger.debug(`Generated Quartz path: ${path}`)
  return path
}

const defaultCache = new Map<string, string>([[TURNTROUT_FAVICON_PATH, TURNTROUT_FAVICON_PATH]])
export function createUrlCache(): Map<string, string> {
  return new Map(defaultCache)
}
export let urlCache = createUrlCache()
const faviconUrls = await readFaviconUrls()
for (const [basename, url] of faviconUrls) {
  if (!urlCache.has(basename)) {
    urlCache.set(basename, url)
  }
}

/**
 * Writes the favicon cache to the FAVICON_URLS_FILE.
 */
export function writeCacheToFile(): void {
  const data = Array.from(urlCache.entries())
    .map(([key, value]) => `${key},${value}`)
    .join("\n")

  // Ensure the directory exists
  const dir = path.dirname(FAVICON_URLS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Write the file
  fs.writeFileSync(FAVICON_URLS_FILE, data)
}

/**
 * Reads favicon URLs from the FAVICON_URLS_FILE and returns them as a Map.
 *
 * @returns A Promise that resolves to a Map of basename to URL strings.
 */
export async function readFaviconUrls(): Promise<Map<string, string>> {
  try {
    const data = await fs.promises.readFile(FAVICON_URLS_FILE, "utf8")
    const lines = data.split("\n")
    const urlMap = new Map<string, string>()
    for (const line of lines) {
      const [basename, url] = line.split(",")
      if (basename && url) {
        urlMap.set(basename, url)
      }
    }
    return urlMap
  } catch (error) {
    logger.warn(`Error reading favicon URLs file: ${error}`)
    return new Map<string, string>()
  }
}

/**
 * Attempts to find or save a favicon for a given hostname.
 *
 * @param hostname - The hostname to find or save the favicon for.
 * @returns A Promise that resolves to the path of the favicon (local or remote).
 */
export async function MaybeSaveFavicon(hostname: string): Promise<string> {
  logger.info(`Attempting to find or save favicon for ${hostname}`)

  const faviconPath = GetQuartzPath(hostname)

  // Check cache first
  if (urlCache.has(faviconPath)) {
    logger.info(`Returning cached favicon for ${hostname}`)
    return urlCache.get(faviconPath) as string
  }

  // Check for AVIF version
  const avifPath = faviconPath.replace(".png", ".avif")
  const avifUrl = avifPath.startsWith("http") ? avifPath : `https://assets.turntrout.com${avifPath}`

  try {
    const avifResponse = await fetch(avifUrl)
    if (avifResponse.ok) {
      logger.info(`AVIF found for ${hostname}: ${avifUrl}`)
      urlCache.set(faviconPath, avifUrl)
      return avifUrl
    }
  } catch (err) {
    logger.error(`Error checking AVIF on ${avifUrl}. ${err}`)
  }

  // Check for local PNG
  const localPngPath = path.join(QUARTZ_FOLDER, faviconPath)
  try {
    await fs.promises.stat(localPngPath)
    logger.info(`Local PNG found for ${hostname}: ${faviconPath}`)
    urlCache.set(faviconPath, faviconPath)
    return faviconPath
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Try to download from Google
      const googleFaviconURL = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`
      logger.info(`Attempting to download favicon from Google: ${googleFaviconURL}`)
      if (await downloadImage(googleFaviconURL, localPngPath)) {
        logger.info(`Successfully downloaded favicon for ${hostname}`)
        urlCache.set(faviconPath, faviconPath)
        return faviconPath
      }
    }
  }

  // If all else fails, use default
  logger.debug(`Failed to find or download favicon for ${hostname}, using default`)
  urlCache.set(faviconPath, DEFAULT_PATH)
  return DEFAULT_PATH
}

export interface FaviconNode {
  type: string
  tagName: string
  children: Element[]
  properties: {
    src: string
    class: string
    alt: string
    style?: string
  }
}

/**
 * Creates a favicon element (img tag) with the given URL and description.
 *
 * @param urlString - The URL of the favicon image.
 * @param description - The alt text for the favicon (default: "", so that favicons are treated as decoration by screen readers).
 * @returns An object representing the favicon element.
 */
export function CreateFaviconElement(urlString: string, description = ""): FaviconNode {
  logger.debug(`Creating favicon element with URL: ${urlString}`)
  return {
    type: "element",
    tagName: "img",
    children: [],
    properties: {
      src: urlString,
      class: "favicon",
      alt: description,
    },
  }
}

/**
 * Inserts a favicon image into a node's children.
 *
 * @param imgPath - The path to the favicon image.
 * @param node - The node to insert the favicon into.
 */
export function insertFavicon(imgPath: string | null, node: any): void {
  logger.debug(`Inserting favicon: ${imgPath}`)
  if (imgPath === null) {
    logger.debug("No favicon to insert")
    return
  }

  const imgElement = CreateFaviconElement(imgPath)
  const lastChild = node.children[node.children.length - 1]

  if (lastChild && lastChild.type === "text" && lastChild.value) {
    logger.debug(`Last child is text: "${lastChild.value}"`)
    const textContent = lastChild.value
    const toSpace = ["!", "?", "|", "]"] // Glyphs where top-right corner occupied
    if (toSpace.includes(textContent.at(-1))) {
      imgElement.properties.style = "margin-left: 0.05rem;"
    }

    const charsToRead = Math.min(4, textContent.length)
    const lastFourChars = textContent.slice(-charsToRead)
    lastChild.value = textContent.slice(0, -charsToRead)

    const span = {
      type: "element",
      tagName: "span",
      children: [{ type: "text", value: lastFourChars }, imgElement],
      properties: {
        style: "white-space: nowrap;",
      },
    }
    // If the text content is the same as the last four characters,
    // replace the text with the span so we don't have an extra (empty) text node.
    if (lastFourChars === textContent && node.children.length === 1) {
      logger.debug("Replacing entire text with span")
      node.children = [span]
    } else {
      logger.debug("Appending span to existing text")
      node.children.push(span)
    }
  } else {
    logger.debug("Appending favicon directly to node")
    node.children.push(imgElement)
  }
}

/**
 * Modifies a node by processing its href and inserting a favicon if applicable.
 *
 * @param node - The node to modify.
 * @returns A Promise that resolves when the modification is complete.
 */
export async function ModifyNode(node: any): Promise<void> {
  logger.info(`Modifying node: ${node.tagName}`)
  if (node.tagName !== "a" || !node.properties.href) {
    logger.debug("Node is not an anchor or has no href, skipping")
    return
  }

  let href = node.properties.href
  logger.debug(`Processing href: ${href}`)

  if (href.includes("mailto:")) {
    logger.info("Inserting mail icon for mailto link")
    insertFavicon(MAIL_PATH, node)
    return
  }

  const isInternalBody = href.startsWith("#")
  if (isInternalBody) {
    // Append same-page-link to class list
    if (node.properties.className) {
      node.properties.className.push("same-page-link")
    } else {
      node.properties.className = ["same-page-link"]
    }
    return
  }

  const samePage = node.properties.className?.includes("same-page-link")
  const isAsset = /\.(png|jpg|jpeg)$/.test(href)

  if (samePage || isAsset) {
    logger.debug(`Skipping favicon insertion for same-page link or asset: ${href}`)
    return
  }

  if (href.startsWith("./")) {
    logger.debug("Converting relative link to absolute")
    href = href.slice(2)
    href = "https://www.turntrout.com/" + href
  } else if (href.startsWith("..")) {
    logger.debug("Skipping parent directory link")
    return
  }
  try {
    let finalURL = new URL(href)
    logger.info(`Final URL: ${finalURL.href}`)

    const imgPath = await MaybeSaveFavicon(finalURL.hostname)

    // TODO improve semantics on handling no-favicon case
    if (imgPath === DEFAULT_PATH) {
      logger.info(`No favicon found for ${finalURL.hostname}; skipping`)
      return
    }

    logger.info(`Inserting favicon for ${finalURL.hostname}: ${imgPath}`)
    insertFavicon(imgPath, node)
  } catch (error) {
    logger.error(`Error processing URL ${href}: ${error}`)
  }
}

/**
 * Creates a plugin that adds favicons to anchor tags in the HTML tree.
 *
 * @returns An object representing the plugin configuration.
 */
export const AddFavicons = () => {
  return {
    name: "AddFavicons",
    htmlPlugins() {
      return [
        () => {
          return async (tree: any) => {
            logger.info("Starting favicon processing")
            const nodesToProcess: any[] = []

            visit(tree, "element", (node: any) => {
              if (node.tagName === "a" && node.properties.href) {
                logger.debug(`Found anchor node: ${node.properties.href}`)
                nodesToProcess.push(node)
              }
            })

            logger.info(`Processing ${nodesToProcess.length} nodes`)
            await Promise.all(nodesToProcess.map(ModifyNode))
            logger.info("Finished processing favicons")

            writeCacheToFile()
          }
        },
      ]
    },
  }
}
