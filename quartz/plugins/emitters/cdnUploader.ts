import { QuartzEmitterPlugin } from "../types"
import {
  R2Client,
  LargeFile,
  UploadStatus,
  CDNMapping,
  CDNMappingCache,
  loadCDNMappingCache,
  saveCDNMappingCache,
} from "../../util/cdn"

/**
 * Emitter plugin that uploads large files to R2 CDN and manages orphan cleanup.
 */
export const CDNUploader: QuartzEmitterPlugin = () => {
  return {
    name: "CDNUploader",
    async emit(ctx, content, _resources) {
      const { argv } = ctx
      const verbose = argv.verbose

      // Check if R2 is configured
      if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        if (verbose) {
          console.log("⚠️  R2 not configured, skipping CDN upload")
        }
        return []
      }

      try {
        const r2Client = new R2Client()

        // Collect all large files from processed content
        const allLargeFiles: LargeFile[] = []
        const largeFilesByHash = new Map<string, LargeFile>()

        for (const [_tree, file] of content) {
          const largeFiles = (file.data as any).largeFiles as LargeFile[] | undefined
          if (largeFiles) {
            for (const lf of largeFiles) {
              // Deduplicate by hash (same file referenced in multiple notes)
              if (!largeFilesByHash.has(lf.hash)) {
                largeFilesByHash.set(lf.hash, lf)
                allLargeFiles.push(lf)
              } else {
                // Merge referencing notes
                const existing = largeFilesByHash.get(lf.hash)!
                for (const note of lf.referencingNotes) {
                  if (!existing.referencingNotes.includes(note)) {
                    existing.referencingNotes.push(note)
                  }
                }
              }
            }
          }
        }

        if (allLargeFiles.length === 0) {
          if (verbose) {
            console.log("✓ No large files detected")
          }
          return []
        }

        if (verbose) {
          console.log(`📦 Detected ${allLargeFiles.length} large files`)
        }

        // Load CDN mapping cache
        const cache = await loadCDNMappingCache()
        const cacheMap = new Map<string, CDNMapping>(cache.mappings.map((m) => [m.hash, m]))

        // Check which files are already uploaded (skip if hash matches)
        for (const lf of allLargeFiles) {
          const cached = cacheMap.get(lf.hash)
          if (cached) {
            lf.uploadStatus = UploadStatus.Skipped
            if (verbose) {
              console.log(`  ⏭️  Skipped: ${lf.filename} (already uploaded)`)
            }
          }
        }

        // Upload pending files
        const pendingFiles = allLargeFiles.filter((lf) => lf.uploadStatus === UploadStatus.Pending)

        if (pendingFiles.length > 0) {
          if (verbose) {
            console.log(`⬆️  Uploading ${pendingFiles.length} files to CDN...`)
          }

          // Determine parallel vs sequential upload
          const maxConcurrency = pendingFiles.length > 50 ? 10 : 1

          if (maxConcurrency > 1) {
            // Parallel uploads in batches
            for (let i = 0; i < pendingFiles.length; i += maxConcurrency) {
              const batch = pendingFiles.slice(i, i + maxConcurrency)
              await Promise.all(
                batch.map(async (lf) => {
                  try {
                    lf.uploadStatus = UploadStatus.Uploading
                    await r2Client.uploadFile(
                      lf.targetBucket,
                      lf.r2Key,
                      lf.localPath,
                      lf.contentType,
                    )
                    lf.uploadStatus = UploadStatus.Completed
                    lf.uploadAttempts = 1

                    if (verbose) {
                      console.log(`    ✓ ${lf.filename} → ${lf.cdnUrl}`)
                    }
                  } catch (error) {
                    lf.uploadStatus = UploadStatus.Failed
                    lf.lastError = error instanceof Error ? error.message : String(error)
                    console.error(`    ✗ Failed to upload ${lf.filename}: ${lf.lastError}`)
                    throw error // Build should fail
                  }
                }),
              )
            }
          } else {
            // Sequential uploads
            for (const lf of pendingFiles) {
              try {
                lf.uploadStatus = UploadStatus.Uploading
                await r2Client.uploadFile(lf.targetBucket, lf.r2Key, lf.localPath, lf.contentType)
                lf.uploadStatus = UploadStatus.Completed
                lf.uploadAttempts = 1

                if (verbose) {
                  console.log(`  ✓ ${lf.filename} → ${lf.cdnUrl}`)
                }
              } catch (error) {
                lf.uploadStatus = UploadStatus.Failed
                lf.lastError = error instanceof Error ? error.message : String(error)
                console.error(`  ✗ Failed to upload ${lf.filename}: ${lf.lastError}`)
                throw error // Build should fail
              }
            }
          }
        }

        // Update CDN mapping cache
        const updatedMappings = new Map<string, CDNMapping>(cache.mappings.map((m) => [m.hash, m]))

        for (const lf of allLargeFiles) {
          if (lf.uploadStatus === UploadStatus.Completed || lf.uploadStatus === UploadStatus.Skipped) {
            updatedMappings.set(lf.hash, {
              hash: lf.hash,
              localPath: lf.relativePath,
              r2Bucket: lf.targetBucket,
              r2Key: lf.r2Key,
              cdnUrl: lf.cdnUrl,
              uploadTimestamp: new Date().toISOString(),
              fileSize: lf.sizeBytes,
              contentType: lf.contentType,
              accessLevel: lf.accessLevel,
              referencedBy: lf.referencingNotes,
            })
          }
        }

        // Detect and remove orphaned files
        const currentHashes = new Set(allLargeFiles.map((lf) => lf.hash))
        const orphanedMappings: CDNMapping[] = []

        for (const mapping of updatedMappings.values()) {
          if (!currentHashes.has(mapping.hash)) {
            orphanedMappings.push(mapping)
          }
        }

        if (orphanedMappings.length > 0) {
          if (verbose) {
            console.log(`🗑️  Removing ${orphanedMappings.length} orphaned files from CDN...`)
          }

          for (const mapping of orphanedMappings) {
            try {
              await r2Client.deleteFile(mapping.r2Bucket, mapping.r2Key)
              updatedMappings.delete(mapping.hash)

              if (verbose) {
                console.log(`  ✓ Deleted: ${mapping.r2Key}`)
              }
            } catch (error) {
              console.error(`  ✗ Failed to delete ${mapping.r2Key}:`, error)
              // Don't fail build on orphan cleanup errors
            }
          }
        }

        // Save updated cache
        const updatedCache: CDNMappingCache = {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
          mappings: Array.from(updatedMappings.values()),
        }

        await saveCDNMappingCache(updatedCache)

        if (verbose) {
          console.log(`✓ CDN upload complete (${allLargeFiles.length} files, ${orphanedMappings.length} orphans removed)`)
        }

        return []
      } catch (error) {
        console.error("❌ CDN upload failed:", error)
        throw error // Fail the build
      }
    },
  }
}
