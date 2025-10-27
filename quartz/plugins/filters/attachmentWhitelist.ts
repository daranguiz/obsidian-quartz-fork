import { QuartzFilterPlugin } from "../types"
import { extractAttachments } from "../../util/attachments"

export interface Options {
  /** Enable detailed logging of attachment scanning */
  verbose?: boolean

  /** Enable reference tracking (stores which pages reference each attachment) */
  trackReferences?: boolean
}

/**
 * AttachmentWhitelist filter plugin builds a whitelist of attachments referenced
 * by published pages. This whitelist is used by the Assets emitter to filter out
 * orphaned attachments that aren't referenced by any published page.
 *
 * This plugin MUST run AFTER PublishMode to only scan published pages.
 */
export const AttachmentWhitelist: QuartzFilterPlugin<Partial<Options>> = (userOpts) => {
  const opts: Options = {
    verbose: false,
    trackReferences: false,
    ...userOpts,
  }

  return {
    name: "AttachmentWhitelist",
    shouldPublish(ctx, [tree, vfile]) {
      // Initialize whitelist on first invocation
      if (!ctx.state) {
        ctx.state = {}
      }
      if (!ctx.state.attachmentWhitelist) {
        ctx.state.attachmentWhitelist = {
          paths: new Set(),
          stats: { totalReferences: 0, uniqueAttachments: 0, pagesScanned: 0 },
          references: opts.trackReferences ? new Map() : undefined,
        }
      }

      const whitelist = ctx.state.attachmentWhitelist

      // Extract attachments from this page
      const attachments = extractAttachments(tree, vfile, { verbose: opts.verbose })

      // Track size before adding (for logging new attachments)
      const beforeSize = whitelist.paths.size

      // Add to whitelist
      attachments.forEach((path) => {
        whitelist.paths.add(path)

        // Track which pages reference this attachment (for debugging)
        if (opts.trackReferences && whitelist.references && vfile.data.slug) {
          if (!whitelist.references.has(path)) {
            whitelist.references.set(path, new Set())
          }
          whitelist.references.get(path)!.add(vfile.data.slug as any)
        }
      })

      // Update statistics
      whitelist.stats.totalReferences += attachments.size
      whitelist.stats.uniqueAttachments = whitelist.paths.size
      whitelist.stats.pagesScanned++

      // Log progress
      if (opts.verbose) {
        const newAttachments = whitelist.paths.size - beforeSize
        console.log(
          `[AttachmentWhitelist] ${String(vfile.data.slug)}: found ${attachments.size} refs (${newAttachments} new)`,
        )
      }

      // Always return true - we don't filter content, just build whitelist
      return true
    },
  }
}
