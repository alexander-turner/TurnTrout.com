/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { type Root, type Element } from "hast"
import { h } from "hastscript"
// skipcq: JS-W1028
import React from "react"

import { type GlobalConfiguration } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import { type FullSlug, type RelativeURL } from "../../util/path"
import { type StaticResources, type JSResource } from "../../util/resources"
import { locale, normalizeNbsp } from "../constants"
import Header from "../Header"
import { allSlug } from "../pages/AllPosts"
import { allTagsSlug } from "../pages/AllTagsContent"
import {
  createTranscludeSourceAnchor,
  pageResources,
  renderPage,
  setBlockTransclusion,
  setHeaderTransclusion,
  setIntroTransclusion,
  setPageTransclusion,
  addVirtualFileForSpecialTransclude,
} from "../renderPage"
import { type QuartzComponent, type QuartzComponentProps } from "../types"

// skipcq: JS-D1001
const MockHead: QuartzComponent = () => {
  return (
    <head>
      <title>Test Page</title>
    </head>
  )
}

// skipcq: JS-D1001
const MockPageBody: QuartzComponent = ({ tree }: QuartzComponentProps) => {
  return <div id="page-body">{tree.type}</div>
}

// skipcq: JS-D1001
const MockComponent: QuartzComponent = (props: QuartzComponentProps) => {
  const name = props.displayClass
  return <div className={`mock-component ${name ?? ""}`}>{String(name)}</div>
}

/**
 * Creates mock props for a Quartz component.
 * @param {Partial<QuartzPluginData>} fileData - Data for a single file.
 * @param {QuartzPluginData[]} allFiles - Array of all file data.
 * @returns {QuartzComponentProps} The mock properties object for the component.
 */
const createMockProps = (
  fileData?: Partial<QuartzPluginData>,
  allFiles?: QuartzPluginData[],
): QuartzComponentProps => {
  const treeOverride = (fileData as unknown as { tree?: Root })?.tree
  return {
    fileData: {
      frontmatter: {
        title: "Test Title",
      },
      ...fileData,
    } as QuartzPluginData,
    allFiles: allFiles ?? [],
    tree: treeOverride ?? ({ type: "root", children: [] } as Root),
    cfg: {
      pageTitle: "Test Site",
    } as unknown as GlobalConfiguration,
    ctx: {
      argv: {
        directory: "",
        verbose: false,
        output: "",
        serve: false,
        port: 8080,
        concurrency: 1,
        fastRebuild: false,
        wsPort: 8081,
      },
      cfg: {
        configuration: {
          tableOfContents: {
            maxDepth: 3,
          },
        },
        plugins: { transformers: [], filters: [], emitters: [] },
      } as unknown as GlobalConfiguration,
      allSlugs: [],
    },
    externalResources: {
      css: [],
      js: [],
    },
    children: [],
  } as unknown as QuartzComponentProps
}

describe("pageResources", () => {
  it("should combine base and static resources", () => {
    const baseDir = "test" as RelativeURL
    const staticResources: StaticResources = {
      css: ["style.css"],
      js: [],
    }
    const result = pageResources(baseDir, staticResources)
    expect(result.css).toEqual(["/index.css", "style.css"])
    expect(result.js).toHaveLength(3)
    const firstJs = result.js.find(
      (r) => r.contentType === "external" && r.loadTime === "beforeDOMReady",
    ) as JSResource & { src: string }
    expect(firstJs.src).toBe("test/prescript.js")
  })
})

