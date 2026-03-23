import { type ContentDetails } from "../../plugins/emitters/contentIndex"
import { type FullSlug, resolveRelative, getFullSlug } from "../../util/path"

declare global {
  function getContentIndex(): Promise<{ [key: string]: ContentDetails }>
}

/** Slugs to exclude from random selection (non-post pages). */
const EXCLUDED_SLUG_PREFIXES = ["tags/", "404"]
const EXCLUDED_SLUGS = new Set(["index", "posts", "about", "research", "open-source", "design"])

function isPost(slug: string): boolean {
  if (EXCLUDED_SLUGS.has(slug)) return false
  return !EXCLUDED_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))
}

export function setupRandomPost(): void {
  const link = document.getElementById("random-post-link") as HTMLButtonElement | null
  if (!link) return

  link.removeEventListener("click", handleRandomPost)
  link.addEventListener("click", handleRandomPost)
}

async function handleRandomPost(event: Event): Promise<void> {
  event.preventDefault()

  const data = await getContentIndex()
  const postSlugs = Object.keys(data).filter(isPost)
  if (postSlugs.length === 0) return

  const currentSlug = getFullSlug(window)
  // Avoid navigating to the current page
  const candidates = postSlugs.length > 1 ? postSlugs.filter((s) => s !== currentSlug) : postSlugs

  const randomSlug = candidates[Math.floor(Math.random() * candidates.length)] as FullSlug
  const targetUrl = new URL(resolveRelative(currentSlug, randomSlug), window.location.toString())
  await window.spaNavigate(targetUrl)
}
