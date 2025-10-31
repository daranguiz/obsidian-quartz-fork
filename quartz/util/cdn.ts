import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { createReadStream } from "fs"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"

/**
 * Access levels for CDN files, corresponding to the four-tier publishing system.
 * Hierarchy: Public (least restrictive) > Shachu > Trusted > Full (most restrictive)
 */
export enum AccessLevel {
  Full = "full",
  Trusted = "trusted",
  Shachu = "shachu",
  Public = "public",
}

/**
 * Upload status for tracking file processing during build.
 */
export enum UploadStatus {
  Pending = "pending",
  Uploading = "uploading",
  Completed = "completed",
  Failed = "failed",
  Skipped = "skipped",
}

/**
 * Link type for distinguishing between different markdown link formats.
 */
export enum LinkType {
  MarkdownLink = "markdown",
  WikiLink = "wikilink",
  HtmlEmbed = "html",
}

/**
 * Represents a large file that needs to be uploaded to CDN.
 */
export interface LargeFile {
  // Identity
  localPath: string
  filename: string
  relativePath: string

  // Content
  sizeBytes: number
  contentType: string
  hash: string

  // CDN Mapping
  targetBucket: string
  cdnDomain: string
  r2Key: string
  cdnUrl: string

  // Access Control
  accessLevel: AccessLevel
  referencingNotes: string[]

  // State
  uploadStatus: UploadStatus
  uploadAttempts: number
  lastError?: string
}

/**
 * Represents a reference to a file from a note.
 */
export interface FileReference {
  // Source
  sourceNotePath: string
  sourceNoteSlug: string
  publishMode?: string

  // Target
  targetPath: string
  resolvedPath: string
  linkType: LinkType

  // Link Context
  lineNumber?: number
  linkText?: string

  // Processing State
  isPublished: boolean
  requiresRewriting: boolean
}

/**
 * CDN mapping entry for deduplication and orphan detection.
 */
export interface CDNMapping {
  hash: string
  localPath: string
  r2Bucket: string
  r2Key: string
  cdnUrl: string
  uploadTimestamp: string
  fileSize: number
  contentType: string
  accessLevel: AccessLevel
  referencedBy: string[]
}

/**
 * CDN mapping cache file structure.
 */
export interface CDNMappingCache {
  version: string
  lastUpdated: string
  mappings: CDNMapping[]
}

/**
 * Bucket names for each access level.
 */
export const BUCKET_FOR_ACCESS_LEVEL: Record<AccessLevel, string> = {
  [AccessLevel.Full]: process.env.R2_BUCKET_FULL || "vault-files-full",
  [AccessLevel.Trusted]: process.env.R2_BUCKET_TRUSTED || "vault-files-trusted",
  [AccessLevel.Shachu]: process.env.R2_BUCKET_SHACHU || "vault-files-shachu",
  [AccessLevel.Public]: process.env.R2_BUCKET_PUBLIC || "vault-files-public",
}

/**
 * CDN domains for each access level.
 */
export const DOMAIN_FOR_ACCESS_LEVEL: Record<AccessLevel, string> = {
  [AccessLevel.Full]: process.env.CDN_DOMAIN_FULL || "cdn-full.dario.ca",
  [AccessLevel.Trusted]: process.env.CDN_DOMAIN_TRUSTED || "cdn-trusted.dario.ca",
  [AccessLevel.Shachu]: process.env.CDN_DOMAIN_SHACHU || "cdn-shachu.dario.ca",
  [AccessLevel.Public]: process.env.CDN_DOMAIN_PUBLIC || "cdn-public.dario.ca",
}

/**
 * Path to CDN mapping cache file.
 */
const CDN_CACHE_PATH = join(process.cwd(), ".quartz-cache", "cdn-mappings.json")

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * R2 client wrapper for CDN operations.
 */
export class R2Client {
  private s3: S3Client