describe("renderPage", () => {
  const slug: FullSlug = "test" as FullSlug
  const componentData = createMockProps()
  const components = {
    head: MockHead,
    header: [() => <MockComponent {...componentData} />],
    beforeBody: [],
    pageBody: MockPageBody,
    left: [() => <MockComponent {...componentData} />],
    right: [() => <MockComponent {...componentData} />],
    footer: () => <MockComponent {...componentData} />,
  }
  const pageResources: StaticResources = {
    css: [],
    js: [],
  }

  it("should render a full HTML page", () => {
    const html = renderPage(componentData.cfg, slug, componentData, components, pageResources)
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<title>Test Page</title>")
    expect(html).toContain("mock-component")
    expect(html).toContain('<div id="page-body">root</div>')
  })

  it("handles transclusion for a block", () => {
    const transcludedPage: QuartzPluginData = {
      slug: "transcluded-page" as FullSlug,
      frontmatter: { title: "Transcluded Page" },
      htmlAst: {
        type: "root",
        children: [],
      },
      blocks: {
        testBlock: h("p", "Transcluded block content") as unknown as Element,
      },
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", {
              className: ["transclude"],
              dataUrl: "transcluded-page",
              dataBlock: "#^testBlock",
            }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const componentsForTransclusion = {
      ...components,
      pageBody: ({ tree }: QuartzComponentProps) => (
        <div id="page-body">{JSON.stringify(tree)}</div>
      ),
    }

    const html = renderPage(
      props.cfg,
      slug,
      props,
      componentsForTransclusion as typeof components,
      pageResources,
    )
    expect(normalizeNbsp(html)).toContain("Transcluded block content")
  })

  it("handles transclusion when page is not found", () => {
    const props = createMockProps({
      tree: {
        type: "root",
        children: [
          h("span", {
            className: ["transclude"],
            dataUrl: "non-existent-page",
            dataBlock: "#^testBlock",
          }),
        ],
      } as unknown as Root,
    })

    const componentsForTransclusion = {
      ...components,
      pageBody: ({ tree }: QuartzComponentProps) => (
        <div id="page-body">{JSON.stringify(tree)}</div>
      ),
    }

    const html = renderPage(
      props.cfg,
      slug,
      props,
      componentsForTransclusion as typeof components,
      pageResources,
    )
    // Should not crash and should render normally
    expect(html).toContain("<!DOCTYPE html>")
  })

  it("rebases anchor links in transcluded content to point to original page", () => {
    const transcludedPage: QuartzPluginData = {
      slug: "source-page/nested" as FullSlug,
      frontmatter: { title: "Source Page" },
      htmlAst: {
        type: "root",
        children: [h("p", [h("a", { href: "#intro" }, "Link")]) as unknown as Element],
      },
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", { className: ["transclude"], dataUrl: "source-page/nested", dataBlock: "" }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const html = renderPage(
      props.cfg,
      "current-page" as FullSlug,
      props,
      {
        ...components,
        pageBody: ({ tree }: QuartzComponentProps) => (
          <div id="page-body">{JSON.stringify(tree)}</div>
        ),
      } as typeof components,
      pageResources,
    )

    expect(html).toContain("./source-page/nested#intro")
  })

  it.each([
    {
      name: "intro transclusion with ![[page#]]",
      dataBlock: "#",
      htmlContent: [
        h("p", "This is the intro") as unknown as Element,
        h("h2", { id: "section" }, "Section") as unknown as Element,
        h("p", "Section content") as unknown as Element,
      ],
      expectedContain: ["This is the intro"],
      expectedNotContain: ["Section content"],
    },
    {
      name: "full page transclusion with ![[page]]",
      dataBlock: "",
      htmlContent: [
        h("p", "Paragraph one") as unknown as Element,
        h("p", "Paragraph two") as unknown as Element,
        h("div", { id: "trout-container" }, "decoration") as unknown as Element,
        h("div", "subscription") as unknown as Element,
      ],
      expectedContain: ["Paragraph one", "Paragraph two"],
      expectedNotContain: ["subscription"],
    },
  ])("handles $name", ({ dataBlock, htmlContent, expectedContain, expectedNotContain }) => {
    const transcludedPage: QuartzPluginData = {
      slug: "target-page" as FullSlug,
      frontmatter: { title: "Target Page" },
      htmlAst: { type: "root", children: htmlContent },
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", {
              className: ["transclude"],
              dataUrl: "target-page",
              dataBlock,
            }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const html = renderPage(
      props.cfg,
      slug,
      props,
      {
        ...components,
        pageBody: ({ tree }: QuartzComponentProps) => (
          <div id="page-body">{JSON.stringify(tree)}</div>
        ),
      } as typeof components,
      pageResources,
    )
    expectedContain.forEach((text) => expect(normalizeNbsp(html)).toContain(text))
    expectedNotContain.forEach((text) => expect(html).not.toContain(text))
  })

  it.each([
    {
      name: "finds file by alias",
      transcludeUrl: "alias-name" as FullSlug,
      files: [
        {
          slug: "posts/actual-slug" as FullSlug,
          frontmatter: { title: "Page", aliases: ["alias-name", "another-alias"] },
          htmlAst: { type: "root", children: [h("p", "Content via alias")] },
        },
      ],
      expectedContain: ["Content via alias"],
      expectedNotContain: [],
    },
    {
      name: "prioritizes slug over alias",
      transcludeUrl: "target-name" as FullSlug,
      files: [
        {
          slug: "posts/first" as FullSlug,
          frontmatter: { title: "First", aliases: ["target-name"] },
          htmlAst: { type: "root", children: [h("p", "Content from first")] },
        },
        {
          slug: "target-name" as FullSlug,
          frontmatter: { title: "Target" },
          htmlAst: { type: "root", children: [h("p", "Content from target")] },
        },
      ],
      expectedContain: ["Content from target"],
      expectedNotContain: ["Content from first"],
    },
    {
      name: "handles file without frontmatter",
      transcludeUrl: "posts/no-frontmatter" as FullSlug,
      files: [
        {
          slug: "posts/no-frontmatter" as FullSlug,
          htmlAst: { type: "root", children: [h("p", "Content without frontmatter")] },
        },
      ],
      expectedContain: ["Content without frontmatter"],
      expectedNotContain: [],
    },
  ])("$name for transclusion", ({ transcludeUrl, files, expectedContain, expectedNotContain }) => {
    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [h("span", { className: ["transclude"], dataUrl: transcludeUrl })],
        } as unknown as Root,
      },
      files as QuartzPluginData[],
    )

    const html = renderPage(
      props.cfg,
      slug,
      props,
      {
        ...components,
        pageBody: ({ tree }: QuartzComponentProps) => (
          <div id="page-body">{JSON.stringify(tree)}</div>
        ),
      } as typeof components,
      pageResources,
    )

    expectedContain.forEach((text) => expect(normalizeNbsp(html)).toContain(text))
    expectedNotContain.forEach((text) => expect(html).not.toContain(text))
  })

  it("handles header transclusion without htmlAst", () => {
    const transcludedPage: QuartzPluginData = {
      slug: "transcluded-page" as FullSlug,
      frontmatter: { title: "Transcluded Page" },
      // No htmlAst property
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", {
              className: ["transclude"],
              dataUrl: "transcluded-page",
              dataBlock: "#section",
            }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const componentsForTransclusion = {
      ...components,
      pageBody: ({ tree }: QuartzComponentProps) => (
        <div id="page-body">{JSON.stringify(tree)}</div>
      ),
    }

    const html = renderPage(
      props.cfg,
      slug,
      props,
      componentsForTransclusion as typeof components,
      pageResources,
    )
    expect(html).toContain("<!DOCTYPE html>")
  })

  it("handles page transclusion without htmlAst", () => {
    const transcludedPage: QuartzPluginData = {
      slug: "transcluded-page" as FullSlug,
      frontmatter: { title: "Transcluded Page" },
      // No htmlAst property
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", {
              className: ["transclude"],
              dataUrl: "transcluded-page",
              // No dataBlock property means page transclude
            }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const componentsForTransclusion = {
      ...components,
      pageBody: ({ tree }: QuartzComponentProps) => (
        <div id="page-body">{JSON.stringify(tree)}</div>
      ),
    }

    const html = renderPage(
      props.cfg,
      slug,
      props,
      componentsForTransclusion as typeof components,
      pageResources,
    )
    expect(html).toContain("<!DOCTYPE html>")
  })

  it("handles header transclusion with htmlAst", () => {
    const transcludedPage: QuartzPluginData = {
      slug: "transcluded-page" as FullSlug,
      frontmatter: { title: "Transcluded Page" },
      htmlAst: {
        type: "root",
        children: [
          h("h2", { id: "section" }, "Section Title") as unknown as Element,
          h("p", "Section content") as unknown as Element,
        ],
      },
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", {
              className: ["transclude"],
              dataUrl: "transcluded-page",
              dataBlock: "#section",
            }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const componentsForTransclusion = {
      ...components,
      pageBody: ({ tree }: QuartzComponentProps) => (
        <div id="page-body">{JSON.stringify(tree)}</div>
      ),
    }

    const html = renderPage(
      props.cfg,
      slug,
      props,
      componentsForTransclusion as typeof components,
      pageResources,
    )
    expect(normalizeNbsp(html)).toContain("Section content")
  })

  it("handles page transclusion with htmlAst", () => {
    const transcludedPage: QuartzPluginData = {
      slug: "transcluded-page" as FullSlug,
      frontmatter: { title: "Transcluded Page" },
      htmlAst: {
        type: "root",
        children: [
          h("p", "Full page content") as unknown as Element,
          h("div", "More content") as unknown as Element,
        ],
      },
    } as unknown as QuartzPluginData

    const props = createMockProps(
      {
        tree: {
          type: "root",
          children: [
            h("span", {
              className: ["transclude"],
              dataUrl: "transcluded-page",
              // No dataBlock property means page transclude
            }),
          ],
        } as unknown as Root,
      },
      [transcludedPage],
    )

    const componentsForTransclusion = {
      ...components,
      pageBody: ({ tree }: QuartzComponentProps) => (
        <div id="page-body">{JSON.stringify(tree)}</div>
      ),
    }

    const html = renderPage(
      props.cfg,
      slug,
      props,
      componentsForTransclusion as typeof components,
      pageResources,
    )
    expect(normalizeNbsp(html)).toContain("Full page content")
    expect(normalizeNbsp(html)).toContain("More content")
  })

  it("renders beforeBody components", () => {
    // skipcq: JS-D1001
    const MockBeforeBody: QuartzComponent = () => <div className="before-body">Before content</div>
    const componentsWithBeforeBody = {
      ...components,
      beforeBody: [MockBeforeBody],
    }

    const html = renderPage(
      componentData.cfg,
      slug,
      componentData,
      componentsWithBeforeBody,
      pageResources,
    )
    expect(html).toContain("Before content")
    expect(html).toContain("before-body")
  })

  it("handles JavaScript resources with afterDOMReady loadTime", () => {
    const pageResourcesWithJS: StaticResources = {
      css: [],
      js: [
        {
          src: "test.js",
          loadTime: "afterDOMReady",
          contentType: "external",
        },
        {
          src: "other.js",
          loadTime: "beforeDOMReady",
          contentType: "external",
        },
      ],
    }

    const html = renderPage(componentData.cfg, slug, componentData, components, pageResourcesWithJS)
    expect(html).toContain('src="test.js"')
    // beforeDOMReady scripts should not appear at the end
    expect(html.indexOf('src="other.js"')).toBeLessThan(html.indexOf('src="test.js"'))
  })

  it("defaults to 'en' language when no lang or locale specified", () => {
    const propsNoLang = createMockProps()
    delete (propsNoLang.cfg as unknown as { locale?: string }).locale

    const html = renderPage(propsNoLang.cfg, slug, propsNoLang, components, pageResources)
    expect(html).toContain(`lang="${locale}"`)
  })

  it("handles non-span elements in transclude processing", () => {
    const props = createMockProps({
      tree: {
        type: "root",
        children: [
          h("div", { className: ["transclude"] }), // div instead of span
        ],
      } as unknown as Root,
    })

    const html = renderPage(props.cfg, slug, props, components, pageResources)
    expect(html).toContain("<!DOCTYPE html>") // Should not crash
  })

  it("handles spans without transclude class", () => {
    const props = createMockProps({
      tree: {
        type: "root",
        children: [
          h("span", { className: ["other-class"] }), // span without transclude
        ],
      } as unknown as Root,
    })

    const html = renderPage(props.cfg, slug, props, components, pageResources)
    expect(html).toContain("<!DOCTYPE html>") // Should not crash
  })

  it("handles spans with null className", () => {
    const props = createMockProps({
      tree: {
        type: "root",
        children: [
          h("span", { className: null }), // null className
        ],
      } as unknown as Root,
    })

    const html = renderPage(props.cfg, slug, props, components, pageResources)
    expect(html).toContain("<!DOCTYPE html>") // Should not crash
  })
})

