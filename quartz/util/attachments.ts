import { Element, Root as HtmlRoot } from "hast"
import { VFile } from "vfile"
import { visit } from "unist-util-visit"
import isAbsoluteUrl from "is-absolute-url"
import { FilePath, slugifyFilePath } from "./path"

/**
 * Check if a path is an absolute filesystem path (Unix or Windows)
 */
export function isAbsolutePath(path: string): boolean {
  // Unix absolute path
  if (path.startsWith("/")) return true
  // Windows absolute path (C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\/]/.test(path)) return true
  return false
}

/**
 * Validate if a reference should be considered an attachment
 */
function isValidAttachmentReference(src: string): boolean {
  if (!src || typeof src !== "string") return false
  if (isAbsoluteUrl(src)) return false
  if (isAbsolutePath(src)) {
    console.warn(`[AttachmentWhitelist] Skipping absolute path: ${src}`)
    return false
  }
  if (src.endsWith(".md") || src.endsWith(".html")) return false
  if (src.startsWith("#")) return false
  return true
}

/**
 * Extract attachment references from HTML AST
 * @param tree - HTML AST to scan
 * @param vfile - Virtual file with metadata
 * @param opts - Options for verbosity
 * @returns Set of normalized attachment paths
 */
export function extractAttachments(
  tree: HtmlRoot,
  vfile: VFile,
  opts?: { verbose?: boolean },
): Set<FilePath> {
  const attachments = new Set<FilePath>()

  visit(tree, "element", (node: Element) => {
    // Extract src or href attribute
    const src = (node.properties?.src || node.properties?.href) as string | undefined
    if (!src) return

    // Validate reference
    if (!isValidAttachmentReference(src)) return

    // Normalize path
    try {
      const decoded = decodeURIComponent(src)
      const normalized = slugifyFilePath(decoded as FilePath) as unknown as FilePath
      attachments.add(normalized)

      if (opts?.verbose) {
        console.log(`[AttachmentWhitelist] ${String(vfile.data.slug)}: ${src} -> ${normalized}`)
      }
    } catch (err) {
      console.warn(`[AttachmentWhitelist] Failed to normalize path: ${src}`, err)
    }
  })

  return attachments
}

/**
 * Result of checking whether to copy an attachment
 */
export type FileFilterResult =
  | { action: "copy"; reason: "whitelisted" }
  | { action: "copy"; reason: "no-whitelist" }
  | { action: "skip"; reason: "orphaned" }
  | { action: "skip"; reason: "markdown-file" }

/**
 * Determine if an attachment should be copied based on whitelist
 */
export function shouldCopyAttachment(
  filePath: FilePath | string,
  whitelist: { paths: Set<FilePath> } | undefined,
): FileFilterResult {
  const path = String(filePath)

  // Skip markdown files (handled by ContentPage emitter)
  if (path.endsWith(".md") || path.endsWith(".html")) {
    return { action: "skip", reason: "markdown-file" }
  }

  // If no whitelist, copy everything (backward compatibility)
  if (!whitelist) {
    return { action: "copy", reason: "no-whitelist" }
  }

  // Check whitelist
  const normalized = slugifyFilePath(path as FilePath) as unknown as FilePath
  if (whitelist.paths.has(normalized)) {
    return { action: "copy", reason: "whitelisted" }
  }

  return { action: "skip", reason: "orphaned" }
}
