import AllPosts, { allDescription, allSlug, allTitle } from "../../components/pages/AllPosts"
import { createListPageEmitter } from "./helpers"

export const AllPostsPage = createListPageEmitter({
  name: "AllPostsPage",
  pageBody: AllPosts,
  slug: allSlug,
  title: allTitle,
  description: allDescription,
  frontmatter: {
    tags: ["website"],
    aliases: ["recent-posts", "recent", "all"],
  },
})
