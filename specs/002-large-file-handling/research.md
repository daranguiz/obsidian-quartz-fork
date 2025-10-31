# Research: Large File Handling via CDN

**Feature**: 002-large-file-handling
**Date**: 2025-10-29
**Phase**: 0 - Technical Research

## Executive Summary

Research confirms that Cloudflare R2 + Zero Trust integration is **viable and recommended** for this feature. The architecture uses R2 with custom domains protected by Cloudflare Access policies to enforce tier-based authentication. File hashing with SHA-256 streaming and AWS S3 SDK provide the technical foundation for upload management.

## Critical Decision 1: CDN Access Control Architecture

### Research Question
How can we enforce Cloudflare Zero Trust authentication on R2 (CDN) files to prevent unauthorized access via direct URLs?

### Finding
**Cloudflare R2 + Custom Domain + Zero Trust Access** is the recommended architecture.

### Decision
Use **R2 buckets behind custom domains with Cloudflare Access policies** for each tier.

### Rationale
1. **Direct R2 + Zero Trust Integration**: Cloudflare Access can protect R2 buckets when served through custom domains
2. **Per-Tier Buckets**: Create separate R2 buckets (or custom domains) for each access level:
   - `cdn-full.dario.ca` → Full tier bucket (most restrictive Access policy)
   - `cdn-trusted.dario.ca` → Trusted tier bucket
   - `cdn-shachu.dario.ca` → Shachu tier bucket
   - `cdn-public.dario.ca` → Public tier bucket (no Access policy)
3. **Access Policy Enforcement**: Configure Access applications for each custom domain with appropriate Google Auth rules
4. **No Worker Required**: Unlike some approaches, custom domains with Access don't require a Worker proxy layer

### Architecture
```
User Request → Custom Domain (cdn-trusted.dario.ca)
    ↓
Cloudflare Access (checks Google Auth)
    ↓ (if authorized)
R2 Bucket (trusted-files)
    ↓
File Delivered
```

### Configuration Steps
1. Create 4 R2 buckets (or use prefixes in single bucket):
   - `vault-files-full`
   - `vault-files-trusted`
   - `vault-files-shachu`
   - `vault-files-public`

2. Connect custom domains to each bucket (R2 dashboard):
   - Full: `cdn-full.dario.ca` → `vault-files-full`
   - Trusted: `cdn-trusted.dario.ca` → `vault-files-trusted`
   - Shachu: `cdn-shachu.dario.ca` → `vault-files-shachu`
   - Public: `cdn-public.dario.ca` → `vault-files-public`

3. Create Cloudflare Access applications for restricted tiers:
   - Application: "CDN Full Access" → `cdn-full.dario.ca`
     - Policy: Allow specific Google account(s) (vault owner only)
   - Application: "CDN Trusted Access" → `cdn-trusted.dario.ca`
     - Policy: Allow specific Google accounts (trusted users)
   - Application: "CDN Shachu Access" → `cdn-shachu.dario.ca`
     - Policy: Allow specific Google accounts (shachu members)
   - No Access policy for `cdn-public.dario.ca` (remains public)

4. Build process determines which bucket to upload to based on file's access level

### Pros
- ✅ Native Cloudflare integration (no custom code for auth)
- ✅ Zero Trust policies apply automatically to all file requests
- ✅ Session expiration enforced by Cloudflare
- ✅ Policy changes take effect immediately
- ✅ No Worker overhead on file delivery
- ✅ Leverages existing Zero Trust infrastructure

### Cons
- ❌ Requires 4 custom domains (or subdomains)
- ❌ Build process must determine correct bucket per file
- ❌ Multi-tier files (referenced in both public and trusted notes) require duplication or most-permissive-tier logic

### Alternatives Considered

**Alternative 1: Single Bucket + Cloudflare Worker Proxy**
- Worker authenticates requests by checking JWT tokens from Cloudflare Access
- Worker fetches from R2 and proxies to user
- **Rejected**: Adds latency and complexity; Worker must run on every file request

**Alternative 2: Pre-Signed URLs**
- Generate time-limited signed URLs for each file
- **Rejected**: Cannot integrate with Cloudflare Zero Trust; requires custom auth logic; time limits conflict with "immediate session expiration" requirement

