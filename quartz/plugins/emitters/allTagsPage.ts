import AllTagsContent, {
  allTagsSlug,
  allTagsTitle,
  allTagsDescription,
} from "../../components/pages/AllTagsContent"
import { createListPageEmitter } from "./helpers"

export const AllTagsPage = createListPageEmitter({
  name: "AllTagsPage",
  pageBody: AllTagsContent,
  slug: allTagsSlug,
  title: allTagsTitle,
  description: allTagsDescription,
  frontmatter: {
    aliases: ["tags", "all-tags", "tags-index"],
    hide_reading_time: true,
  },
  text: "Information about the tags used in this site.",
})
