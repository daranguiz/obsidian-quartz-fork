import { QuartzFilterPlugin } from "../types"

export interface Options {
  /**
   * The publish mode to filter by. If not set, all non-draft content will be published.
   * - "full": Publish all content (backward compatible with no mode set)
   * - "trusted": Only publish content with `publish-trusted: true` in frontmatter
   * - "public": Only publish content with `publish-public: true` in frontmatter
   */
  mode?: "full" | "trusted" | "public"
}

/**
 * PublishMode filter plugin that allows selective publishing based on frontmatter fields.
 * This enables building different versions of your site with different content subsets.
 */
export const PublishMode: QuartzFilterPlugin<Options> = (userOpts) => {
  const opts: Options = { ...userOpts }

  return {
    name: "PublishMode",
    shouldPublish(_ctx, [_tree, vfile]) {
      // If no mode is specified or mode is "full", publish all content (backward compatible)
      if (!opts.mode || opts.mode === "full") {
        return true
      }

      const frontmatter = vfile.data?.frontmatter

      // Check for the appropriate publish flag based on mode
      // Hierarchical: publish-public implies publish-trusted
      if (opts.mode === "trusted") {
        // Trusted tier includes both publish-trusted and publish-public content
        return (frontmatter?.["publish-trusted"] === true ||
                frontmatter?.["publish-trusted"] === "true" ||
                frontmatter?.["publish-public"] === true ||
                frontmatter?.["publish-public"] === "true")
      } else if (opts.mode === "public") {
        // Public tier only includes publish-public content
        return frontmatter?.["publish-public"] === true ||
               frontmatter?.["publish-public"] === "true"
      }

      return false
    },
  }
}
