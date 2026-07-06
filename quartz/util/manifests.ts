/**
 * Filesystem access shared by the transformers that read committed link
 * manifests (`config/link_archive_manifest.json`, `config/link_annotations.json`).
 * Node-only — never import from browser-bundled code.
 */
import gitRoot from "find-git-root"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

/** Repository root, for resolving committed config manifests. */
export const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

/** Missing manifest → null (callers treat as empty); other I/O errors propagate. */
export function readManifestFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}
