import type { LinkAnnotation } from "../annotations"

/** Canonical URL of the fixture annotation. */
export const TEST_ANNOTATION_KEY = "https://en.wikipedia.org/wiki/Reinforcement_learning"

/** A valid manifest entry for tests; override fields as needed. */
export function testAnnotation(overrides: Partial<LinkAnnotation> = {}): LinkAnnotation {
  return {
    source: "wikipedia",
    title: "Reinforcement learning",
    abstract_html: "<p>Reinforcement learning is…</p>",
    attribution: {
      text: "Wikipedia",
      license: "CC BY-SA 4.0",
      license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    retrieved: "2026-07-05",
    ...overrides,
  }
}
