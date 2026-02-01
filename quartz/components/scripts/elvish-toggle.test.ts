/**
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, afterEach, expect } from "@jest/globals";
import { type FullSlug } from "../../util/path";
import {
  toggleElvish,
  handleElvishKeydown,
  handleElvishClick,
  createHelpText,
  initializeElvishElements,
} from "./elvish-toggle";

const triggerNav = () => {
  document.dispatchEvent(
    new CustomEvent("nav", { detail: { url: "" as FullSlug } }),
  );
};

describe("elvish-toggle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("toggleElvish", () => {
    it("should toggle show-translation class", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");

      toggleElvish.call(el);
      expect(el.classList.contains("show-translation")).toBe(true);
      expect(el.getAttribute("aria-pressed")).toBe("true");

      toggleElvish.call(el);
      expect(el.classList.contains("show-translation")).toBe(false);
      expect(el.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("handleElvishKeydown", () => {
    it("should toggle on Enter key", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");

      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      handleElvishKeydown.call(el, event);

      expect(el.classList.contains("show-translation")).toBe(true);
      expect(event.defaultPrevented).toBe(true);
    });

    it("should toggle on Space key", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");

      const event = new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      });
      handleElvishKeydown.call(el, event);

      expect(el.classList.contains("show-translation")).toBe(true);
      expect(event.defaultPrevented).toBe(true);
    });

    it("should not toggle on other keys", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");

      for (const key of ["Tab", "Escape", "a", "1"]) {
        const event = new KeyboardEvent("keydown", {
          key,
          bubbles: true,
          cancelable: true,
        });
        handleElvishKeydown.call(el, event);
        expect(event.defaultPrevented).toBe(false);
      }

      expect(el.classList.contains("show-translation")).toBe(false);
    });
  });

  describe("handleElvishClick", () => {
    it("should toggle on click", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");

      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: el });
      handleElvishClick.call(el, event);

      expect(el.classList.contains("show-translation")).toBe(true);
    });

    it("should not toggle when clicking a link", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");
      const link = document.createElement("a");
      el.appendChild(link);

      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: link });
      handleElvishClick.call(el, event);

      expect(el.classList.contains("show-translation")).toBe(false);
    });

    it("should not toggle when clicking nested element inside link", () => {
      const el = document.createElement("span");
      el.setAttribute("aria-pressed", "false");
      const link = document.createElement("a");
      const strong = document.createElement("strong");
      link.appendChild(strong);
      el.appendChild(link);

      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: strong });
      handleElvishClick.call(el, event);

      expect(el.classList.contains("show-translation")).toBe(false);
    });
  });

  describe("createHelpText", () => {
    it("should create a visually-hidden span with correct content", () => {
      const helpText = createHelpText();

      expect(helpText.id).toBe("elvish-help");
      expect(helpText.className).toBe("visually-hidden");
      expect(helpText.textContent).toBe(
        "Toggle between Elvish and English translation",
      );
    });
  });

  describe("initializeElvishElements", () => {
    it("should add accessibility attributes to elvish elements", () => {
      document.body.innerHTML = `
        <span class="elvish">
          <span class="elvish-tengwar">Tengwar</span>
          <span class="elvish-translation">English</span>
        </span>
      `;
      initializeElvishElements();

      const el = document.querySelector(".elvish") as HTMLElement;
      expect(el.getAttribute("tabindex")).toBe("0");
      expect(el.getAttribute("role")).toBe("button");
      expect(el.getAttribute("aria-pressed")).toBe("false");
      expect(el.getAttribute("aria-describedby")).toBe("elvish-help");
    });

    it("should create help text when elvish elements exist", () => {
      document.body.innerHTML = `<span class="elvish"></span>`;
      initializeElvishElements();

      const helpText = document.getElementById("elvish-help");
      expect(helpText).not.toBeNull();
    });

    it("should not create help text when no elvish elements exist", () => {
      document.body.innerHTML = `<span class="other"></span>`;
      initializeElvishElements();

      const helpText = document.getElementById("elvish-help");
      expect(helpText).toBeNull();
    });

    it("should not duplicate help text on multiple calls", () => {
      document.body.innerHTML = `<span class="elvish"></span>`;
      initializeElvishElements();
      initializeElvishElements();
      initializeElvishElements();

      const helpTexts = document.querySelectorAll("#elvish-help");
      expect(helpTexts.length).toBe(1);
    });

    it("should not re-initialize already initialized elements", () => {
      document.body.innerHTML = `<span class="elvish"></span>`;
      initializeElvishElements();

      const el = document.querySelector(".elvish") as HTMLElement;
      el.classList.add("show-translation");
      el.setAttribute("aria-pressed", "true");

      initializeElvishElements(); // Should not reset

      expect(el.classList.contains("show-translation")).toBe(true);
      expect(el.getAttribute("aria-pressed")).toBe("true");
    });

    it("should initialize all elvish elements independently", () => {
      document.body.innerHTML = `
        <span class="elvish" id="el1"></span>
        <span class="elvish" id="el2"></span>
        <span class="elvish" id="el3"></span>
      `;
      initializeElvishElements();

      const elements = document.querySelectorAll(".elvish");
      expect(elements.length).toBe(3);

      for (const el of elements) {
        expect(el.getAttribute("role")).toBe("button");
        expect(el.getAttribute("aria-pressed")).toBe("false");
      }
    });
  });

  describe("nav event integration", () => {
    it("should initialize elements on nav event", () => {
      document.body.innerHTML = `<span class="elvish"></span>`;
      triggerNav();

      const el = document.querySelector(".elvish") as HTMLElement;
      expect(el.getAttribute("role")).toBe("button");
    });
  });
});