describe("Header component", () => {
  it("should render header element when children are provided", () => {
    const props = createMockProps()
    props.children = [<div key="child">Test Content</div>]

    const HeaderComponent = Header()
    const result = HeaderComponent(props) as React.ReactElement

    expect(result).not.toBeNull()
    expect(result.type).toBe("header")
  })

  it("should return null when no children are provided", () => {
    const props = createMockProps()
    props.children = []

    const HeaderComponent = Header()
    const result = HeaderComponent(props)

    expect(result).toBeNull()
  })
})

describe("renderPage helpers", () => {
  it("createTranscludeSourceAnchor returns anchor with expected props", () => {
    const anchor = createTranscludeSourceAnchor("/target")
    expect(anchor.tagName).toBe("a")
    expect(anchor.properties.href).toBe("/target")
    expect(anchor.properties.class).toEqual(["internal", "transclude-src"])
    expect(anchor.properties.ariaHidden).toBe("true")
    expect(anchor.properties.tabIndex).toBe(-1)
  })

  it("setBlockTransclusion replaces children with normalized block", () => {
    const node = h("span") as unknown as Element
    const block = h("p", "hello world") as unknown as Element
    const page = { blocks: { theBlock: block } } as unknown as QuartzPluginData
    setBlockTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug, "theBlock")
    expect(node.children.length).toBe(1)
    const child = node.children[0] as Element
    expect(child.type).toBe("element")
    expect(child.tagName).toBe("p")
  })

  it("setHeaderTransclusion extracts section under header and appends anchor", () => {
    const node = h("span") as unknown as Element
    const h2 = h("h2", { id: "section" }, "title") as unknown as Element
    const para1 = h("p", "one") as unknown as Element
    const para2 = h("p", "two") as unknown as Element
    const nextH2 = h("h2", "next") as unknown as Element

    const page = {
      htmlAst: { type: "root", children: [h2, para1, para2, nextH2] },
    } as unknown as QuartzPluginData

    setHeaderTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug, "section")

    const [c1, c2] = node.children as Element[]
    expect(c1.tagName).toBe("p")
    expect(c2.tagName).toBe("p")
  })

  it.each([
    {
      name: "extracts content before first heading",
      children: [
        h("p", "intro paragraph one") as unknown as Element,
        h("p", "intro paragraph two") as unknown as Element,
        h("h1", { id: "first-section" }, "First Section") as unknown as Element,
        h("p", "section content") as unknown as Element,
      ],
      expectedChildCount: 3,
    },
    {
      name: "includes all content when no heading exists",
      children: [
        h("p", "paragraph one") as unknown as Element,
        h("p", "paragraph two") as unknown as Element,
        h("p", "paragraph three") as unknown as Element,
      ],
      expectedChildCount: 4,
    },
  ])("setIntroTransclusion $name", ({ children, expectedChildCount }) => {
    const node = h("span") as unknown as Element
    const page = { htmlAst: { type: "root", children } } as unknown as QuartzPluginData

    setIntroTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug)

    expect(node.children.length).toBe(expectedChildCount)
    const lastChild = node.children[node.children.length - 1] as Element
    expect(lastChild.tagName).toBe("a")
  })

  it("setIntroTransclusion returns early when no htmlAst", () => {
    const node = h("span") as unknown as Element
    const page = {} as unknown as QuartzPluginData
    const originalChildren = node.children
    setIntroTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug)
    expect(node.children).toEqual(originalChildren)
  })

  it.each([
    {
      name: "injects full htmlAst when no trout-container",
      children: [h("p", "hello") as unknown as Element, h("p", "world") as unknown as Element],
    },
    {
      name: "excludes trout-container and content after it",
      children: [
        h("p", "article content") as unknown as Element,
        h("p", "more content") as unknown as Element,
        h("div", { id: "trout-container" }, "decoration") as unknown as Element,
        h("div", "subscription links") as unknown as Element,
      ],
    },
  ])("setPageTransclusion $name", ({ children }) => {
    const node = h("span") as unknown as Element
    const page = { htmlAst: { type: "root", children } } as unknown as QuartzPluginData
    setPageTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug)
    expect(node.children.length).toBe(3)
    const [c1, c2, anchor] = node.children as Element[]
    expect(c1.tagName).toBe("p")
    expect(c2.tagName).toBe("p")
    expect(anchor.tagName).toBe("a")
  })

  it("addVirtualFileForSpecialTransclude adds virtual files for known targets", () => {
    const props = createMockProps()
    const beforeCount = props.allFiles.length
    addVirtualFileForSpecialTransclude(allSlug as FullSlug, props)
    addVirtualFileForSpecialTransclude(allTagsSlug as FullSlug, props)
    expect(props.allFiles.length).toBeGreaterThan(beforeCount)
  })

  it("setHeaderTransclusion returns early when no htmlAst", () => {
    const node = h("span") as unknown as Element
    const page = {} as unknown as QuartzPluginData // No htmlAst
    const originalChildren = node.children
    setHeaderTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug, "section")
    expect(node.children).toEqual(originalChildren)
  })

  it("setPageTransclusion returns early when no htmlAst", () => {
    const node = h("span") as unknown as Element
    const page = {} as unknown as QuartzPluginData // No htmlAst
    const originalChildren = node.children
    setPageTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug)
    expect(node.children).toEqual(originalChildren)
  })

  it("setHeaderTransclusion returns early when header id not found", () => {
    const node = h("span") as unknown as Element
    const h2 = h("h2", { id: "different-section" }, "title") as unknown as Element
    const page = {
      htmlAst: { type: "root", children: [h2] },
    } as unknown as QuartzPluginData
    const originalChildren = node.children
    setHeaderTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug, "missing-section")
    expect(node.children).toEqual(originalChildren)
  })
})
