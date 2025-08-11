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
import { pageResources, renderPage } from "../renderPage"
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
  return <div className={`mock-component ${name ?? ""}`}>{name}</div>
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
    expect(html).toContain("Transcluded block content")
  })
})
