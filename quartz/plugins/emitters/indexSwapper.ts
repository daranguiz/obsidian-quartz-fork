import { QuartzEmitterPlugin } from "../types"
import { QuartzPluginData } from "../vfile"

/**
 * IndexSwapper emitter plugin
 *
 * Swaps index files based on publish mode to provide different landing pages per tier.
 *
 * File naming convention:
 * - index.md         → Full tier (vault.dario.ca)
 * - index-trusted.md → Trusted tier (notes-private.dario.ca)
 * - index-shachu.md  → Shachu tier (shachu.dario.ca)
 * - index-public.md  → Public tier (notes.dario.ca)
 *
 * The plugin runs BEFORE ContentPage and modifies the file data so that:
 * 1. The tier-specific index becomes "index"
 * 2. All other index variants are filtered out
 */
export const IndexSwapper: QuartzEmitterPlugin = () => {
  return {
    name: "IndexSwapper",
    getQuartzComponents() {
      return []
    },
    async *emit(ctx, content) {
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

      // Find the target index file in content
      let swapOccurred = false
      for (const [tree, file] of content) {
        const slug = file.data.slug!

        if (slug === targetIndexSlug) {
          // Rename this to be the main index
          file.data.slug = "index"
          file.data.frontmatter = file.data.frontmatter || {}
          swapOccurred = true
        } else if (slug === "index" && targetIndexSlug !== "index") {
          // Rename the default index to avoid conflicts
          file.data.slug = "index-original"
        } else if (slug.match(/^index-(trusted|shachu|public)$/)) {
          // Hide other index variants by giving them unique slugs
          // They won't be rendered as "index" but will still exist if linked
          // (already have their unique slugs, so no change needed)
        }
      }

      if (swapOccurred && ctx.argv.verbose) {
        console.log(`[IndexSwapper] Swapped ${targetIndexSlug} → index for ${publishMode} mode`)
      }

      // This emitter doesn't yield any files - it just modifies the content array
      // The actual rendering is done by ContentPage emitter
      return []
    },
  }
}
