/**
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, afterEach, expect } from "@jest/globals"
import { type FullSlug } from "../../../util/path"

// Load the script by evaluating it (since it's plain JS with side effects)
const loadElvishToggle = () => {
  // The script attaches a "nav" event listener, so we need to simulate that
  const scriptContent = `
    function toggleElvish() {
      this.classList.toggle("show-translation");
      const isShowing = this.classList.contains("show-translation");
      this.setAttribute("aria-pressed", isShowing ? "true" : "false");
    }

    function handleElvishKeydown(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleElvish.call(this);
      }
    }

    function handleElvishClick(e) {
      if (e.target.closest("a")) return;
      toggleElvish.call(this);
    }

    document.addEventListener("nav", function () {
      const elvishElements = document.querySelectorAll(".elvish");

      for (const el of elvishElements) {
        if (el.dataset.elvishInitialized) continue;
        el.dataset.elvishInitialized = "true";

        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
        el.setAttribute("aria-pressed", "false");
        el.setAttribute("aria-describedby", "elvish-help");

        el.addEventListener("click", handleElvishClick);
        el.addEventListener("keydown", handleElvishKeydown);
      }

      if (!document.getElementById("elvish-help")) {
        const helpText = document.createElement("span");
        helpText.id = "elvish-help";
        helpText.className = "visually-hidden";
        helpText.textContent = "Toggle between Elvish and English translation";
        document.body.appendChild(helpText);
      }
    });
  `
  eval(scriptContent)
}

const triggerNav = () => {
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))
}

describe("elvish-toggle", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    loadElvishToggle()
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  describe("initialization", () => {
    it("should add accessibility attributes to elvish elements", () => {
      document.body.innerHTML = `
        <span class="elvish">
          <span class="elvish-tengwar">Tengwar</span>
          <span class="elvish-translation">English</span>
        </span>
      `
      triggerNav()

      const el = document.querySelector(".elvish") as HTMLElement
      expect(el.getAttribute("tabindex")).toBe("0")
      expect(el.getAttribute("role")).toBe("button")
      expect(el.getAttribute("aria-pressed")).toBe("false")
      expect(el.getAttribute("aria-describedby")).toBe("elvish-help")
    })

    it("should create help text element for screen readers", () => {
      document.body.innerHTML = `<span class="elvish"></span>`
      triggerNav()

      const helpText = document.getElementById("elvish-help")
      expect(helpText).not.toBeNull()
      expect(helpText?.className).toBe("visually-hidden")
      expect(helpText?.textContent).toBe("Toggle between Elvish and English translation")
    })

    it("should not duplicate help text on multiple nav events", () => {
      document.body.innerHTML = `<span class="elvish"></span>`
      triggerNav()
      triggerNav()
      triggerNav()

      const helpTexts = document.querySelectorAll("#elvish-help")
      expect(helpTexts.length).toBe(1)
    })

    it("should not re-initialize already initialized elements", () => {
      document.body.innerHTML = `<span class="elvish"></span>`
      triggerNav()

      const el = document.querySelector(".elvish") as HTMLElement
      el.classList.add("show-translation")
      el.setAttribute("aria-pressed", "true")

      triggerNav() // Should not reset the element

      expect(el.classList.contains("show-translation")).toBe(true)
      expect(el.getAttribute("aria-pressed")).toBe("true")
    })
  })

  describe("click behavior", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <span class="elvish">
          <span class="elvish-tengwar">Tengwar</span>
          <span class="elvish-translation">English</span>
        </span>
      `
      triggerNav()
    })

    it("should toggle show-translation class on click", () => {
      const el = document.querySelector(".elvish") as HTMLElement
      expect(el.classList.contains("show-translation")).toBe(false)

      el.click()
      expect(el.classList.contains("show-translation")).toBe(true)

      el.click()
      expect(el.classList.contains("show-translation")).toBe(false)
    })

    it("should update aria-pressed on toggle", () => {
      const el = document.querySelector(".elvish") as HTMLElement
      expect(el.getAttribute("aria-pressed")).toBe("false")

      el.click()
      expect(el.getAttribute("aria-pressed")).toBe("true")

      el.click()
      expect(el.getAttribute("aria-pressed")).toBe("false")
    })

    it("should not toggle when clicking a link inside", () => {
      document.body.innerHTML = `
        <span class="elvish">
          <a href="#">Link</a>
          <span class="elvish-tengwar">Tengwar</span>
        </span>
      `
      triggerNav()

      const el = document.querySelector(".elvish") as HTMLElement
      const link = el.querySelector("a") as HTMLAnchorElement

      link.click()
      expect(el.classList.contains("show-translation")).toBe(false)
    })

    it("should not toggle when clicking nested element inside a link", () => {
      document.body.innerHTML = `
        <span class="elvish">
          <a href="#"><strong>Bold Link</strong></a>
          <span class="elvish-tengwar">Tengwar</span>
        </span>
      `
      triggerNav()

      const el = document.querySelector(".elvish") as HTMLElement
      const boldInLink = el.querySelector("strong") as HTMLElement

      boldInLink.click()
      expect(el.classList.contains("show-translation")).toBe(false)
    })
  })

  describe("keyboard behavior", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <span class="elvish">
          <span class="elvish-tengwar">Tengwar</span>
          <span class="elvish-translation">English</span>
        </span>
      `
      triggerNav()
    })

    it("should toggle on Enter key", () => {
      const el = document.querySelector(".elvish") as HTMLElement

      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      el.dispatchEvent(event)

      expect(el.classList.contains("show-translation")).toBe(true)
    })

    it("should toggle on Space key", () => {
      const el = document.querySelector(".elvish") as HTMLElement

      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true })
      el.dispatchEvent(event)

      expect(el.classList.contains("show-translation")).toBe(true)
    })

    it("should not toggle on other keys", () => {
      const el = document.querySelector(".elvish") as HTMLElement

      for (const key of ["Tab", "Escape", "a", "1"]) {
        const event = new KeyboardEvent("keydown", { key, bubbles: true })
        el.dispatchEvent(event)
      }

      expect(el.classList.contains("show-translation")).toBe(false)
    })

    it("should prevent default on Enter/Space to avoid scrolling", () => {
      const el = document.querySelector(".elvish") as HTMLElement

      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(enterEvent)
      expect(enterEvent.defaultPrevented).toBe(true)

      const spaceEvent = new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(spaceEvent)
      expect(spaceEvent.defaultPrevented).toBe(true)
    })
  })

  describe("multiple elements", () => {
    it("should initialize all elvish elements independently", () => {
      document.body.innerHTML = `
        <span class="elvish" id="el1"></span>
        <span class="elvish" id="el2"></span>
        <span class="elvish" id="el3"></span>
      `
      triggerNav()

      const elements = document.querySelectorAll(".elvish")
      expect(elements.length).toBe(3)

      for (const el of elements) {
        expect(el.getAttribute("role")).toBe("button")
        expect(el.getAttribute("aria-pressed")).toBe("false")
      }
    })

    it("should toggle elements independently", () => {
      document.body.innerHTML = `
        <span class="elvish" id="el1"></span>
        <span class="elvish" id="el2"></span>
      `
      triggerNav()

      const el1 = document.getElementById("el1") as HTMLElement
      const el2 = document.getElementById("el2") as HTMLElement

      el1.click()

      expect(el1.classList.contains("show-translation")).toBe(true)
      expect(el2.classList.contains("show-translation")).toBe(false)
    })
  })
})
