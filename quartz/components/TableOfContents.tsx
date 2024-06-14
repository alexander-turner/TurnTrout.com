import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import legacyStyle from "./styles/legacyToc.scss"
import modernStyle from "./styles/toc.scss"
import { classNames } from "../util/lang"

// @ts-expect-error
import script from "./scripts/toc.inline"
import { i18n } from "../i18n"

interface Options {
  layout: "modern" | "legacy"
}

const defaultOptions: Options = {
  layout: "modern",
}

let lastDepth = 0
const TableOfContents: QuartzComponent = ({
  fileData,
  displayClass,
  cfg,
}: QuartzComponentProps) => {
  if (!fileData.toc || fileData.frontmatter?.toc === "false") {
    return null
  }

  const title = fileData.frontmatter?.title

  return (
    <div class={classNames(displayClass, "toc")}>
      <h6 class="toc-title">
        <a href="#">{title}</a>
      </h6>
      <div id="toc-content">
        <ul class="overflow">{addListItem(fileData.toc, 0)}</ul>
      </div>
      <hr />
    </div>
  )
}

function addListItem(remainingEntries, currentDepth) {
  if (remainingEntries.length === 0) {
    return ""
  }

  let result = []
  while (remainingEntries.length > 0) {
    const tocEntry = remainingEntries[0]

    if (tocEntry.depth > currentDepth) {
      // If the entry is deeper, start a new list
      result.push(<ul>{addListItem(remainingEntries, tocEntry.depth)}</ul>)
    } else if (tocEntry.depth < currentDepth) {
      // If the entry is shallower, stop the recursion
      break
    } else {
      // Process entries at the same depth
      remainingEntries.shift()
      const li = (
        <li key={tocEntry.slug} className={`depth-${tocEntry.depth}`}>
          <a href={`#${tocEntry.slug}`} data-for={tocEntry.slug}>
            {tocEntry.text}
          </a>
        </li>
      )
      result.push(li)
    }
  }
  return result
}

TableOfContents.css = modernStyle
TableOfContents.afterDOMLoaded = script

const LegacyTableOfContents: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  if (!fileData.toc) {
    return null
  }
  return (
    <details id="toc" open={!fileData.collapseToc}>
      <summary>
        <h3>{i18n(cfg.locale).components.tableOfContents.title}</h3>
      </summary>
      <ul>
        {fileData.toc.map((tocEntry) => (
          <li key={tocEntry.slug} class={`depth-${tocEntry.depth}`}>
            <a href={`#${tocEntry.slug}`} data-for={tocEntry.slug}>
              {tocEntry.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}
LegacyTableOfContents.css = legacyStyle

export default ((opts?: Partial<Options>) => {
  const layout = opts?.layout ?? defaultOptions.layout
  return layout === "modern" ? TableOfContents : LegacyTableOfContents
}) satisfies QuartzComponentConstructor
