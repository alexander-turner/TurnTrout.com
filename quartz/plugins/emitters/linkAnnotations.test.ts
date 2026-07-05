import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import fs from "fs/promises"
import os from "os"
import path from "path"

import { type BuildCtx } from "../../util/ctx"
import { type FullSlug } from "../../util/path"
import {
  testAnnotation,
  TEST_ANNOTATION_KEY as WIKI_KEY,
} from "../../util/tests/annotationFixtures"

jest.unstable_mockModule("./helpers", () => ({
  write: jest.fn(async (opts: { slug: FullSlug; ext: string }) => {
    return await Promise.resolve(`${opts.slug}${opts.ext}`)
  }),
}))

const mockCtx = { argv: { output: "public" } } as unknown as BuildCtx

describe("LinkAnnotations", () => {
  let write: jest.MockedFunction<typeof import("./helpers").write>
  let LinkAnnotations: typeof import("./linkAnnotations").LinkAnnotations
  let dir: string

  beforeAll(async () => {
    const helpers = await import("./helpers")
    write = helpers.write as jest.MockedFunction<typeof helpers.write>
    const mod = await import("./linkAnnotations")
    LinkAnnotations = mod.LinkAnnotations
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "link-annotations-emit-"))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  async function emit(annotationsPath: string) {
    const plugin = LinkAnnotations({ annotationsPath })
    return plugin.emit(mockCtx, [], { css: [], js: [] })
  }

  it("emits the manifest as static JSON", async () => {
    const file = path.join(dir, "annotations.json")
    await fs.writeFile(file, JSON.stringify({ [WIKI_KEY]: testAnnotation() }))

    const emitted = await emit(file)

    expect(emitted).toEqual(["static/link-annotations.json"])
    const call = write.mock.calls[0][0]
    expect(call.slug).toBe("static/link-annotations")
    expect(call.ext).toBe(".json")
    expect(JSON.parse(call.content)).toEqual({ [WIKI_KEY]: testAnnotation() })
  })

  it("emits an empty object when the manifest is missing", async () => {
    await emit(path.join(dir, "nope.json"))
    expect(JSON.parse(write.mock.calls[0][0].content)).toEqual({})
  })

  it("throws on a malformed manifest", async () => {
    const file = path.join(dir, "bad.json")
    await fs.writeFile(file, JSON.stringify({ [WIKI_KEY]: { title: "incomplete" } }))
    await expect(emit(file)).rejects.toThrow('field "attribution" must be an object')
  })

  it("defaults to the committed manifest path and exposes plugin metadata", async () => {
    const plugin = LinkAnnotations()
    expect(plugin.name).toBe("LinkAnnotations")
    expect(plugin.getQuartzComponents(mockCtx)).toEqual([])
    const graph = await plugin.getDependencyGraph?.(mockCtx, [], { css: [], js: [] })
    expect(graph?.nodes).toEqual([])
  })
})
