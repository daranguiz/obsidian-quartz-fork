import { createReadStream } from "fs"
import { createHash } from "crypto"
import { pipeline } from "stream/promises"

/**
 * Computes SHA-256 hash of a file using streaming to avoid loading large files into memory.
 *
 * @param filepath - Absolute path to the file to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash (64 characters)
 * @throws Error if file cannot be read or hashed
 *
 * @example
 * ```typescript
 * const hash = await computeFileHash('/path/to/large-file.pdf');
 * console.log(hash); // "a3f5b8c2d1e4f7a9b6c3d0e1f2a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
 * ```
 */
export async function computeFileHash(filepath: string): Promise<string> {
  const input = createReadStream(filepath)
  const hash = createHash("sha256")

  try {
    await pipeline(input, hash)
    return hash.digest("hex")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to compute hash for file ${filepath}: ${errorMessage}`)
  }
}
