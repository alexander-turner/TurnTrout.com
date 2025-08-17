import { describe, it, expect } from "@jest/globals"
import { VFile } from "vfile"

import { type GlobalConfiguration } from "../../cfg"
import {
  defaultCardUrl,
  defaultDescription,
  defaultTitle,
  faviconUrl,
} from "../../components/constants"
import { type ProcessedContent } from "../../plugins/vfile"
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
    locale: "en-US",
    baseUrl: "turntrout.com",
  } as GlobalConfiguration

  const createMockVFile = (frontmatter: Record<string, unknown> = {}): VFile => {
    const vfile = new VFile("")
    vfile.data = {
      frontmatter: {
        title: "Test Article",
        description: "Test description",
        ...frontmatter,
      },
    }
    return vfile
  }

  const createMockProcessedContent = (
    frontmatter: Record<string, unknown> = {},
  ): ProcessedContent => {
    const vfile = createMockVFile(frontmatter)
    return [{ type: "root", children: [] }, vfile] as unknown as ProcessedContent
  }

  describe("basic metadata generation", () => {
    it("should generate basic meta tags for VFile input", () => {
      const vfile = createMockVFile({
        title: "My Test Article",
        description: "This is a test description",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-article" as FullSlug,
      })

      expect(result).toContain("<title>My Test Article</title>")
      expect(result).toContain('<meta name="description" content="This is a test description">')
      expect(result).toContain('<meta property="og:title" content="My Test Article" />')
      expect(result).toContain('<meta property="og:type" content="article" />')
      expect(result).toContain('<meta property="og:site_name" content="The Pond" />')
      expect(result).toContain('<meta name="twitter:card" content="summary_large_image" />')
      expect(result).toContain('<meta name="twitter:site" content="@Turn_Trout" />')
    })

    it("should generate basic meta tags for ProcessedContent input", () => {
      const content = createMockProcessedContent({
        title: "Processed Content Title",
        description: "Processed content description",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: content,
        slug: "processed-content" as FullSlug,
      })

      expect(result).toContain("<title>Processed Content Title</title>")
      expect(result).toContain('<meta name="description" content="Processed content description">')
      expect(result).toContain('<meta property="og:title" content="Processed Content Title" />')
    })

    it("should use default values when frontmatter is missing", () => {
      const vfile = new VFile("")
      vfile.data = { frontmatter: undefined }

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "no-frontmatter" as FullSlug,
      })

      expect(result).toContain(`<title>${defaultTitle}</title>`)
      expect(result).toContain(`<meta name="description" content="${defaultDescription}">`)
      expect(result).toContain(`<link rel="icon" href="${faviconUrl}" type="image/x-icon" />`)
      expect(result).toContain(`<link rel="apple-touch-icon" href="${faviconUrl}" />`)
    })

    it("should include all required meta tags in complete structure", () => {
      const vfile = createMockVFile({
        title: "Complete Test",
        description: "Complete description",
        authors: "Test Author",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "complete-test" as FullSlug,
      })

      // Verify all major sections are present
      expect(result).toContain("<title>Complete Test</title>")
      expect(result).toContain('<meta name="description" content="Complete description">')

      // Open Graph tags
      expect(result).toContain('<meta property="og:title" content="Complete Test" />')
      expect(result).toContain('<meta property="og:type" content="article" />')
      expect(result).toContain('<meta property="og:description" content="Complete description">')
      expect(result).toContain('<meta property="og:site_name" content="The Pond" />')
      expect(result).toContain(`<meta property="og:image" content="${defaultCardUrl}" />`)

      // Twitter tags
      expect(result).toContain('<meta name="twitter:card" content="summary_large_image" />')
      expect(result).toContain('<meta name="twitter:title" content="Complete Test" />')
      expect(result).toContain('name="twitter:description"')
      expect(result).toContain('content="Complete description"')
      expect(result).toContain('<meta name="twitter:site" content="@Turn_Trout" />')
      expect(result).toContain(`<meta name="twitter:image" content="${defaultCardUrl}" />`)

      // Author tags
      expect(result).toContain('<meta name="twitter:label1" content="Written by" />')
      expect(result).toContain('<meta name="twitter:data1" content="Test Author" />')

      // Favicon tags
      expect(result).toContain(`<link rel="icon" href="${faviconUrl}" type="image/x-icon" />`)
      expect(result).toContain(`<link rel="apple-touch-icon" href="${faviconUrl}" />`)
    })
  })

  describe("URL generation", () => {
    it("should generate correct URLs with custom baseUrl", () => {
      const customConfig = { ...mockConfig, baseUrl: "example.com" }
      const vfile = createMockVFile()

      const result = renderHead({
        cfg: customConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain('<meta property="og:url" content="https://example.com/test-page" />')
    })

    it("should handle redirect URLs correctly", () => {
      const vfile = createMockVFile()

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "canonical-page" as FullSlug,
        redirect: {
          slug: "old-page" as FullSlug,
          to: "canonical-page" as FullSlug,
        },
      })

      expect(result).toContain('<meta property="og:url" content="./canonical-page" />')
    })

    it("should use permalink when available", () => {
      const vfile = createMockVFile({
        permalink: "https://example.com/custom-permalink",
      })
      vfile.data.permalink = "https://example.com/custom-permalink"

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
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
      const vfile = createMockVFile({
        card_image: customImageUrl,
        description: "Custom image description",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<meta property="og:image" content="${customImageUrl}" />`)
      expect(result).toContain(
        '<meta property="og:image:alt" content="Custom image description" />',
      )
      expect(result).toContain(`<meta name="twitter:image" content="${customImageUrl}" />`)
    })

    it("should use default card image and alt text when no custom image", () => {
      const vfile = createMockVFile()

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
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
      const vfile = createMockVFile({
        video_preview_link: videoUrl,
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<meta property="og:video" content="${videoUrl}" />`)
      expect(result).not.toContain('<meta property="og:image"')
    })

    it("should not include video tag when video preview is not provided", () => {
      const vfile = createMockVFile() // No video_preview_link at all

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).not.toContain('<meta property="og:video"')
      expect(result).toContain('<meta property="og:image"') // Should fall back to image
    })

    it("should not include video tag when video preview is empty string", () => {
      const vfile = createMockVFile({
        video_preview_link: "",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).not.toContain('<meta property="og:video"')
      expect(result).toContain('<meta property="og:image"') // Should fall back to image
    })
  })

  describe("author handling", () => {
    it("should include author meta tags when authors are provided", () => {
      const vfile = createMockVFile({
        authors: "John Doe, Jane Smith",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain('<meta name="twitter:label1" content="Written by" />')
      expect(result).toContain('<meta name="twitter:data1" content="John Doe, Jane Smith" />')
    })

    it("should not include author meta tags when authors are missing", () => {
      const vfile = createMockVFile()

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).not.toContain('<meta name="twitter:label1"')
      expect(result).not.toContain('<meta name="twitter:data1"')
    })
  })

  describe("description handling", () => {
    it("should trim description whitespace", () => {
      const vfile = createMockVFile({
        description: "  Description with whitespace  ",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
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
      const vfile = createMockVFile({
        description: null,
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      // Should fall back to default description
      expect(result).toContain(`<meta name="description" content="${defaultDescription}">`)
      expect(result).toContain(`<meta property="og:description" content="${defaultDescription}">`)
      expect(result).toContain(`content="${defaultDescription}"`)
    })

    it("should handle empty description", () => {
      const vfile = createMockVFile({
        description: "",
      })

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      // Empty string when trimmed is still empty string, not undefined, so it doesn't fall back
      expect(result).toContain('<meta name="description" content="">')
      expect(result).toContain('<meta property="og:description" content="">')
    })
  })

  describe("favicon handling", () => {
    it("should include favicon link tags", () => {
      const vfile = createMockVFile()

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<link rel="icon" href="${faviconUrl}" type="image/x-icon" />`)
      expect(result).toContain(`<link rel="apple-touch-icon" href="${faviconUrl}" />`)
    })
  })

  describe("edge cases", () => {
    it("should handle missing frontmatter gracefully", () => {
      const vfile = new VFile("")
      vfile.data = {}

      expect(() => {
        renderHead({
          cfg: mockConfig,
          fileData: vfile,
          slug: "test-page" as FullSlug,
        })
      }).not.toThrow()
    })

    it("should handle empty frontmatter gracefully", () => {
      const vfile = new VFile("")
      vfile.data = { frontmatter: undefined }

      const result = renderHead({
        cfg: mockConfig,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(`<title>${defaultTitle}</title>`)
      expect(result).toContain(`<meta property="og:site_name" content="${defaultTitle}" />`)
    })

    it("should handle missing baseUrl by using default", () => {
      const configWithoutBaseUrl = { ...mockConfig, baseUrl: undefined }
      const vfile = createMockVFile()

      const result = renderHead({
        cfg: configWithoutBaseUrl,
        fileData: vfile,
        slug: "test-page" as FullSlug,
      })

      expect(result).toContain(
        '<meta property="og:url" content="https://turntrout.com/test-page" />',
      )
    })
  })
})
