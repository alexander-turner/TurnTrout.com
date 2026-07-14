import { globby } from "globby"
import path from "path"

import type { FilePath } from "./path"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
  honorGitignore = true,
): Promise<FilePath[]> {
  const fps = (
    await globby(pattern, {
      cwd,
      ignore: ignorePatterns,
      gitignore: honorGitignore,
    })
  ).map(toPosixPath)
  return fps as FilePath[]
}
