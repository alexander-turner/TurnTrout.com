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

/** Generate the inline script from the canonical exclusion lists. */
export const randomPostScript = `document.addEventListener("click", async function(e) {
  const btn = e.target.closest("#random-post-link");
  if (!btn) return;
  e.preventDefault();
  const data = await getContentIndex();
  if (!data) return;
  const excluded = new Set(${JSON.stringify([...EXCLUDED_SLUGS])});
  const prefixes = ${JSON.stringify(EXCLUDED_SLUG_PREFIXES)};
  const posts = Object.keys(data).filter(function(s) {
    return !excluded.has(s) && !prefixes.some(function(p) { return s.startsWith(p) });
  });
  if (posts.length <= 1) { console.error("[randomPost] Not enough posts:", posts.length); return; }
  const current = document.body.dataset.slug;
  const candidates = posts.filter(function(s) { return s !== current });
  const slug = candidates[Math.floor(Math.random() * candidates.length)];
  const url = new URL("/" + slug, location.origin);
  window.spaNavigate ? window.spaNavigate(url) : location.assign(url);
})`
