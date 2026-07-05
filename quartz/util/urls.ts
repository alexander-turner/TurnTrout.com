/**
 * URL canonicalization shared by build-time link processing and
 * browser-bundled client scripts. Must stay free of node imports so esbuild
 * can bundle it with `platform: "browser"`.
 */

/**
 * Canonical URL form that link manifests are keyed by. Uses the WHATWG `new
 * URL` parser, then forces `https`, drops a single trailing `/`, and drops the
 * `#fragment` while keeping the query. The archive writer
 * (`scripts/archive_links.py`) mirrors this with the `ada-url` binding — the
 * same `ada` C++ parser Node uses — so the key it emits and the key looked up
 * here are byte-identical.
 *
 * @throws if `href` is not a parseable absolute URL.
 */
export function canonicalizeUrl(href: string): string {
  const url = new URL(href)
  let pathname = url.pathname
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1)
  }
  return `https://${url.host}${pathname}${url.search}`
}
