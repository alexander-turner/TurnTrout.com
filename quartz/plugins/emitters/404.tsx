import { sharedPageComponents } from "../../../config/quartz/quartz.layout";
import { type FullPageLayout } from "../../cfg";
import { ContentMeta, NotFound } from "../../components";
import BodyConstructor from "../../components/Body";
import { pageResources, renderPage } from "../../components/renderPage";
import { type QuartzComponentProps } from "../../components/types";
import DepGraph from "../../depgraph";
import { type FilePath, type FullSlug } from "../../util/path";
import { type QuartzEmitterPlugin } from "../types";
import { defaultProcessedContent } from "../vfile";
import { write } from "./helpers";

export const NotFoundPage: QuartzEmitterPlugin = () => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    pageBody: NotFound(),
    beforeBody: [],
    right: [ContentMeta()],
  };

  const { head: Head, pageBody, footer: Footer } = opts;
  const Body = BodyConstructor();

  return {
    name: "404Page",
    getQuartzComponents() {
      return [Head, Body, pageBody, Footer];
    },
    async getDependencyGraph() {
      return new DepGraph<FilePath>();
    },
    async emit(ctx, _content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration;
      const slug = "404" as FullSlug;

      const url = new URL(`https://${cfg.baseUrl ?? ""}`);
      const path = url.pathname as FullSlug;
      const externalResources = pageResources(path, resources);
      const notFound =
        "That page doesn't exist. But don't leave! There are other fish in the pond.";
      const [tree, vfile] = defaultProcessedContent({
        slug,
        text: notFound,
        description: notFound,
        frontmatter: { title: "Page not found", tags: [], hide_metadata: true },
      });
      const componentData: QuartzComponentProps = {
        ctx,
        fileData: vfile.data,
        externalResources,
        cfg,
        children: [],
        tree,
        allFiles: [],
      };

      return [
        await write({
          ctx,
          content: renderPage(
            cfg,
            slug,
            componentData,
            opts,
            externalResources,
          ),
          slug,
          ext: ".html",
        }),
      ];
    },
  };
};
