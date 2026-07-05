import DepGraph from "../../depgraph"
import { type FilePath, type FullSlug, joinSegments } from "../../util/path"
import { annotationsPath, loadLinkAnnotations } from "../transformers/annotateLinks"
import { type QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

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
      const fp = joinSegments("static", "link-annotations") as FullSlug
      return [
        await write({
          ctx,
          content: JSON.stringify(Object.fromEntries(annotations)),
          slug: fp,
          ext: ".json",
        }),
      ]
    },
  }
}
