/**
 * @jest-environment jest-fixed-jsdom
 */
import { describe, expect, it } from "@jest/globals"
import { type Element, type Root } from "hast"
import { h } from "hastscript"
// skipcq: JS-W1028
import React from "react"

import { type QuartzPluginData } from "../../plugins/vfile"
import { type GlobalConfiguration } from "../../util/config"
import { type FullSlug, type RelativeURL } from "../../util/path"
import { type JSResource, type StaticResources } from "../../util/resources"
import { locale, normalizeNbsp } from "../constants"
import { allSlug } from "../pages/AllPosts"
import { allTagsSlug } from "../pages/AllTagsContent"
import {
  addVirtualFileForSpecialTransclude,
  createTranscludeSourceAnchor,
  optimizeLcpImage,
  pageResources,
  renderPage,
  setBlockTransclusion,
  setHeaderTransclusion,
  setIntroTransclusion,
  setPageTransclusion,
} from "../renderPage"
import { type QuartzComponent, type QuartzComponentProps } from "../types"

/** Test stub for `<head>`. */
const MockHead: QuartzComponent = () => {
  return (
    <head>
      <title>Test Page</title>
    </head>
  )
}

/** Test stub for page body that renders the AST node type. */
const MockPageBody: QuartzComponent = ({ tree }: QuartzComponentProps) => {
  return <div id="page-body">{tree.type}</div>
}

