import { transform as transpile } from "esbuild"
import { Features, transform } from "lightningcss"

// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import popoverScript from "../../components/scripts/popover.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import spaRouterScript from "../../components/scripts/spa.inline"
import popoverStyle from "../../components/styles/popover.scss"
import { type QuartzComponent } from "../../components/types"
import DepGraph from "../../depgraph"
import styles from "../../styles/custom.scss"
import { type BuildCtx } from "../../util/ctx"
import { type FilePath, type FullSlug } from "../../util/path"
import { type QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

type ComponentResources = {
  css: string[]
  beforeDOMLoaded: string[]
  afterDOMLoaded: string[]
}

/**
 * Retrieves all Quartz components and extracts their CSS, `beforeDOMLoaded`, and `afterDOMLoaded` resources.
 *
 * @param ctx The build context.
 * @returns An object containing arrays of CSS, `beforeDOMLoaded`, and `afterDOMLoaded` scripts.
 */
function getComponentResources(ctx: BuildCtx): ComponentResources {
  const allComponents: Set<QuartzComponent> = new Set()
  for (const emitter of ctx.cfg.plugins.emitters) {
    const components = emitter.getQuartzComponents(ctx)
    for (const component of components) {
      allComponents.add(component)
    }
  }

  const componentResources = {
    css: new Set<string>(),
    beforeDOMLoaded: new Set<string>(),
    afterDOMLoaded: new Set<string>(),
  }

  for (const component of allComponents) {
    const { css, beforeDOMLoaded, afterDOMLoaded } = component
    if (css) {
      componentResources.css.add(css)
    }
    if (beforeDOMLoaded) {
      componentResources.beforeDOMLoaded.add(beforeDOMLoaded)
    }
    if (afterDOMLoaded) {
      // Components can declare multiple scripts as an array; each gets its own IIFE in joinScripts
      const scripts = Array.isArray(afterDOMLoaded) ? afterDOMLoaded : [afterDOMLoaded]
      for (const script of scripts) {
        componentResources.afterDOMLoaded.add(script)
      }
    }
  }

  return {
    css: [...componentResources.css],
    beforeDOMLoaded: [...componentResources.beforeDOMLoaded],
    afterDOMLoaded: [...componentResources.afterDOMLoaded],
  }
}

async function joinScripts(scripts: string[], excludeKatex = false): Promise<string> {
  // wrap with iife to prevent scope collision
  const script = scripts.map((script) => `(function () {${script}})();`).join("\n")

  const res = await transpile(script, {
    minify: true,
    define: excludeKatex ? { katex: "{}" } : undefined,
  })

  return res.code
}

/**
 * Adds global page resources such as popovers, analytics scripts (Google Analytics or Umami), and SPA navigation scripts.
 *
 * @param ctx The build context.
 * @param componentResources The object containing component-specific resources to which global resources will be added.
 */
function addGlobalPageResources(ctx: BuildCtx, componentResources: ComponentResources): void {
  const config = ctx.cfg.configuration

  if (config.enablePopovers) {
    componentResources.afterDOMLoaded.push(popoverScript)
    componentResources.css.push(popoverStyle)
  }

  if (config.analytics?.provider === "umami") {
    componentResources.afterDOMLoaded.push(`
      const umamiScript = document.createElement("script")
      umamiScript.src = "${config.analytics.host ?? "https://analytics.umami.is"}/script.js"
      umamiScript.setAttribute("data-website-id", "${config.analytics.websiteId}")
      umamiScript.async = true

      document.head.appendChild(umamiScript)
    `)
  }

  componentResources.afterDOMLoaded.push(spaRouterScript)
}

// This emitter should not update the `resources` parameter. If it does, partial
// rebuilds may not work as expected.
export const ComponentResources: QuartzEmitterPlugin = () => {
  return {
    name: "ComponentResources",
    getQuartzComponents() {
      return []
    },
    // skipcq: JS-0116 for type signature
    async getDependencyGraph() {
      return new DepGraph<FilePath>()
    },
    async emit(ctx): Promise<FilePath[]> {
      const promises: Promise<FilePath>[] = []
      // component specific scripts and styles
      const componentResources = getComponentResources(ctx)

      // important that this goes *after* component scripts
      // as the "nav" event gets triggered here and we should make sure
      // that everyone else had the chance to register a listener for it
      addGlobalPageResources(ctx, componentResources)

      const stylesheet = `${componentResources.css.join("\n\n")}\n\n${styles}`
      const [prescript, postscript] = await Promise.all([
        joinScripts(componentResources.beforeDOMLoaded),
        joinScripts(componentResources.afterDOMLoaded),
      ])

      promises.push(
        write({
          ctx,
          slug: "index" as FullSlug,
          ext: ".css",
          content: transform({
            filename: "index.css",
            code: Buffer.from(stylesheet),
            minify: true,
            targets: {
              safari: (15 << 16) | (6 << 8), // 15.6
              ios_saf: (15 << 16) | (6 << 8), // 15.6
              edge: 115 << 16,
              firefox: 102 << 16,
              chrome: 109 << 16,
            },
            include: Features.MediaQueries,
          }).code.toString(),
        }),
        write({
          ctx,
          slug: "prescript" as FullSlug,
          ext: ".js",
          content: prescript,
        }),
        write({
          ctx,
          slug: "postscript" as FullSlug,
          ext: ".js",
          content: postscript,
        }),
      )

      return await Promise.all(promises)
    },
  }
}
