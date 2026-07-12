import gitRoot from "find-git-root"
import path from "path"
import { fileURLToPath } from "url"

import { quartzFolder } from "./constants"

// Computed file paths (server-only due to Node.js dependencies)
const __filepath = fileURLToPath(import.meta.url)
const __dirname = path.dirname(gitRoot(__filepath))
export const faviconCountsFile = path.join(
  __dirname,
  quartzFolder,
  "plugins",
  "transformers",
  ".faviconCounts.txt",
)

// Pre-pass index of slug -> {title, section-heading text}, consumed in-worker by
// the BindLinkTitles transformer to resolve `@title` links to live titles.
export const titleIndexFile = path.join(
  __dirname,
  quartzFolder,
  "plugins",
  "transformers",
  ".titleIndex.json",
)
