import DepGraph from "../../depgraph"
import { LINK_ANNOTATIONS_STATIC_PATH } from "../../util/annotations"
import { type FilePath, type FullSlug } from "../../util/path"
import { annotationsPath, loadLinkAnnotations } from "../transformers/annotateLinks"
import { type QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

// Derived from the client's fetch path so the two cannot drift apart.
const emittedSlug = LINK_ANNOTATIONS_STATIC_PATH.slice(1).replace(/\.json$/, "") as FullSlug

export interface LinkAnnotationsOptions {
  annotationsPath: string
}

/**
 * Publishes the committed link-annotations manifest as same-origin JSON so the
 * popover client can render external-link previews without any cross-origin
 * fetch (the site's CSP `connect-src` forbids those). Validation happens in
 * `loadLinkAnnotations`: a malformed manifest fails the build, a missing one
 * emits an empty object.
 */
export const LinkAnnotations: QuartzEmitterPlugin<Partial<LinkAnnotationsOptions> | undefined> = (
  userOpts,
) => {
  const filePath = userOpts?.annotationsPath ?? annotationsPath

  return {
    name: "LinkAnnotations",
    getQuartzComponents() {
      return []
    },
    getDependencyGraph() {
      return new DepGraph<FilePath>()
    },
    async emit(ctx): Promise<FilePath[]> {
      const annotations = loadLinkAnnotations(filePath)
      return [
        await write({
          ctx,
          content: JSON.stringify(Object.fromEntries(annotations)),
          slug: emittedSlug,
          ext: ".json",
        }),
      ]
    },
  }
}
