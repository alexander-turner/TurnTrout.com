/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals"

import {
  fetchHTMLContent,
  extractPreviewables,
  processPreviewables,
  modifyElementIds,
  restoreCheckboxStates,
  renderHTMLContent,
  type ContentRenderOptions,
} from "../content_renderer"

describe("fetchHTMLContent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should fetch and parse HTML content", async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve('<html><body><div class="previewable">Test content</div></body></html>'),
      } as Response),
    )

    const url = new URL("http://example.com/test")
    const html = await fetchHTMLContent(url, mockFetch)

    expect(html).toBeInstanceOf(Document)
    expect(html.querySelector(".previewable")?.textContent).toBe("Test content")
  })

  it("should throw error on failed fetch", async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response),
    )

    const url = new URL("http://example.com/notfound")
    await expect(fetchHTMLContent(url, mockFetch)).rejects.toThrow("HTTP error! status: 404")
  })

  it("should use default fetch when no custom fetch provided", async () => {
    // Mock global fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve("<html><body>Default fetch</body></html>"),
      } as Response),
    ) as jest.MockedFunction<typeof fetch>

    const url = new URL("http://example.com/test")
    const html = await fetchHTMLContent(url)

    expect(html).toBeInstanceOf(Document)
    expect(global.fetch).toHaveBeenCalledWith(url.toString())
  })
})

describe("extractPreviewableElements", () => {
  it("should extract previewable elements", () => {
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">Element 1</div>
      <div class="other">Not previewable</div>
      <div class="previewable">Element 2</div>
    `

    const previewables = extractPreviewables(html)
    expect(previewables.length).toBe(2)
    expect(previewables[0].textContent).toBe("Element 1")
    expect(previewables[1].textContent).toBe("Element 2")
  })

  it("should return empty array when no previewable elts found", () => {
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = '<div class="other">No previewable elements here</div>'

    const previewables = extractPreviewables(html)
    expect(previewables.length).toBe(0)
  })
})

describe("processPreviewables", () => {
  interface WindowWithCheckboxStates extends Window {
    __quartz_checkbox_states?: Map<string, boolean>
  }

  beforeEach(() => {
    delete (window as WindowWithCheckboxStates).__quartz_checkbox_states
  })

  it("should extract previewable elements and restore checkboxes", () => {
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">
        <input type="checkbox" class="checkbox-toggle">
      </div>
    `

    // Set up checkbox state
    const states = new Map<string, boolean>()
    states.set("-checkbox-0", true)
    ;(window as WindowWithCheckboxStates).__quartz_checkbox_states = states

    const url = new URL("http://example.com")
    const elements = processPreviewables(html, url)

    expect(elements.length).toBe(1)
    const checkbox = elements[0].querySelector("input.checkbox-toggle") as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    // Clean up
    delete (window as WindowWithCheckboxStates).__quartz_checkbox_states
  })

  it("should handle missing checkbox states gracefully", () => {
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">
        <input type="checkbox" class="checkbox-toggle">
      </div>
    `

    const url = new URL("http://example.com")
    const elements = processPreviewables(html, url)

    expect(elements.length).toBe(1)
    const checkbox = elements[0].querySelector("input.checkbox-toggle") as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it("should return cloned elements", () => {
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">
        <p>Original content</p>
      </div>
    `

    const url = new URL("http://example.com")
    const elements = processPreviewables(html, url)

    // Modify the returned element
    const paragraphElement = elements[0].querySelector("p")
    if (paragraphElement) paragraphElement.textContent = "Modified"

    // Original should be unchanged
    const original = html.querySelector(".previewable p")
    expect(original?.textContent).toBe("Original content")
  })
})

describe("modifyElementIds", () => {
  it("should append suffix to element IDs", () => {
    const container = document.createElement("div")
    container.innerHTML = `
      <h1 id="heading">Heading</h1>
      <h2 id="subheading">Subheading</h2>
      <li id="item">Item</li>
      <a id="link">Link</a>
    `

    const elements = [container]
    modifyElementIds(elements, "-test")

    expect(container.querySelector("#heading-test")).not.toBeNull()
    expect(container.querySelector("#subheading-test")).not.toBeNull()
    expect(container.querySelector("#item-test")).not.toBeNull()
    expect(container.querySelector("#link-test")).not.toBeNull()
  })

  it("should not modify elements without IDs", () => {
    const container = document.createElement("div")
    container.innerHTML = `
      <h1>No ID</h1>
      <p>Paragraph</p>
    `

    const elements = [container]
    modifyElementIds(elements, "-test")

    expect(container.querySelector("h1")?.textContent).toBe("No ID")
  })
})

