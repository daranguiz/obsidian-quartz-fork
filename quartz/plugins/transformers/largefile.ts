import { QuartzTransformerPlugin } from "../types"
import { Root } from "mdast"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"
import { stat } from "fs/promises"
import { resolve, join, dirname } from "path"
import {
  LargeFile,
  FileReference,
  LinkType,
  UploadStatus,
  resolveAccessLevel,
  generateR2Key,
  BUCKET_FOR_ACCESS_LEVEL,
  DOMAIN_FOR_ACCESS_LEVEL,
} from "../../util/cdn"
import { computeFileHash } from "../../util/hash"

const SIZE_THRESHOLD = 20 * 1024 * 1024 // 20MB in bytes

/**
 * Transformer plugin that detects large files (>20MB) referenced in markdown,
 * prepares them for CDN upload, and rewrites links to CDN URLs.
 */
export const LargeFileDetector: QuartzTransformerPlugin = () => {
  return {
    name: "LargeFileDetector",
    markdownPlugins() {
      return [
        () => {
          return async (tree: Root, file: VFile) => {
            const fileReferences: FileReference[] = []
            const contentRoot = process.cwd()
            const sourceNotePath = file.path || ""
            const sourceNoteSlug = (file.data as any).slug || ""
            const publishMode = (file.data as any).frontmatter?.publish

            // Scan markdown AST for file links
            visit(tree, (node: any) => {
              // Handle markdown links: ![alt](path) or [text](path)
              if (node.type === "link" || node.type === "image") {
                const url = node.url as string
                if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
                  fileReferences.push({
                    sourceNotePath,
                    sourceNoteSlug,
                    publishMode,
                    targetPath: url,
                    resolvedPath: "", // Will be resolved below
                    linkType: LinkType.MarkdownLink,
                    isPublished: true, // Assume published (filter plugins run before this)
                    requiresRewriting: false, // Will be determined below
                  })
                }
              }

              // Handle wikilinks: ![[file]] or [[file]]
              if (node.type === "wikiLink") {
                const target = node.data?.slug || node.value
                if (target) {
                  fileReferences.push({
                    sourceNotePath,
                    sourceNoteSlug,
                    publishMode,
                    targetPath: target,
                    resolvedPath: "",
                    linkType: LinkType.WikiLink,
                    isPublished: true,
                    requiresRewriting: false,
                  })
                }
              }
            })

            // Resolve paths and check file sizes
            for (const ref of fileReferences) {
              try {
                // Resolve relative to source note location
                const notePath = resolve(contentRoot, sourceNotePath)
                const noteDir = dirname(notePath)
                const resolvedPath = resolve(noteDir, ref.targetPath)

                ref.resolvedPath = resolvedPath

                // Check if file exists and get size
                const stats = await stat(resolvedPath)

                if (stats.isFile() && stats.size > SIZE_THRESHOLD) {
                  ref.requiresRewriting = true
                }
              } catch (error) {
                // File doesn't exist or can't be accessed, skip
                continue
              }
            }

            // Group references by resolved path to create LargeFile entities
            const largeFileMap = new Map<string, LargeFile>()

            for (const ref of fileReferences) {
              if (!ref.requiresRewriting || !ref.resolvedPath) continue

              let largeFile = largeFileMap.get(ref.resolvedPath)

              if (!largeFile) {
                try {
                  // Create new LargeFile entity
                  const stats = await stat(ref.resolvedPath)
                  const hash = await computeFileHash(ref.resolvedPath)
                  const filename = ref.resolvedPath.split("/").pop() || "unknown"
                  const relativePath = ref.resolvedPath.replace(
                    join(contentRoot, "content") + "/",
                    "",
                  )

                  // Determine access level from initial reference
                  const accessLevel = resolveAccessLevel([ref.publishMode])
                  const r2Key = generateR2Key(relativePath, hash)

                  largeFile = {
                    localPath: ref.resolvedPath,
                    filename,
                    relativePath,
                    sizeBytes: stats.size,
                    contentType: getContentType(filename),
                    hash,
                    targetBucket: BUCKET_FOR_ACCESS_LEVEL[accessLevel],
                    cdnDomain: DOMAIN_FOR_ACCESS_LEVEL[accessLevel],
                    r2Key,
                    cdnUrl: `https://${DOMAIN_FOR_ACCESS_LEVEL[accessLevel]}/${r2Key}`,
                    accessLevel,
                    referencingNotes: [sourceNoteSlug],
                    uploadStatus: UploadStatus.Pending,
                    uploadAttempts: 0,
                  }

                  largeFileMap.set(ref.resolvedPath, largeFile)
                } catch (error) {
                  console.error(`Error processing large file ${ref.resolvedPath}:`, error)
                  continue
                }
              } else {
                // Update existing LargeFile with additional reference
                if (!largeFile.referencingNotes.includes(sourceNoteSlug)) {
                  largeFile.referencingNotes.push(sourceNoteSlug)

                  // Recalculate access level (least restrictive)
                  const allPublishModes = fileReferences
                    .filter((r) => r.resolvedPath === ref.resolvedPath)
                    .map((r) => r.publishMode)

                  const newAccessLevel = resolveAccessLevel(allPublishModes)
                  if (newAccessLevel !== largeFile.accessLevel) {
                    largeFile.accessLevel = newAccessLevel
                    largeFile.targetBucket = BUCKET_FOR_ACCESS_LEVEL[newAccessLevel]
                    largeFile.cdnDomain = DOMAIN_FOR_ACCESS_LEVEL[newAccessLevel]
                    largeFile.cdnUrl = `https://${DOMAIN_FOR_ACCESS_LEVEL[newAccessLevel]}/${largeFile.r2Key}`
                  }
                }
              }
            }

            // Store large files in VFile data for emitter plugin
            if (largeFileMap.size > 0) {
              ;(file.data as any).largeFiles = Array.from(largeFileMap.values())
            }

            // Rewrite links in the AST (will be done in a second pass after upload)
            // For now, we just mark them for rewriting
            ;(file.data as any).fileReferences = fileReferences
          }
        },
      ]
    },
  }
}

/**
 * Determines MIME type from filename extension.
 */
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
  }

  return contentTypes[ext || ""] || "application/octet-stream"
}
