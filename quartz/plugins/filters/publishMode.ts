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
      // Handles: "[[Level 3 - Public]]", "Level 3 - Public", "public", etc.
      // Empty or whitespace-only values count as null
      const normalizePublishValue = (value: unknown): string | null => {
        if (!value) return null
        const str = String(value).trim()
        if (str === "") return null  // Empty string counts as no publish field (Level 0 - Full)
        const normalized = str.toLowerCase()
        // Extract text from wikilinks: "[[Level 3 - Public]]" -> "level 3 - public"
        const match = normalized.match(/\[\[([^\]]+)\]\]/)
        const extracted = match ? match[1].toLowerCase() : normalized

        // Map level names to simple mode names for comparison
        // "level 0 - full" -> "full", "level 1 - trusted" -> "trusted", etc.
        const levelMatch = extracted.match(/level \d+ - (\w+)/)
        return levelMatch ? levelMatch[1] : extracted
      }

      const normalized = normalizePublishValue(publishValue)

      // No publish field or empty field = Level 0 - Full tier only
      if (!normalized) {
        return false  // Only shows in full mode
      }

      // Check for the appropriate publish flag based on mode
      // Hierarchical: Level 3 - Public > Level 2 - Shachu > Level 1 - Trusted > Level 0 - Full
      if (opts.mode === "trusted") {
        // Level 1 - Trusted tier includes: trusted, shachu, and public
        return normalized === "trusted" || normalized === "shachu" || normalized === "public"
      } else if (opts.mode === "shachu") {
        // Level 2 - Shachu tier includes: shachu and public
        return normalized === "shachu" || normalized === "public"
      } else if (opts.mode === "public") {
        // Level 3 - Public tier only includes: public
        return normalized === "public"
      }

      return false
    },
  }
}