  constructor() {
    const endpoint = process.env.R2_ENDPOINT
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 credentials not configured. Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.",
      )
    }

    this.s3 = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  /**
   * Uploads a file to R2 with exponential backoff retry.
   *
   * @param bucket - Target bucket name
   * @param key - Object key in R2
   * @param filepath - Local file path
   * @param contentType - MIME type
   * @param maxRetries - Maximum retry attempts (default: 3)
   * @returns Promise that resolves when upload succeeds
   * @throws Error if upload fails after all retries
   */
  async uploadFile(
    bucket: string,
    key: string,
    filepath: string,
    contentType: string,
    maxRetries: number = 3,
  ): Promise<void> {
    const delays = [1000, 2000, 4000] // Exponential backoff: 1s, 2s, 4s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const fileStream = createReadStream(filepath)
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileStream,
          ContentType: contentType,
        })

        await this.s3.send(command)
        return // Success
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (attempt === maxRetries - 1) {
          throw new Error(
            `Failed to upload ${filepath} to ${bucket}/${key} after ${maxRetries} attempts: ${errorMessage}`,
          )
        }

        // Wait before retry
        await sleep(delays[attempt])
      }
    }
  }

  /**
   * Deletes a file from R2.
   *
   * @param bucket - Bucket name
   * @param key - Object key to delete
   * @returns Promise that resolves when deletion succeeds
   */
  async deleteFile(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    await this.s3.send(command)
  }

  /**
   * Lists all files in a bucket with optional prefix filter.
   *
   * @param bucket - Bucket name
   * @param prefix - Optional key prefix to filter results
   * @returns Promise resolving to array of object keys
   */
  async listFiles(bucket: string, prefix?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })

    const response = await this.s3.send(command)
    return (response.Contents || []).map((obj) => obj.Key || "").filter(Boolean)
  }
}

/**
 * Generates an R2 object key from a file path and hash.
 * Preserves directory structure and adds hash prefix to prevent collisions.
 *
 * @param relativePath - Path relative to content root (e.g., "docs/research/paper.pdf")
 * @param fileHash - SHA-256 hash of file content
 * @returns R2 object key (e.g., "docs/research/a3f5b8c2-paper.pdf")
 *
 * @example
 * ```typescript
 * const key = generateR2Key("docs/paper.pdf", "a3f5b8c2d1e4f7a9...");
 * // Returns: "docs/a3f5b8c2-paper.pdf"
 * ```
 */
export function generateR2Key(relativePath: string, fileHash: string): string {
  const pathParts = relativePath.split("/")
  const filename = pathParts.pop() || relativePath
  const directory = pathParts.join("/")

  // Include first 8 chars of hash for uniqueness
  const hashPrefix = fileHash.substring(0, 8)

  if (directory) {
    return `${directory}/${hashPrefix}-${filename}`
  }

  return `${hashPrefix}-${filename}`
}

/**
 * Resolves the access level for a file based on the publish modes of referencing notes.
 * Selects the least restrictive level (highest in hierarchy: Public > Shachu > Trusted > Full).
 *
 * @param publishModes - Array of publish mode strings from referencing notes (e.g., ["[[Public]]", "[[Trusted]]"])
 * @returns The least restrictive AccessLevel
 *
 * @example
 * ```typescript
 * const level = resolveAccessLevel(["[[Public]]", "[[Trusted]]"]);
 * // Returns: AccessLevel.Public (least restrictive)
 * ```
 */
export function resolveAccessLevel(publishModes: (string | undefined)[]): AccessLevel {
  const levels: AccessLevel[] = []

  for (const mode of publishModes) {
    if (!mode) {
      levels.push(AccessLevel.Full)
      continue
    }

    // Extract mode from wikilink format: "[[Public]]" -> "Public"
    const match = mode.match(/\[\[(\w+)\]\]/)
    const extracted = match ? match[1].toLowerCase() : mode.toLowerCase()

    switch (extracted) {
      case "public":
        levels.push(AccessLevel.Public)
        break
      case "shachu":
        levels.push(AccessLevel.Shachu)
        break
      case "trusted":
        levels.push(AccessLevel.Trusted)
        break
      default:
        levels.push(AccessLevel.Full)
    }
  }

  // Select least restrictive (Public > Shachu > Trusted > Full)
  if (levels.includes(AccessLevel.Public)) return AccessLevel.Public
  if (levels.includes(AccessLevel.Shachu)) return AccessLevel.Shachu
  if (levels.includes(AccessLevel.Trusted)) return AccessLevel.Trusted
  return AccessLevel.Full
}

/**
 * Loads the CDN mapping cache from disk.
 *
 * @returns Promise resolving to CDN mapping cache, or empty cache if file doesn't exist
 */
export async function loadCDNMappingCache(): Promise<CDNMappingCache> {
  try {
    const data = await readFile(CDN_CACHE_PATH, "utf-8")
    return JSON.parse(data) as CDNMappingCache
  } catch (error) {
    // File doesn't exist or is invalid, return empty cache
    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      mappings: [],
    }
  }
}

/**
 * Saves the CDN mapping cache to disk.
 *
 * @param cache - CDN mapping cache to save
 * @returns Promise that resolves when save completes
 */
export async function saveCDNMappingCache(cache: CDNMappingCache): Promise<void> {
  cache.lastUpdated = new Date().toISOString()
  const data = JSON.stringify(cache, null, 2)
  await writeFile(CDN_CACHE_PATH, data, "utf-8")
}
