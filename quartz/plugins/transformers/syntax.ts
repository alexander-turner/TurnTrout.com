import rehypePrettyCode, {
  type Options as CodeOptions,
  type Theme as CodeTheme,
} from "rehype-pretty-code"

import type { QuartzTransformerPlugin } from "../types"

interface Theme extends Record<string, CodeTheme> {
  light: CodeTheme
  dark: CodeTheme
}

interface SyntaxHighlightingOptions {
  theme?: Theme
  keepBackground?: boolean
}

const defaultOptions: SyntaxHighlightingOptions = {
  theme: {
    light: "github-light",
    dark: "github-dark",
  },
  keepBackground: false,
}

// skipcq: JS-D1001
export const SyntaxHighlighting: QuartzTransformerPlugin<SyntaxHighlightingOptions> = (
  userOpts?: Partial<SyntaxHighlightingOptions>,
) => {
  const opts: Partial<CodeOptions> = { ...defaultOptions, ...userOpts }

  return {
    name: "SyntaxHighlighting",
    htmlPlugins() {
      return [[rehypePrettyCode, opts]]
    },
  }
}