describe("restoreCheckboxStates", () => {
  interface WindowWithCheckboxStates extends Window {
    __quartz_checkbox_states?: Map<string, boolean>
  }

  beforeEach(() => {
    // Clean up any existing checkbox states
    delete (window as WindowWithCheckboxStates).__quartz_checkbox_states
  })

  it("should restore checkbox states from window object", () => {
    const container = document.createElement("div")
    container.innerHTML = `
      <ul>
        <li><input type="checkbox" class="checkbox-toggle"> Item 1</li>
        <li><input type="checkbox" class="checkbox-toggle"> Item 2</li>
      </ul>
    `

    // Set up checkbox states
    const states = new Map<string, boolean>()
    states.set("-checkbox-0", true)
    states.set("-checkbox-1", false)
    ;(window as WindowWithCheckboxStates).__quartz_checkbox_states = states

    const url = new URL("http://example.com")
    restoreCheckboxStates(container, url)

    const checkboxes = container.querySelectorAll("input.checkbox-toggle")
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false)
  })

  it("should handle missing checkbox states gracefully", () => {
    const container = document.createElement("div")
    container.innerHTML = '<input type="checkbox" class="checkbox-toggle">'

    const url = new URL("http://example.com")
    restoreCheckboxStates(container, url)

    const checkbox = container.querySelector("input.checkbox-toggle") as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it("should do nothing when no checkboxes present", () => {
    const container = document.createElement("div")
    container.innerHTML = "<p>No checkboxes</p>"

    const url = new URL("http://example.com")
    expect(() => restoreCheckboxStates(container, url)).not.toThrow()
  })
})

describe("renderHTMLContent", () => {
  it("should render content with ID suffix", () => {
    const container = document.createElement("div")
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">
        <h1 id="test">Test</h1>
      </div>
    `

    const options: ContentRenderOptions = {
      targetUrl: new URL("http://example.com"),
      idSuffix: "-suffix",
    }

    const elements = renderHTMLContent(container, html, options)

    expect(elements.length).toBe(1)
    expect(container.querySelector("#test-suffix")).not.toBeNull()
  })

  it("should render without modifying IDs when no suffix provided", () => {
    const container = document.createElement("div")
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = '<div class="previewable"><h1 id="test">Test</h1></div>'

    const options: ContentRenderOptions = {
      targetUrl: new URL("http://example.com"),
    }

    renderHTMLContent(container, html, options)

    expect(container.querySelector("#test")).not.toBeNull()
    expect(container.querySelector("#test-suffix")).toBeNull()
  })

  it("should always restore checkboxes", () => {
    interface WindowWithCheckboxStates extends Window {
      __quartz_checkbox_states?: Map<string, boolean>
    }

    const container = document.createElement("div")
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">
        <input type="checkbox" class="checkbox-toggle">
      </div>
    `

    // Set up checkbox state
    const states = new Map<string, boolean>()
    states.set("-checkbox-0", true)
    ;(window as WindowWithCheckboxStates).__quartz_checkbox_states = states

    const options: ContentRenderOptions = {
      targetUrl: new URL("http://example.com"),
    }

    renderHTMLContent(container, html, options)

    const checkbox = container.querySelector("input.checkbox-toggle") as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    // Clean up
    delete (window as WindowWithCheckboxStates).__quartz_checkbox_states
  })

  it("should handle ID suffix and checkbox restoration together", () => {
    interface WindowWithCheckboxStates extends Window {
      __quartz_checkbox_states?: Map<string, boolean>
    }

    const container = document.createElement("div")
    const html = document.implementation.createHTMLDocument()
    html.body.innerHTML = `
      <div class="previewable">
        <h1 id="heading">Title</h1>
        <input type="checkbox" class="checkbox-toggle">
      </div>
    `

    // Set up checkbox state
    const states = new Map<string, boolean>()
    states.set("-checkbox-0", true)
    ;(window as WindowWithCheckboxStates).__quartz_checkbox_states = states

    const options: ContentRenderOptions = {
      targetUrl: new URL("http://example.com"),
      idSuffix: "-popover",
    }

    const elements = renderHTMLContent(container, html, options)

    expect(elements.length).toBe(1)
    expect(container.querySelector("#heading-popover")).not.toBeNull()
    const checkbox = container.querySelector("input.checkbox-toggle") as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    // Clean up
    delete (window as WindowWithCheckboxStates).__quartz_checkbox_states
  })
})
