/* eslint-disable react/react-in-jsx-scope */
// (For the data-spa-preserve attribute and React import)

import { randomUUID } from "crypto"
import { JSX } from "preact/jsx-runtime"

export type JSResource = {
  loadTime: "beforeDOMReady" | "afterDOMReady"
  moduleType?: "module"
  spaPreserve?: boolean
} & (
  | {
      src: string
      contentType: "external"
    }
  | {
      script: string
      contentType: "inline"
    }
)

export function JSResourceToScriptElement(resource: JSResource): JSX.Element {
  const toDefer = resource.loadTime === "afterDOMReady"

  if (resource.contentType === "external") {
    const scriptType = resource.moduleType ?? "application/javascript"
    // `type="module"` scripts are deferred by the parser and must not also
    // carry a `defer` attribute; only classic external scripts take `defer`.
    const deferAttr = resource.moduleType === "module" ? false : toDefer
    return (
      <script
        data-spa-preserve
        key={resource.src}
        src={resource.src}
        type={scriptType}
        defer={deferAttr}
      />
    )
  } else {
    const content = resource.script
    // An inline script must not declare a non-JS `type` or a `defer`
    // attribute; `defer` has no effect without `src`, and a module inline
    // script self-defers. `type` is emitted only for modules.
    return (
      <script
        key={randomUUID()}
        {...(resource.moduleType ? { type: resource.moduleType } : {})}
        data-spa-preserve
        // skipcq: JS-0440 -- inline script content is build-time only; no user input reaches this path
        dangerouslySetInnerHTML={{ __html: content }}
      ></script>
    )
  }
}

export interface StaticResources {
  css: string[]
  js: JSResource[]
}
