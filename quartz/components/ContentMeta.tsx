import { formatDate, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

interface ContentMetaOptions {
  /**
   * Whether to display reading time
   */
  showReadingTime: boolean
  showComma: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
  showComma: true,
}

const DEFAULT_AUTHOR = "Alex Turner"
export default ((opts?: Partial<ContentMetaOptions>) => {
  // Merge options with defaults
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    if (fileData.frontmatter?.hide_metadata) {
      return null
    }
    const text = fileData.text

    if (text) {
      const segments: (string | JSX.Element)[] = []
      const frontmatter = fileData.frontmatter

      if (frontmatter?.original_url) {
        var dateStr = ""
        // TODO automate this for new posts
        var publicationStr = "Published"
        if (frontmatter?.date_published) {
          publicationStr = "Originally published"
          const formattedDate: Date = formatDate(new Date(frontmatter?.date_published))
          dateStr = " on " + formattedDate
        } else if (fileData.dates) {
          const formattedDate: Date = formatDate(getDate(cfg, fileData)!, cfg.locale)
          dateStr = " on " + formattedDate
        }
        dateStr = <time datetime={frontmatter?.date_published}>{dateStr}</time>

        publicationStr = (
          <span className="publication-str">
            <a href={frontmatter?.original_url} class="external">
              {publicationStr}
            </a>
            {dateStr}
          </span>
        )
        segments.push(publicationStr)
      }

      // // Display reading time if enabled
      if (options.showReadingTime) {
        const { minutes, words: _words } = readingTime(text)
        const displayedTime = i18n(cfg.locale).components.contentMeta.readingTime({
          minutes: Math.ceil(minutes),
        })
        segments.push(displayedTime)
      }

      const segmentsElements = segments.map((segment) => <p>{segment}</p>)
      return (
        <div class={classNames(displayClass, "content-meta")}>
          <p>Metadata</p>
          {segmentsElements}
        </div>
      )
    } else {
      return null
    }
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
