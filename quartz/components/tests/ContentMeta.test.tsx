/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals"
import { describe, it, expect, beforeEach } from "@jest/globals"
import { renderPublicationInfo, getFaviconPath, insertFavicon } from "../ContentMeta"
import { TURNTROUT_FAVICON_PATH } from "../../plugins/transformers/linkfavicons"
import { GlobalConfiguration } from "../../cfg"
import { QuartzPluginData } from "../../plugins/vfile"

jest.mock("../Date", () => ({
  formatDate: jest.fn(() => "Mocked Date"),
  getDate: jest.fn(() => new Date("2023-01-01")),
}))

jest.mock("../../plugins/transformers/linkfavicons", () => ({
  GetQuartzPath: jest.fn(() => "mocked/path"),
  urlCache: new Map([["mocked/path", TURNTROUT_FAVICON_PATH]]),
}))

describe("renderPublicationInfo", () => {
  let cfg: GlobalConfiguration
  let fileData: QuartzPluginData
  let frontmatter: QuartzPluginData["frontmatter"]

  beforeEach(() => {
    cfg = {
      locale: "en-US",
    } as GlobalConfiguration

    frontmatter = {
      title: "Test Title",
      original_url: "https://turntrout.com",
      date_published: "2022-12-31T12:00:00",
    }

    fileData = {
      frontmatter,
    } as QuartzPluginData
  })

  it("should return null when original_url is not a string", () => {
    frontmatter!.original_url = undefined
    expect(renderPublicationInfo(cfg, fileData)).toBeNull()
  })

  it("should render publication info with date_published", () => {
    const result = renderPublicationInfo(cfg, fileData)
    expect(result).toMatchObject({
      type: "span",
      props: {
        className: "publication-str",
        children: expect.arrayContaining([
          expect.objectContaining({
            type: "a",
            props: {
              href: "https://turntrout.com",
              className: "external",
              target: "_blank",
              children: "Originally published",
            },
          }),
          expect.objectContaining({
            type: "time",
            props: {
              datetime: "2022-12-31T12:00:00",
              children: " on Dec 31, 2022",
            },
          }),
        ]),
      },
    })
  })

  it("shouldn't render publication info without date_published", () => {
    if (frontmatter) {
      frontmatter.date_published = undefined
    }
    const result = renderPublicationInfo(cfg, fileData)
    expect(result).toBeNull()
  })

  it("should include favicon in rendered output", () => {
    const pubStringElt = renderPublicationInfo(cfg, fileData)

    expect(pubStringElt).toMatchObject({
      props: {
        children: expect.arrayContaining([
          expect.objectContaining({
            type: "img",
            props: { src: TURNTROUT_FAVICON_PATH },
          }),
        ]),
      },
    })
  })
})

describe("getFaviconPath", () => {
  it("should return correct favicon path", () => {
    expect(getFaviconPath(new URL("https://turntrout.com"))).toBe(TURNTROUT_FAVICON_PATH)
  })

  it("should return null when favicon not found", () => {
    const url = new URL("https://unknown.com")
    const result = getFaviconPath(url)
    expect(result).toBeNull()
  })
})

describe("insertFavicon", () => {
  it.only("should insert favicon after text content", () => {
    const result = insertFavicon(TURNTROUT_FAVICON_PATH, <span>A</span>)

    expect(result).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({
              type: "span",
              props: { children: "A" },
            }),
            expect.objectContaining({
              type: "img",
              props: {
                src: TURNTROUT_FAVICON_PATH,
                alt: "",
                className: "favicon",
              },
            }),
          ]),
        }),
      }),
    )
  })

  it("should return original node when imgPath is null", () => {
    const node = <span>A</span>
    const result = insertFavicon(null, node)
    expect(result).toEqual(node)
  })
})
