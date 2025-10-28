import { QuartzFilterPlugin } from "../types"

/**
 * IndexSwapper filter plugin
 *
 * Filters out unused index files based on publish mode and renames the appropriate one.
 *
 * File naming convention:
 * - index.md         → Level 0 - Full tier (vault.dario.ca)
 * - index-trusted.md → Level 1 - Trusted tier (notes-private.dario.ca)
 * - index-shachu.md  → Level 2 - Shachu tier (shachu.dario.ca)
 * - index-public.md  → Level 3 - Public tier (notes.dario.ca)
 *
 * The plugin:
 * 1. Renames the tier-specific index to "index"
 * 2. Filters out all other index variants completely
 */
export const IndexSwapper: QuartzFilterPlugin = () => {
  // Get the publish mode from environment variable
  const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

  // Determine which index file should be the main index based on mode
  const indexMap: Record<string, string> = {
    full: "index",
    trusted: "index-trusted",
    shachu: "index-shachu",
    public: "index-public",
  }

  const targetIndexSlug = indexMap[publishMode] || "index"

  return {
    name: "IndexSwapper",
    shouldPublish(ctx, [tree, vfile]) {
      const slug = vfile.data.slug!

      // Check if this is any index file
      const isIndexFile = slug === "index" || slug.match(/^index-(trusted|shachu|public)$/)

      // If this is the target index for this publish mode
      if (slug === targetIndexSlug) {
        // Rename it to "index" so it becomes the landing page
        vfile.data.slug = "index"

        // Set the publish field to match the current mode so it passes PublishMode filtering
        // Index files should always be published in their respective tier
        if (vfile.data.frontmatter) {
          // Map publish modes to their frontmatter values
          const publishModeMap: Record<string, string> = {
            full: "",  // Empty for full mode (all content)
            trusted: "[[Level 1 - Trusted]]",
            shachu: "[[Level 2 - Shachu]]",
            public: "[[Level 3 - Public]]",
          }

          // Set the publish field to the appropriate value for this mode
          // For "full" mode, we remove the publish field entirely
          if (publishMode === "full") {
            delete vfile.data.frontmatter.publish
          } else {
            vfile.data.frontmatter.publish = publishModeMap[publishMode] || ""
          }
        }

        return true
      }

      // Filter out all other index variants (don't publish them)
      if (isIndexFile) {
        return false
      }

      // Publish everything else normally
      return true
    },
  }
}
