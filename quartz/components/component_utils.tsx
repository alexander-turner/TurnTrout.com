import { titleCase } from "title-case"
import { applyTextTransforms } from "../plugins/transformers/formatting_improvement_html"

export function formatTitle(title: string): string {
  // Replace single quotes with double quotes for consistency
  title = title.replace(/( |^)'/g, '$1"').replace(/'([ ?!.]|$)/g, '"$1')
  title = applyTextTransforms(title)

  // Convert title to title case
  title = titleCase(title, { locale: "en-US" })
  return title
}
