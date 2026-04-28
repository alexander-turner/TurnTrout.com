import type { ProcessedContent } from "../plugins/vfile"
import type { FilePath } from "../util/path"

export function getFilePath(vfile: ProcessedContent[1]): FilePath {
  if (!vfile.data.filePath) {
    throw new Error(`Parsed file missing filePath: ${vfile.path ?? "unknown"}`)
  }
  return vfile.data.filePath
}
