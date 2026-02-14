/**
 * Strips Obsidian/Markdown syntax artifacts from gathered text for search indexing.
 * At the MDAST stage, wiki-links, callouts, and LaTeX haven't been processed
 * by their respective transformers yet, so we clean them here.
 */
export function cleanSearchText(text: string): string {
  return (
    text
      // Obsidian embeds: ![[something]] → remove
      .replace(/!\[\[[^\]]*\]\]/g, "")
      // Wiki-links with display text: [[page#section|display]] → display
      .replace(/\[\[[^\]|#]*(?:#[^\]|]*)?\|(?<display>[^\]]+)\]\]/g, "$<display>")
      // Wiki-links without display text: [[page#section]] or [[page]] → page
      .replace(/\[\[(?<page>[^\]|#]+)(?:#[^\]|]*)?\]\]/g, "$<page>")
      // Callout markers: [!type] or [!type]+ or [!type]- → remove
      .replace(/\[!\w+\][+-]?/g, "")
      // LaTeX display math: $$...$$ → remove
      .replace(/\$\$[\s\S]*?\$\$/g, "")
      // LaTeX inline math: $...$ → remove (but not monetary amounts like $5)
      .replace(/\$(?!\d)[^$\n]+?\$/g, "")
      // Collapse multiple spaces into one and trim
      .replace(/ {2,}/g, " ")
      .trim()
  )
}
