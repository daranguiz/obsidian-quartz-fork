import { QuartzFilterPlugin } from "../types"

export interface Options {
  /**
   * The publish mode to filter by. If not set, all non-draft content will be published.
   * - "full": Publish all content (backward compatible with no mode set)
   * - "trusted": Only publish content with `publish-trusted: true` in frontmatter
   * - "shachu": Only publish content with `publish-shachu: true` in frontmatter
   * - "public": Only publish content with `publish-public: true` in frontmatter
   */
  mode?: "full" | "trusted" | "shachu" | "public"
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
      // If no mode is specified or mode is "full", publish all content
      if (!opts.mode || opts.mode === "full") {
        return true
      }

      const frontmatter = vfile.data?.frontmatter
      const publishValue = frontmatter?.publish

      // Helper to normalize the publish field value
      // Handles: "[[Public]]", "Public", "public", etc.
      // Empty or whitespace-only values count as null
      const normalizePublishValue = (value: unknown): string | null => {
        if (!value) return null
        const str = String(value).trim()
        if (str === "") return null  // Empty string counts as no publish field (Full)
        const normalized = str.toLowerCase()
        // Extract text from wikilinks: "[[Public]]" -> "public"
        const match = normalized.match(/\[\[([^\]]+)\]\]/)
        return match ? match[1].toLowerCase() : normalized
      }

      const normalized = normalizePublishValue(publishValue)

      // No publish field or empty field = Full tier only
      if (!normalized) {
        return false  // Only shows in full mode
      }

      // Check for the appropriate publish flag based on mode
      // Hierarchical: Public > Shachu > Trusted > Full
      if (opts.mode === "trusted") {
        // Trusted tier includes: trusted, shachu, and public
        return normalized === "trusted" || normalized === "shachu" || normalized === "public"
      } else if (opts.mode === "shachu") {
        // Shachu tier includes: shachu and public
        return normalized === "shachu" || normalized === "public"
      } else if (opts.mode === "public") {
        // Public tier only includes: public
        return normalized === "public"
      }

      return false
    },
  }
}
