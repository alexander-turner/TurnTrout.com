/** Slug patterns to exclude from random selection (non-post pages). */
export const EXCLUDED_SLUG_PREFIXES = ["tags/"]
export const EXCLUDED_SLUGS = new Set([
  "index",
  "posts",
  "about",
  "research",
  "open-source",
  "design",
  "404",
])

export function isPost(slug: string): boolean {
  if (EXCLUDED_SLUGS.has(slug)) return false
  return !EXCLUDED_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))
}

export function setupRandomPostLink(): void {
  document.addEventListener("click", async (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest("#random-post-link")
    if (!btn) return
    e.preventDefault()
    const data = await getContentIndex()
    if (!data) return
    const posts = Object.keys(data).filter(isPost)
    if (posts.length <= 1) {
      console.error("[randomPost] Not enough posts:", posts.length)
      return
    }
    const current = document.body.dataset.slug ?? ""
    const candidates = posts.filter((s) => s !== current)
    const slug = candidates[Math.floor(Math.random() * candidates.length)]
    const url = new URL(`/${slug}`, location.origin)
    if (window.spaNavigate) {
      window.spaNavigate(url)
    } else {
      location.assign(url)
    }
  })
}
