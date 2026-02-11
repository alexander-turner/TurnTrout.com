import { describe, it, expect } from "@jest/globals"
import { type Parent } from "hast"
import { VFile } from "vfile"

import { type GlobalConfiguration } from "../../cfg"
import {
  defaultCardUrl,
  defaultDescription,
  normalizeNbsp,
  defaultTitle,
  appleTouchIconUrl,
  faviconUrl,
  faviconMimeType,
} from "../../components/constants"
import { type ProcessedContent } from "../../plugins/vfile"
import { backgroundDark, backgroundLight } from "../../styles/variables"
import { escapeHTML } from "../escape"
import { renderHead, maybeProduceVideoTag } from "../head"
import { type FullSlug } from "../path"

describe("maybeProduceVideoTag", () => {
  it.each([
    { videoPreview: undefined, expected: "" },
    { videoPreview: "", expected: "" },
    {
      videoPreview: "https://example.com/video.mp4",
      expected: '<meta property="og:video" content="https://example.com/video.mp4" />',
    },
  ])(
    "should return correct meta tag for videoPreview: $videoPreview",
    ({ videoPreview, expected }) => {
      const result = maybeProduceVideoTag(videoPreview)
      expect(result).toBe(expected)
    },
  )
})

describe("renderHead", () => {
  const mockConfig: GlobalConfiguration = {
    baseUrl: "turntrout.com",
  } as GlobalConfiguration

  const createMockData = (frontmatter: Record<string, unknown> = {}) => {
    return {
      frontmatter: {
        title: "Test Article",
        description: "Test description",
        ...frontmatter,
      },
    } as Record<string, unknown>
  }

  const createMockProcessedContent = (
    frontmatter: Record<string, unknown> = {},
  ): ProcessedContent => {
    const vfile = new VFile("")
    vfile.data = createMockData(frontmatter)
    return [{ type: "root", children: [] } as Parent, vfile] as ProcessedContent
  }

  describe("basic metadata generation", () => {
    it("should generate basic meta tags for data input", () => {
      const data = createMockData({
        title: "My Test Article",
        description: "This is a test description",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-article" as FullSlug,
      })

      const normalized = normalizeNbsp(result)
      expect(normalized).toContain("<title>My Test Article</title>")
      expect(normalized).toContain('<meta name="description" content="This is a test description">')
      expect(normalized).toContain(
        '<link rel="canonical" href="https://turntrout.com/test-article" />',
      )
      expect(normalized).toContain(
        `<meta name="theme-color" content="${backgroundLight}" media="(prefers-color-scheme: light)" />`,
      )
      expect(normalized).toContain(
        `<meta name="theme-color" content="${backgroundDark}" media="(prefers-color-scheme: dark)" />`,
      )
      expect(normalized).toContain('<meta property="og:title" content="My Test Article" />')
      expect(normalized).toContain('<meta property="og:type" content="article" />')
      expect(normalized).toContain('<meta property="og:site_name" content="The Pond" />')
      expect(normalized).toContain('<meta name="twitter:card" content="summary_large_image" />')
      expect(normalized).toContain('<meta name="twitter:site" content="@Turn_Trout" />')
    })

    it("should generate basic meta tags for ProcessedContent input", () => {
      const content = createMockProcessedContent({
        title: "Processed Content Title",
        description: "Processed content description",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: content[1].data,
        slug: "processed-content" as FullSlug,
      })

      const normalized = normalizeNbsp(result)
      expect(normalized).toContain("<title>Processed Content Title</title>")
      expect(normalized).toContain(
        '<meta name="description" content="Processed content description">',
      )
      expect(normalized).toContain('<meta property="og:title" content="Processed Content Title" />')
    })

    it("should use default values when frontmatter is missing", () => {
      const data = { frontmatter: undefined }

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "no-frontmatter" as FullSlug,
      })

      const normalized = normalizeNbsp(result)
      expect(normalized).toContain(`<title>${defaultTitle}</title>`)
      expect(normalized).toContain(`<meta name="description" content="${defaultDescription}">`)
      expect(normalized).toContain(
        `<link rel="icon" href="${escapeHTML(faviconUrl)}" type="${escapeHTML(faviconMimeType)}" />`,
      )
      expect(normalized).toContain(`<link rel="apple-touch-icon" href="${appleTouchIconUrl}" />`)
    })

    it("should include all required meta tags in complete structure", () => {
      const data = createMockData({
        title: "Complete Test",
        description: "Complete description",
        authors: ["Test Author"],
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "complete-test" as FullSlug,
      })

      const normalized = normalizeNbsp(result)
      // Verify all major sections are present
      expect(normalized).toContain("<title>Complete Test</title>")
      expect(normalized).toContain('<meta name="description" content="Complete description">')
      expect(normalized).toContain(
        '<link rel="canonical" href="https://turntrout.com/complete-test" />',
      )

      // Open Graph tags
      expect(normalized).toContain('<meta property="og:title" content="Complete Test" />')
      expect(normalized).toContain('<meta property="og:type" content="article" />')
      expect(normalized).toContain(
        '<meta property="og:description" content="Complete description">',
      )
      expect(normalized).toContain('<meta property="og:site_name" content="The Pond" />')
      expect(normalized).toContain(`<meta property="og:image" content="${defaultCardUrl}" />`)

      // Twitter tags
      expect(normalized).toContain('<meta name="twitter:card" content="summary_large_image" />')
      expect(normalized).toContain('<meta name="twitter:title" content="Complete Test" />')
      expect(normalized).toContain('name="twitter:description"')
      expect(normalized).toContain('content="Complete description"')
      expect(normalized).toContain('<meta name="twitter:site" content="@Turn_Trout" />')
      expect(normalized).toContain(`<meta name="twitter:image" content="${defaultCardUrl}" />`)

      // Author tags
      expect(normalized).toContain('<meta name="twitter:label1" content="Written by" />')
      expect(normalized).toContain('<meta name="twitter:data1" content="Test Author" />')

      // Favicon tags
      expect(normalized).toContain(
        `<link rel="icon" href="${faviconUrl}" type="${faviconMimeType}" />`,
      )
      expect(normalized).toContain(`<link rel="apple-touch-icon" href="${appleTouchIconUrl}" />`)
    })
  })

  describe("URL generation", () => {
    it("should generate correct URLs with custom baseUrl", () => {
      const customConfig = { ...mockConfig, baseUrl: "example.com" }
      const data = createMockData()

      const result = renderHead({
        cfg: customConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain('<meta property="og:url" content="https://example.com/test-page" />')
      expect(result).toContain('<link rel="canonical" href="https://example.com/test-page" />')
    })

    it("should handle redirect URLs correctly", () => {
      const data = createMockData()

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "canonical-page" as FullSlug,
        redirect: {
          slug: "old-page" as FullSlug,
          to: "canonical-page" as FullSlug,
        },
      })

      expect(result).toContain('<meta property="og:url" content="./canonical-page" />')
    })

    it("should use permalink when available", () => {
      const data = createMockData({
        permalink: "https://example.com/custom-permalink",
      })
      ;(data as Record<string, unknown>).permalink = "https://example.com/custom-permalink"

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(
        '<meta property="og:url" content="https://example.com/custom-permalink" />',
      )
    })
  })

  describe("image handling", () => {
    it("should use custom card image when provided", () => {
      const customImageUrl = "https://example.com/custom-image.jpg"
      const data = createMockData({
        card_image: customImageUrl,
        description: "Custom image description",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<meta property="og:image" content="${customImageUrl}" />`)
      expect(result).toContain(
        '<meta property="og:image:alt" content="Custom image description" />',
      )
      expect(result).toContain(`<meta name="twitter:image" content="${customImageUrl}" />`)
    })

    it("should use default card image and alt text when no custom image", () => {
      const data = createMockData()

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<meta property="og:image" content="${defaultCardUrl}" />`)
      expect(result).toContain(
        '<meta property="og:image:alt" content="A pond containing a trout and a goose peacefully swimming near a castle." />',
      )
      expect(result).toContain(`<meta name="twitter:image" content="${defaultCardUrl}" />`)
    })

    it("should handle video preview when provided", () => {
      const videoUrl = "https://example.com/video.mp4"
      const data = createMockData({
        video_preview_link: videoUrl,
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<meta property="og:video" content="${videoUrl}" />`)
    })

    it("should not include video tag when video preview is not provided", () => {
      const data = createMockData() // No video_preview_link at all

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).not.toContain('<meta property="og:video"')
      expect(result).toContain('<meta property="og:image"') // Should fall back to image
    })

    it("should not include video tag when video preview is empty string", () => {
      const data = createMockData({
        video_preview_link: "",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).not.toContain('<meta property="og:video"')
      expect(result).toContain('<meta property="og:image"') // Should fall back to image
    })
  })

  describe("author handling", () => {
    it("should include author meta tags when authors are provided", () => {
      const data = createMockData({
        authors: ["John Doe", "Jane Smith"],
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain('<meta name="twitter:label1" content="Written by" />')
      expect(result).toContain('<meta name="twitter:data1" content="John Doe and Jane Smith" />')
    })

    it("should not include author meta tags when authors are missing", () => {
      const data = createMockData()

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).not.toContain('<meta name="twitter:label1"')
      expect(result).not.toContain('<meta name="twitter:data1"')
    })
  })

  describe("description handling", () => {
    it("should trim description whitespace", () => {
      const data = createMockData({
        description: "  Description with whitespace  ",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain('<meta name="description" content="Description with whitespace">')
      expect(result).toContain(
        '<meta property="og:description" content="Description with whitespace">',
      )
      expect(result).toContain('name="twitter:description"')
      expect(result).toContain('content="Description with whitespace"')
    })

    it("should handle non-string description values", () => {
      const data = createMockData({
        description: null,
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      // Should fall back to default description
      expect(result).toContain(`<meta name="description" content="${defaultDescription}">`)
      expect(result).toContain(`<meta property="og:description" content="${defaultDescription}">`)
      expect(result).toContain(`content="${defaultDescription}"`)
    })

    it("should handle empty description", () => {
      const data = createMockData({
        description: "",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      // Empty string when trimmed is still empty string, not undefined, so it doesn't fall back
      expect(result).toContain('<meta name="description" content="">')
      expect(result).toContain('<meta property="og:description" content="">')
    })
  })

  describe("favicon handling", () => {
    it("should include favicon link tags", () => {
      const data = createMockData()

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<link rel="icon" href="${faviconUrl}" type="${faviconMimeType}" />`)
      expect(result).toContain(`<link rel="apple-touch-icon" href="${appleTouchIconUrl}" />`)
    })
  })

  describe("edge cases", () => {
    it("should handle missing frontmatter gracefully", () => {
      const data = {}

      expect(() => {
        renderHead({
          cfg: mockConfig,
          fileData: data,
          slug: "test-page" as FullSlug,
        })
      }).not.toThrow()
    })

    it("should handle empty frontmatter gracefully", () => {
      const data = { frontmatter: undefined }

      const result = renderHead({
        cfg: mockConfig,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(normalizeNbsp(result)).toContain(`<title>${defaultTitle}</title>`)
      expect(normalizeNbsp(result)).toContain(
        `<meta property="og:site_name" content="${defaultTitle}" />`,
      )
    })

    it("should handle missing baseUrl by using default", () => {
      const configWithoutBaseUrl = { ...mockConfig, baseUrl: undefined }
      const data = createMockData()

      const result = renderHead({
        cfg: configWithoutBaseUrl,
        fileData: data,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(
        '<meta property="og:url" content="https://turntrout.com/test-page" />',
      )
    })
  })

  it("should escape special characters in title and description", () => {
    const data = createMockData({
      title: 'Title with "quotes" & ampersands',
      description: "Description with <script>tags</script>",
    })

    const result = renderHead({
      cfg: mockConfig,
      fileData: data,
      slug: "test-escape" as FullSlug,
    })

    expect(result).toContain("<title>Title with “Quotes” &amp; Ampersands</title>")
    expect(result).toContain(
      '<meta property="og:title" content="Title with “Quotes” &amp; Ampersands" />',
    )
    expect(result).toContain(
      '<meta name="twitter:title" content="Title with “Quotes” &amp; Ampersands" />',
    )

    expect(result).toContain(
      '<meta name="description" content="Description with &lt;script&gt;tags&lt;/script&gt;">',
    )
    expect(result).toContain(
      '<meta property="og:description" content="Description with &lt;script&gt;tags&lt;/script&gt;">',
    )
    const twitterDescRegex =
      /<meta\s+name="twitter:description"\s+content="Description with &lt;script&gt;tags&lt;\/script&gt;"\s*\/?>/
    expect(result).toMatch(twitterDescRegex)
  })

  it("should escape special characters in author names", () => {
    const data = createMockData({
      authors: ["Author <Name>"],
    })

    const result = renderHead({
      cfg: mockConfig,
      fileData: data,
      slug: "test-escape" as FullSlug,
    })

    expect(result).toContain('<meta name="twitter:data1" content="Author &lt;Name&gt;" />')
  })

  it("should escape special characters in URLs and permalinks", () => {
    const data = createMockData({
      card_image: "https://example.com/image?a=1&b=2",
    })
    ;(data as Record<string, unknown>).permalink = "https://example.com/page?a=1&b=2"

    const result = renderHead({
      cfg: mockConfig,
      fileData: data,
      slug: "test-escape" as FullSlug,
    })

    expect(result).toContain(
      '<meta property="og:image" content="https://example.com/image?a=1&amp;b=2" />',
    )
    expect(result).toContain(
      '<meta name="twitter:image" content="https://example.com/image?a=1&amp;b=2" />',
    )
    expect(result).toContain(
      '<meta property="og:url" content="https://example.com/page?a=1&amp;b=2" />',
    )
  })
})
