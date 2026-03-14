import { describe, expect, it } from "@jest/globals"

import { Latex } from "./latex"

describe("Latex plugin", () => {
  const plugin = Latex()
  const mockCtx = {} as never

  it.each([
    [
      "htmlPlugins includes rehype-katex config",
      () => expect(plugin.htmlPlugins?.(mockCtx) ?? []).toHaveLength(1),
    ],
    [
      "markdownPlugins has one entry",
      () => expect(plugin.markdownPlugins?.(mockCtx) ?? []).toHaveLength(1),
    ],
    [
      "externalResources includes katex CSS",
      () =>
        expect(plugin.externalResources?.(mockCtx)?.css).toContain("/static/styles/katex.min.css"),
    ],
  ])("%s", (_name, assertFn) => {
    assertFn()
  })
})