**Alternative 3: Single Bucket + Path-Based Access Policies**
- Use Access policies on different URL paths (e.g., `/trusted/*`, `/public/*`)
- **Rejected**: Cloudflare Access works at hostname level, not path level

### References
- [Protect an R2 Bucket with Cloudflare Access](https://developers.cloudflare.com/r2/tutorials/cloudflare-access/)
- [Public buckets - Cloudflare R2 docs](https://developers.cloudflare.com/r2/buckets/public-buckets/)

---

## Critical Decision 2: File Hashing for Deduplication

### Research Question
Which hash algorithm and implementation pattern should be used for file deduplication and concurrent build safety?

### Finding
**SHA-256 with streaming** is the industry-standard approach for file deduplication.

### Decision
Use **SHA-256 hash computed via streaming** for:
- Preventing duplicate uploads (same file referenced in multiple notes)
- Ensuring idempotent uploads (concurrent builds uploading same file)
- Stable CDN URL generation (hash as part of key)

### Implementation Pattern

```typescript
import { createReadStream } from 'fs'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'

async function computeFileHash(filepath: string): Promise<string> {
  const input = createReadStream(filepath)
  const hash = createHash('sha256')

  try {
    await pipeline(input, hash)
    return hash.digest('hex')
  } catch (error) {
    throw new Error(`Failed to hash file ${filepath}: ${error.message}`)
  }
}
```

### Rationale
1. **SHA-256 vs MD5**: SHA-256 provides better collision resistance than MD5 (critical for content-addressable storage)
2. **Streaming vs Full-File**: Streaming prevents loading entire 20MB+ files into memory
3. **Constant Memory Usage**: Hash computed incrementally as file is read in chunks
4. **Built-in Node.js**: No external dependencies; part of Node.js crypto module
5. **Performance**: SHA-256 is fast enough for build-time hashing (benchmarks show minimal impact)

### URL Structure with Hash
```
cdn-trusted.dario.ca/[path-hash]/[filename]
```
Example:
```
cdn-trusted.dario.ca/a3f5b8c2.../research-paper.pdf
```

Where `a3f5b8c2...` is first 8 chars of SHA-256 hash of file content.

### Concurrent Build Safety
- Two builds uploading the same file compute identical hashes
- S3/R2 PutObject with same key is idempotent (last write wins)
- Since file content is identical, overwriting is safe
- File hash verification prevents false deduplication (different files with same name)

### Performance Considerations
- Hashing 50 files @ 20MB each: ~2-3 seconds total on modern hardware
- Streaming approach: <50MB memory usage regardless of file count
- Negligible impact on build time (<5% increase)

### References
- [Efficient file deduplication with sha-256 and Node.js | Transloadit](https://transloadit.com/devtips/efficient-file-deduplication-with-sha-256-and-node-js/)
- [Node.js crypto module documentation](https://nodejs.org/api/crypto.html)

---

## Critical Decision 3: R2 SDK and Upload Strategy

### Research Question
Which SDK should be used for R2 uploads from Node.js, and how should parallel uploads be implemented?

### Finding
**AWS S3 SDK v3 (@aws-sdk/client-s3)** is the standard approach for R2 integration.

### Decision
Use **@aws-sdk/client-s3 with S3Client** configured for R2 endpoints.

### Implementation

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createReadStream } from 'fs'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

// Upload single file
async function uploadToR2(bucket: string, key: string, filepath: string, contentType: string) {
  const fileStream = createReadStream(filepath)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  })

  await s3.send(command)
}

// Delete orphaned file
async function deleteFromR2(bucket: string, key: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  await s3.send(command)
}

// List all files (for orphan detection)
async function listFiles(bucket: string, prefix?: string) {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  })

  const response = await s3.send(command)
  return response.Contents || []
}
```

### Parallel Upload Strategy

For >50 files, use Promise.all with batching:

```typescript
async function uploadFilesInParallel(files: FileInfo[], maxConcurrency = 10) {
  const results = []

  for (let i = 0; i < files.length; i += maxConcurrency) {
    const batch = files.slice(i, i + maxConcurrency)
    const batchPromises = batch.map(file => uploadWithRetry(file))
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  return results
}

async function uploadWithRetry(file: FileInfo, maxRetries = 3) {
  const delays = [1000, 2000, 4000] // Exponential backoff

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await uploadToR2(file.bucket, file.key, file.path, file.contentType)
      return { success: true, file }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to upload ${file.path} after ${maxRetries} attempts: ${error.message}`)
      }
      await sleep(delays[attempt])
    }
  }
}
```

### Authentication in Build Environment

Cloudflare Pages supports R2 access via environment variables:
- `R2_ACCESS_KEY_ID`: R2 API token ID
- `R2_SECRET_ACCESS_KEY`: R2 API token secret
- `R2_ENDPOINT`: Account-specific R2 endpoint

Set these in Cloudflare Pages project settings (not in git).

### Bucket Key Naming Strategy

To preserve paths and prevent collisions:

```typescript
function generateR2Key(originalPath: string, fileHash: string): string {
  // originalPath: "docs/research/paper.pdf"
  // fileHash: "a3f5b8c2d1e4f7a9..."

  const pathParts = originalPath.split('/')
  const filename = pathParts.pop()
  const directory = pathParts.join('/')

  // Include first 8 chars of hash for uniqueness
  const hashPrefix = fileHash.substring(0, 8)

  // Preserve directory structure
  if (directory) {
    return `${directory}/${hashPrefix}-${filename}`
  }

  return `${hashPrefix}-${filename}`
}

// Examples:
// "paper.pdf" → "a3f5b8c2-paper.pdf"
// "docs/research/paper.pdf" → "docs/research/a3f5b8c2-paper.pdf"
```

This ensures:
- Duplicate filenames in different folders don't collide
- Hash prefix makes keys unique even if filename changes
- Directory structure preserved for human readability
- Easy orphan detection (list all keys, compare to current references)

### Performance Considerations
- Linear scaling to 50 files: Sequential uploads (~5-10 seconds total)
- Beyond 50 files: Parallel batches of 10 concurrent uploads
- Network-bound operation: CPU impact minimal
- Cloudflare R2 has no rate limits for upload operations

### References
- [Cloudflare R2 Getting Started Guide](https://developers.cloudflare.com/r2/get-started/)
- [aws-sdk-js - Cloudflare R2 docs](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/)
- [Working with Cloudflare R2 using the AWS S3 SDK](https://medium.com/@aashari/working-with-cloudflare-r2-using-the-aws-s3-sdk-9c7efef06a23)

---

## Implementation Summary

### Technology Stack
- **Language**: TypeScript (Node.js)
- **CDN**: Cloudflare R2 (4 buckets or 1 bucket with prefixes)
- **Access Control**: Cloudflare Zero Trust Access (custom domains)
- **SDK**: @aws-sdk/client-s3 v3
- **Hashing**: Node.js crypto module (SHA-256 streaming)

### Architecture Pattern
- **Transformer Plugin**: Detect large files, compute hashes, rewrite links
- **Emitter Plugin**: Upload to appropriate R2 bucket, remove orphans
- **Utility Modules**: R2 client wrapper, hash utilities

### Key Design Decisions
1. ✅ Use 4 custom domains (one per tier) with R2 buckets
2. ✅ Apply Cloudflare Access policies at custom domain level
3. ✅ Compute SHA-256 hashes via streaming for deduplication
4. ✅ Use AWS S3 SDK for R2 operations
5. ✅ Parallel uploads with batching for >50 files
6. ✅ Exponential backoff retry (3 attempts: 1s, 2s, 4s)
7. ✅ Preserve directory structure in R2 keys
8. ✅ Immediate orphan deletion (no grace period)

### Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Custom domain setup complexity | Document setup in quickstart.md; create setup checklist |
| Access policy misconfiguration | Test all tiers before production; add validation script |
| Concurrent builds overwriting files | File hash ensures identical content; safe to overwrite |
| Build timeout with many files | Parallel uploads; fail fast on errors |
| Orphan detection inefficiency | Track references during build; diff against R2 list |

### Open Questions
- Should we use 4 separate buckets or 1 bucket with tier-based prefixes? (Recommend: 4 buckets for clearer separation)
- How to handle files referenced in multiple tiers? (Recommend: Upload to least-restrictive tier, per FR-026)
- Should hash be in URL path or as separate metadata? (Recommend: In path for immutability)

### Next Steps (Phase 1)
1. Create data-model.md defining entities (LargeFile, CDNMapping, FileReference)
2. Create contracts/ with R2 mapping schema and CDN URL structure
3. Create quickstart.md with R2 + Zero Trust setup instructions
4. Update agent context with technology decisions
