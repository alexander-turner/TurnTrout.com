import React from "react"

import { type GlobalConfiguration } from "../cfg"
import { i18n } from "../i18n"
import { type QuartzPluginData } from "../plugins/vfile"
import { classNames } from "../util/lang"
import { type FullSlug, type SimpleSlug, resolveRelative } from "../util/path"
import { DateElement } from "./Date"
import { byDateAndAlphabetical } from "./PageList"
import style from "./styles/recentNotes.scss"
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types"
interface Options {
  title?: string
  limit: number
  linkToMore: SimpleSlug | false
  filter: (f: QuartzPluginData) => boolean
  sort: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

const defaultOptions = (cfg: GlobalConfiguration): Options => ({
  limit: 3,
  linkToMore: false,
  filter: () => true,
  sort: byDateAndAlphabetical(cfg),
})

export default ((userOpts?: Partial<Options>) => {
  const RecentNotes: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const opts = { ...defaultOptions(cfg), ...userOpts }
    const pages = allFiles.filter(opts.filter).sort(opts.sort)
    const remaining = Math.max(0, pages.length - opts.limit)
    return (
      <div className={classNames(displayClass, "recent-notes")}>
        <h3>{opts.title ?? i18n(cfg.locale).components.recentNotes.title}</h3>
        <ul className="recent-ul">
          {pages.slice(0, opts.limit).map((page) => {
            const title = page.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title
            const tags = page.frontmatter?.tags ?? []

            return (
              <li className="recent-li section" key={page.slug}>
                <h3>
                  <a
                    href={resolveRelative(
                      fileData.slug || ("" as FullSlug),
                      page.slug || ("" as FullSlug),
                    )}
                    className="internal"
                  >
                    {title}
                  </a>
                </h3>
                {page.dates?.created && (
                  <p className="meta">
                    <DateElement
                      cfg={cfg}
                      date={page.dates.created}
                      monthFormat="long"
                      includeOrdinalSuffix
                      formatOrdinalSuffix
                    />
                  </p>
                )}
                <ul className="tags">
                  {tags.map((tag) => (
                    <li key={tag}>
                      <a
                        className="internal tag-link"
                        href={resolveRelative(
                          fileData.slug || ("" as FullSlug),
                          `tags/${tag}` as FullSlug,
                        )}
                      >
                        {tag}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
        {opts.linkToMore && remaining > 0 && (
          <p>
            <a href={resolveRelative(fileData.slug || ("" as FullSlug), opts.linkToMore)}>
              {i18n(cfg.locale).components.recentNotes.seeRemainingMore({ remaining })}
            </a>
          </p>
        )}
      </div>
    )
  }

  RecentNotes.css = style
  return RecentNotes
}) satisfies QuartzComponentConstructor
