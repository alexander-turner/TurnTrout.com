/** Slugs to exclude from random selection (non-post pages). */
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
  var btn = e.target.closest("#random-post-link");
  if (!btn) return;
  e.preventDefault();
  var data = await getContentIndex();
  if (!data) return;
  var excluded = new Set(${JSON.stringify([...EXCLUDED_SLUGS])});
  var prefixes = ${JSON.stringify(EXCLUDED_SLUG_PREFIXES)};
  var posts = Object.keys(data).filter(function(s) {
    return !excluded.has(s) && !prefixes.some(function(p) { return s.startsWith(p) });
  });
  if (posts.length <= 1) { console.error("[randomPost] Not enough posts:", posts.length); return; }
  var current = document.body.dataset.slug;
  var candidates = posts.filter(function(s) { return s !== current });
  var slug = candidates[Math.floor(Math.random() * candidates.length)];
  var url = new URL("/" + slug, location.origin);
  window.spaNavigate ? window.spaNavigate(url) : location.assign(url);
})`