/** Test stub that surfaces `displayClass` so assertions can verify slot assignment. */
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
    beforeBody: [],
    pageBody: MockPageBody,
    left: [() => <MockComponent {...componentData} />],
    right: [() => <MockComponent {...componentData} />],
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

  it("demotes a transcluded same-page link to a normal internal link", () => {
    const anchorFavicon: Element = {
      type: "element",
      tagName: "svg",
      children: [],
      properties: {
        class: "favicon",
        "data-domain": "anchor",
        style:
          "--mask-url: url(https://assets.turntrout.com/static/images/external-favicons/anchor.svg);",
      },
    }
    const link = h("a", { href: "#intro", className: ["internal", "same-page-link"] }, [
      h("span", { className: ["favicon-span"] }, ["Link", anchorFavicon]),
    ])

    const transcludedPage: QuartzPluginData = {
      slug: "source-page/nested" as FullSlug,
      frontmatter: { title: "Source Page" },
      htmlAst: {
        type: "root",
        children: [h("p", [link]) as unknown as Element],
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

    // The transcluded link is serialized as escaped JSON inside #page-body; scope
    // assertions to it so the page shell's own skip-to-content link is ignored.
    const pageBody = html.slice(html.indexOf('id="page-body"'))
    expect(pageBody).toContain("./source-page/nested#intro")
    // Demoted: same-page-link dropped (className is internal-only), anchor favicon
    // swapped for the turntrout favicon.
    expect(pageBody).toContain("[&quot;internal&quot;]")
    expect(pageBody).toContain("turntrout_com")
    expect(pageBody).not.toContain("same-page-link")
    expect(pageBody).not.toContain("&quot;anchor&quot;")
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
    /** Inline test stub for the beforeBody slot. */
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

  it("setBlockTransclusion does nothing when block ref not found", () => {
    const node = h("span") as unknown as Element
    const originalChildren = [...node.children]
    const page = { blocks: { otherBlock: h("p", "x") } } as unknown as QuartzPluginData
    setBlockTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug, "missingBlock")
    expect(node.children).toEqual(originalChildren)
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

  it("setHeaderTransclusion includes sub-headers within the section", () => {
    const node = h("span") as unknown as Element
    const h2 = h("h2", { id: "section" }, "title") as unknown as Element
    const para1 = h("p", "one") as unknown as Element
    const h3 = h("h3", { id: "sub" }, "subtitle") as unknown as Element
    const para2 = h("p", "two") as unknown as Element
    const nextH2 = h("h2", "next") as unknown as Element

    const page = {
      htmlAst: { type: "root", children: [h2, para1, h3, para2, nextH2] },
    } as unknown as QuartzPluginData

    setHeaderTransclusion(node, page, "a/b" as FullSlug, "x/y" as FullSlug, "section")

    // Should include para1, h3, and para2 (everything between h2#section and the next h2)
    expect(node.children.length).toBe(3)
    const [c1, c2, c3] = node.children as Element[]
    expect(c1.tagName).toBe("p")
    expect(c2.tagName).toBe("h3")
    expect(c3.tagName).toBe("p")
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

describe("optimizeLcpImage", () => {
  it.each([
    { name: "no article tag", html: "<html><head></head><body><img src='x.avif'></body></html>" },
    {
      name: "no closing article tag",
      html: '<html><head></head><body><article><img src="x.avif"></body></html>',
    },
    {
      name: "no images in article",
      html: "<html><head></head><body><article>text</article></body></html>",
    },
    {
      name: "only favicon images",
      html: '<html><head></head><body><article><img class="favicon" src="icon.svg"></article></body></html>',
    },
    {
      name: "image with no src",
      html: '<html><head></head><body><article><img alt="no source"></article></body></html>',
    },
  ])("returns HTML unchanged when $name", ({ html }) => {
    expect(optimizeLcpImage(html)).toBe(html)
  })

  it("sets loading='eager' and fetchpriority='high' on first image with loading='lazy'", () => {
    const html =
      '<html><head></head><body><article><img src="img.avif" loading="lazy" width="100"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('loading="eager"')
    expect(result).toContain('fetchpriority="high"')
    expect(result).not.toContain('loading="lazy"')
  })

  it("adds loading='eager' and fetchpriority='high' when attributes are missing", () => {
    const html =
      '<html><head></head><body><article><img src="img.avif" width="100"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('loading="eager"')
    expect(result).toContain('fetchpriority="high"')
  })

  it("adds crossorigin preload link in <head> for first content image", () => {
    const html =
      '<html><head></head><body><article><img src="https://cdn.example.com/hero.avif" loading="lazy"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain(
      '<link rel="preload" href="https://cdn.example.com/hero.avif" as="image" crossorigin="anonymous"/>',
    )
  })

  it("skips twemoji glyphs as LCP candidates and optimizes the next content image", () => {
    const html =
      '<html><head></head><body><article><img src="https://assets.turntrout.com/twemoji/1f44b.svg"><img src="https://assets.turntrout.com/hero.avif" loading="lazy"></article></body></html>'
    const result = optimizeLcpImage(html)
    // Twemoji <img> must stay untouched
    expect(result).toContain('<img src="https://assets.turntrout.com/twemoji/1f44b.svg">')
    // No preload for the emoji
    expect(result).not.toContain(
      '<link rel="preload" href="https://assets.turntrout.com/twemoji/1f44b.svg"',
    )
    // The real content image is promoted instead
    expect(result).toContain('src="https://assets.turntrout.com/hero.avif" loading="eager"')
    expect(result).toContain(
      '<link rel="preload" href="https://assets.turntrout.com/hero.avif" as="image" crossorigin="anonymous"/>',
    )
  })

  it("does not duplicate preload link when already present", () => {
    const html =
      '<html><head><link rel="preload" href="img.avif" as="image"/></head><body><article><img src="img.avif" loading="eager" fetchpriority="high"></article></body></html>'
    const result = optimizeLcpImage(html)
    const preloadCount = (result.match(/rel="preload" href="img.avif"/g) ?? []).length
    expect(preloadCount).toBe(1)
  })

  it("skips favicon images and optimizes the next content image", () => {
    const html =
      '<html><head></head><body><article><img class="favicon" src="icon.svg"><img src="hero.avif" loading="lazy"></article></body></html>'
    const result = optimizeLcpImage(html)
    // Favicon should be unchanged
    expect(result).toContain('class="favicon" src="icon.svg"')
    // Second image should be optimized
    expect(result).toContain('src="hero.avif" loading="eager"')
    expect(result).toContain('fetchpriority="high"')
  })

  it("only optimizes the first content image, not subsequent ones", () => {
    const html =
      '<html><head></head><body><article><img src="first.avif" loading="lazy"><img src="second.avif" loading="lazy"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('src="first.avif" loading="eager"')
    expect(result).toContain('src="second.avif" loading="lazy"')
  })

  it("replaces existing fetchpriority value", () => {
    const html =
      '<html><head></head><body><article><img src="img.avif" loading="lazy" fetchpriority="low"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('fetchpriority="high"')
    expect(result).not.toContain('fetchpriority="low"')
  })

  it("promotes both images of an img-comparison-slider", () => {
    const html =
      "<html><head></head><body><article><figure><img-comparison-slider>" +
      '<img slot="first" src="https://cdn.example.com/before.avif" loading="lazy">' +
      '<img slot="second" src="https://cdn.example.com/after.avif" loading="lazy">' +
      "</img-comparison-slider></figure></article></body></html>"
    const result = optimizeLcpImage(html)
    expect(result).toContain(
      'slot="first" src="https://cdn.example.com/before.avif" loading="eager"',
    )
    expect(result).toContain(
      'slot="second" src="https://cdn.example.com/after.avif" loading="eager"',
    )
    expect(result).not.toContain('loading="lazy"')
    expect((result.match(/fetchpriority="high"/g) ?? []).length).toBe(2)
    expect(result).toContain(
      '<link rel="preload" href="https://cdn.example.com/before.avif" as="image" crossorigin="anonymous"/>',
    )
    expect(result).toContain(
      '<link rel="preload" href="https://cdn.example.com/after.avif" as="image" crossorigin="anonymous"/>',
    )
  })

  it("does not promote images in a later slider when the LCP image is outside it", () => {
    const html =
      "<html><head></head><body><article>" +
      '<img src="hero.avif" loading="lazy">' +
      '<img-comparison-slider><img slot="first" src="a.avif" loading="lazy">' +
      '<img slot="second" src="b.avif" loading="lazy"></img-comparison-slider>' +
      "</article></body></html>"
    const result = optimizeLcpImage(html)
    expect(result).toContain('src="hero.avif" loading="eager"')
    expect(result).toContain('src="a.avif" loading="lazy"')
    expect(result).toContain('src="b.avif" loading="lazy"')
  })

  it("only promotes slider images, not a content image after the slider", () => {
    const html =
      "<html><head></head><body><article><img-comparison-slider>" +
      '<img slot="first" src="a.avif" loading="lazy">' +
      '<img slot="second" src="b.avif" loading="lazy"></img-comparison-slider>' +
      '<img src="after.avif" loading="lazy"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('src="a.avif" loading="eager"')
    expect(result).toContain('src="b.avif" loading="eager"')
    expect(result).toContain('src="after.avif" loading="lazy"')
  })

  it("treats a content image after a non-content slider as the lone LCP image", () => {
    const html =
      "<html><head></head><body><article><img-comparison-slider>" +
      '<img class="favicon" slot="first" src="icon.svg">' +
      "</img-comparison-slider>" +
      '<img src="hero.avif" loading="lazy"></article></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('class="favicon" slot="first" src="icon.svg"')
    expect(result).toContain('src="hero.avif" loading="eager"')
    expect(result).toContain('fetchpriority="high"')
  })

  it("ignores images outside the article boundary", () => {
    const html =
      '<html><head></head><body><article>no images here</article><img src="outside.avif" loading="lazy"></body></html>'
    const result = optimizeLcpImage(html)
    expect(result).toContain('loading="lazy"')
    expect(result).not.toContain('loading="eager"')
  })
})
