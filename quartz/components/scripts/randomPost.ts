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

/**
 * Inline script that handles random post navigation via event delegation.
 * Uses getContentIndex() (available from beforeDOMReady inline script).
 * Falls back to location.assign() if spaNavigate isn't loaded yet.
 */
export const randomPostScript = `document.addEventListener("click",async function(e){
var b=e.target&&e.target.closest&&e.target.closest("#random-post-link");
if(!b)return;
e.preventDefault();
var d=await getContentIndex();
if(!d)return;
var x=new Set(["index","posts","about","research","open-source","design","404"]);
var p=Object.keys(d).filter(function(s){return!x.has(s)&&!s.startsWith("tags/")});
if(p.length<=1){console.error("[randomPost] Not enough posts:",p.length);return}
var c=document.body.dataset.slug;
var f=p.filter(function(s){return s!==c});
var s=f[Math.floor(Math.random()*f.length)];
var u=new URL("/"+s,location.origin);
window.spaNavigate?window.spaNavigate(u):location.assign(u);
})`
