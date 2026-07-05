import { describe, expect, it } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"

import { projectRoot, readManifestFile } from "./manifests"

describe("projectRoot", () => {
  it("points at the repository root", () => {
    expect(fs.existsSync(path.join(projectRoot, "package.json"))).toBe(true)
  })
})

describe("readManifestFile", () => {
  it("returns the file contents when the file exists", () => {
    const filePath = path.join(os.tmpdir(), `manifest-${process.pid}.json`)
    fs.writeFileSync(filePath, "{}")
    try {
      expect(readManifestFile(filePath)).toBe("{}")
    } finally {
      fs.unlinkSync(filePath)
    }
  })

  it("returns null when the file is missing", () => {
    expect(readManifestFile(path.join(os.tmpdir(), "does-not-exist.json"))).toBeNull()
  })

  it("propagates non-ENOENT errors", () => {
    // Reading a directory as a file fails with EISDIR, not ENOENT
    expect(() => readManifestFile(os.tmpdir())).toThrow()
  })
})
