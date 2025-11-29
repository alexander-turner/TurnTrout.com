import {
  defaultListPageLayout,
  sharedPageComponents,
} from "../../../config/quartz/quartz.layout";
import BodyConstructor from "../../components/Body";
import HeaderConstructor from "../../components/Header";
import AllTagsContent from "../../components/pages/AllTagsContent";
import {
  allTagsSlug,
  allTagsTitle,
  allTagsDescription,
} from "../../components/pages/AllTagsContent";
import { pageResources, renderPage } from "../../components/renderPage";
import { type QuartzComponentProps } from "../../components/types";
import DepGraph from "../../depgraph";
import { type FilePath, pathToRoot } from "../../util/path";
import { type StaticResources } from "../../util/resources";
import { type QuartzEmitterPlugin } from "../types";
import { type ProcessedContent, defaultProcessedContent } from "../vfile";
import { write } from "./helpers";

export const AllTagsPage: QuartzEmitterPlugin = () => {
  const opts = {
    ...defaultListPageLayout,
    ...sharedPageComponents,
    pageBody: AllTagsContent,
  };

  const {
    head: Head,
    header,
    beforeBody,
    pageBody,
    left,
    right,
    footer: Footer,
  } = opts;
  const Header = HeaderConstructor();
  const Body = BodyConstructor();

  return {
    name: "AllTagsPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...left,
        ...right,
        Footer,
      ];
    },
    // skipcq: JS-0116 have to return async for type signature
    async getDependencyGraph() {
      const graph = new DepGraph<FilePath>();
      return graph;
    },
    async emit(
      ctx,
      content: ProcessedContent[],
      resources: StaticResources,
    ): Promise<FilePath[]> {
      const slug = allTagsSlug;
      const externalResources = pageResources(pathToRoot(slug), resources);
      const [tree, file] = defaultProcessedContent({
        slug,
        frontmatter: {
          title: allTagsTitle,
          tags: ["website"],
          aliases: ["tags", "all-tags", "tags-index"],
        },
        description: allTagsDescription,
        text: "Information about the tags used in this site.",
      });

      const componentData: QuartzComponentProps = {
        ctx,
        fileData: file.data,
        externalResources,
        cfg: ctx.cfg.configuration,
        children: [],
        tree,
        allFiles: content.map((c) => c[1].data),
      };

      const renderedContent = renderPage(
        ctx.cfg.configuration,
        slug,
        componentData,
        opts,
        externalResources,
      );

      const fp = await write({
        ctx,
        content: renderedContent,
        slug,
        ext: ".html",
      });

      return [fp];
    },
  };
};
