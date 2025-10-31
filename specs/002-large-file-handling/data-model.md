# Data Model: Large File Handling

**Feature**: 002-large-file-handling
**Date**: 2025-10-29
**Phase**: 1 - Design

## Overview

This document defines the data entities, relationships, and state transitions for the large file CDN handling system. All entities are **build-time constructs** - they exist during the Quartz build process and are not persisted to a database.

## Core Entities

### 1. LargeFile

Represents a file over 20MB that needs to be uploaded to CDN.

**Attributes**:
```typescript
interface LargeFile {
  // Identity
  localPath: string              // Absolute path in content/ directory (e.g., "/path/to/content/docs/paper.pdf")
  filename: string                // Base filename (e.g., "paper.pdf")
  relativePath: string            // Path relative to content root (e.g., "docs/paper.pdf")

  // Content
  sizeBytes: number               // File size in bytes (must be > 20MB)
  contentType: string             // MIME type (e.g., "application/pdf", "image/png")
  hash: string                    // SHA-256 hex digest (64 chars)

  // CDN Mapping
  targetBucket: string            // R2 bucket name (e.g., "large-files-trusted")
  cdnDomain: string               // Custom domain for this tier (e.g., "cdn-trusted.dario.ca")
  r2Key: string                   // Object key in R2 (e.g., "docs/research/a3f5b8c2-paper.pdf")
  cdnUrl: string                  // Full CDN URL (e.g., "https://cdn-trusted.dario.ca/docs/research/a3f5b8c2-paper.pdf")

  // Access Control
  accessLevel: AccessLevel        // Required authentication level
  referencingNotes: string[]      // Paths of notes that reference this file

  // State
  uploadStatus: UploadStatus      // Current upload state
  uploadAttempts: number          // Number of upload attempts (for retry logic)
  lastError?: string              // Last error message if upload failed
}
```

**Validation Rules**:
- `sizeBytes` MUST be > 20 * 1024 * 1024 (20MB)
- `hash` MUST be exactly 64 hexadecimal characters (SHA-256)
- `localPath` MUST exist in filesystem
- `contentType` MUST be valid MIME type
- `referencingNotes` MUST NOT be empty (orphan check)
- `r2Key` MUST preserve directory structure from `relativePath`
- `cdnUrl` MUST use HTTPS protocol

**Relationships**:
- Referenced by multiple `FileReference` entities (many-to-many via referencingNotes)
- Maps to exactly one entry in `CDNMapping` (one-to-one)
- Has one `AccessLevel` (many-to-one)

### 2. FileReference

Represents a link from a note to a large file.

**Attributes**:
```typescript
interface FileReference {
  // Source
  sourceNotePath: string          // Path to note containing the link
  sourceNoteSlug: string          // Slug of source note (for filtering check)
  publishMode?: string            // Publish mode from note's frontmatter (e.g., "[[Trusted]]")

  // Target
  targetPath: string              // Original path in markdown (may be relative or absolute)
  resolvedPath: string            // Resolved absolute path to the file
  linkType: LinkType              // How the file was linked

  // Link Context
  lineNumber?: number             // Line number in source note (for error reporting)
  linkText?: string               // Original markdown link text

  // Processing State
  isPublished: boolean            // Whether source note passes publish mode filter
  requiresRewriting: boolean      // Whether link needs to be rewritten to CDN URL
}

enum LinkType {
  MarkdownLink = "markdown",      // ![alt](path/to/file.pdf) or [text](path/to/file.pdf)
  WikiLink = "wikilink",          // ![[file.pdf]] or [[file.pdf]]
  HtmlEmbed = "html",             // <img src="..." /> or <a href="..." />
}
```

**Validation Rules**:
- `sourceNotePath` MUST exist in content
- `resolvedPath` MUST resolve to valid file path
- If `isPublished` is false, `requiresRewriting` MUST be false
- `publishMode` format MUST be wikilink style if present (e.g., "[[Trusted]]")

**Relationships**:
- Belongs to one note (source)
- Points to one `LargeFile` (via resolvedPath)
- Determines `AccessLevel` for target file

### 3. CDNMapping

Tracks the mapping between local files and CDN URLs. Persisted as JSON during build for orphan detection.

**Attributes**:
```typescript
interface CDNMapping {
  // Identity
  hash: string                    // SHA-256 of file content (primary key)

  // Paths
  localPath: string               // Original local path (for reverse lookup)
  r2Bucket: string                // Bucket name
  r2Key: string                   // Object key in R2
  cdnUrl: string                  // Full CDN URL

  // Metadata
  uploadTimestamp: string         // ISO 8601 timestamp of last upload
  fileSize: number                // File size in bytes
  contentType: string             // MIME type
  accessLevel: AccessLevel        // Required auth level

  // Reference Tracking
  referencedBy: string[]          // List of note slugs that reference this file
}
```

**Storage Location**: `.quartz-cache/cdn-mappings.json` (build artifact, not committed)

**Validation Rules**:
- `hash` MUST be unique (no collisions)
- `uploadTimestamp` MUST be valid ISO 8601
- `referencedBy` MUST NOT be empty for active files
- If `referencedBy` is empty, file is orphaned and should be deleted

**Lifecycle**:
1. **Build Start**: Load existing mappings from cache
2. **During Build**: Update mappings for newly uploaded files
3. **Orphan Detection**: Find mappings with empty `referencedBy` arrays
4. **Build End**: Save updated mappings to cache, delete orphaned R2 objects

### 4. AccessLevel

Enum defining authentication requirements for a large file.

**Definition**:
```typescript
enum AccessLevel {
  Full = "full",        // Most restrictive - requires vault owner auth
  Trusted = "trusted",  // Requires trusted user auth
  Shachu = "shachu",    // Requires shachu member auth
  Public = "public",    // No authentication required
}
```

**Hierarchy** (for multi-reference resolution):
```
Public > Shachu > Trusted > Full
(least restrictive)      (most restrictive)
```

**Mapping to R2 Buckets**:
```typescript
const BUCKET_FOR_ACCESS_LEVEL: Record<AccessLevel, string> = {
  [AccessLevel.Full]: "large-files-full",
  [AccessLevel.Trusted]: "large-files-trusted",
  [AccessLevel.Shachu]: "large-files-shachu",
  [AccessLevel.Public]: "large-files-public",
}

const DOMAIN_FOR_ACCESS_LEVEL: Record<AccessLevel, string> = {
  [AccessLevel.Full]: "cdn-full.dario.ca",
  [AccessLevel.Trusted]: "cdn-trusted.dario.ca",
  [AccessLevel.Shachu]: "cdn-shachu.dario.ca",
  [AccessLevel.Public]: "cdn-public.dario.ca",
}
```

**Resolution Algorithm**:
When a file is referenced by multiple notes with different publish modes:
1. Collect all `publishMode` values from referencing notes
2. Map each to `AccessLevel`:
   - `[[Public]]` → `AccessLevel.Public`
   - `[[Shachu]]` → `AccessLevel.Shachu`
   - `[[Trusted]]` → `AccessLevel.Trusted`
   - No field (or any other value) → `AccessLevel.Full`
3. Select the **least restrictive** level (highest in hierarchy)
4. Upload file to corresponding bucket

**Example**:
- Note A (public) and Note B (trusted) both reference `paper.pdf`
- Access levels: [Public, Trusted]
- Resolution: Public (least restrictive)
- Upload to: `large-files-public` bucket
- CDN URL: `https://cdn-public.dario.ca/...`

### 5. UploadStatus

Enum tracking upload state during build.

**Definition**:
```typescript
enum UploadStatus {
  Pending = "pending",        // Detected but not yet uploaded
  Uploading = "uploading",    // Currently being uploaded
  Completed = "completed",    // Successfully uploaded
  Failed = "failed",          // Upload failed after retries
  Skipped = "skipped",        // Already exists in R2 with same hash
}
```

**State Transitions**:
```
Pending → Uploading → Completed
    ↓         ↓
    ↓     Failed (after 3 retry attempts)
    ↓
Skipped (if hash found in CDNMapping cache)
```

## Entity Relationships

```
┌─────────────────┐
│  FileReference  │───┐
│  (many)         │   │
└─────────────────┘   │
        │             │
        │references   │
        ↓             ↓
┌─────────────────┐  ┌─────────────────┐
│   LargeFile     │──│   CDNMapping    │
│   (central)     │  │   (persisted)   │
└─────────────────┘  └─────────────────┘
        │
        │has
        ↓
┌─────────────────┐
│  AccessLevel    │
│   (enum)        │
└─────────────────┘
```

**Cardinality**:
- 1 LargeFile : Many FileReferences (one file referenced by multiple notes)
- 1 LargeFile : 1 CDNMapping (bijection via hash)
- Many LargeFiles : 1 AccessLevel (many files can have same access level)

## Data Flow

### Build Process

1. **Discovery Phase** (Transformer Plugin):
   ```
   Parse markdown notes
       ↓
   Detect file links (images, PDFs, etc.)
       ↓
   Resolve paths (relative → absolute)
       ↓
   Check file size
       ↓
   If > 20MB: Create FileReference
       ↓
   Group FileReferences by resolved path
       ↓
   For each unique file: Create LargeFile entity
   ```

2. **Access Level Resolution**:
   ```
   For each LargeFile:
       ↓
   Collect publishMode from all referencingNotes
       ↓
   Map to AccessLevel values
       ↓
   Select least restrictive (highest in hierarchy)
       ↓
   Assign to LargeFile.accessLevel
   ```

3. **Hash Computation**:
   ```
   For each LargeFile:
       ↓
   Stream file through SHA-256
       ↓
   Store hex digest in LargeFile.hash
       ↓
   Check CDNMapping cache for existing upload
       ↓
   If hash exists: Set status = Skipped
       ↓
   Else: Set status = Pending
   ```

4. **Upload Phase** (Emitter Plugin):
   ```
   Filter LargeFiles where status = Pending
       ↓
   Batch into groups of 10 (for parallelization)
       ↓
   For each file in batch:
       ↓
   Determine bucket from accessLevel
       ↓
   Generate r2Key (preserve path + hash prefix)
       ↓
   Upload to R2 with retry logic
       ↓
   On success: Update CDNMapping, set status = Completed
       ↓
   On failure: Set status = Failed, throw error
   ```

5. **Link Rewriting** (Transformer Plugin):
   ```
   For each FileReference where requiresRewriting = true:
       ↓
   Look up LargeFile by resolvedPath
       ↓
   Replace original link with LargeFile.cdnUrl
       ↓
   Preserve alt text, link text, and styling
   ```

6. **Orphan Cleanup** (Emitter Plugin):
   ```
   Load CDNMapping from cache
       ↓
   For each current LargeFile:
       ↓
   Update CDNMapping.referencedBy with current note slugs
       ↓
   Find mappings where referencedBy is empty
       ↓
   Delete those objects from R2
       ↓
   Remove from CDNMapping cache
       ↓
   Save updated CDNMapping
   ```

## Example Data

### LargeFile Example
```json
{
  "localPath": "/path/to/content/docs/research/paper.pdf",
  "filename": "paper.pdf",
  "relativePath": "docs/research/paper.pdf",
  "sizeBytes": 25165824,
  "contentType": "application/pdf",
  "hash": "a3f5b8c2d1e4f7a9b6c3d0e1f2a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
  "targetBucket": "large-files-trusted",
  "cdnDomain": "cdn-trusted.dario.ca",
  "r2Key": "docs/research/a3f5b8c2-paper.pdf",
  "cdnUrl": "https://cdn-trusted.dario.ca/docs/research/a3f5b8c2-paper.pdf",
  "accessLevel": "trusted",
  "referencingNotes": ["notes/research-notes.md", "notes/literature-review.md"],
  "uploadStatus": "completed",
  "uploadAttempts": 1
}
```

### FileReference Example
```json
{
  "sourceNotePath": "content/notes/research-notes.md",
  "sourceNoteSlug": "notes/research-notes",
  "publishMode": "[[Trusted]]",
  "targetPath": "../docs/research/paper.pdf",
  "resolvedPath": "/path/to/content/docs/research/paper.pdf",
  "linkType": "markdown",
  "lineNumber": 42,
  "linkText": "[Download Research Paper](../docs/research/paper.pdf)",
  "isPublished": true,
  "requiresRewriting": true
}
```

### CDNMapping Example
```json
{
  "hash": "a3f5b8c2d1e4f7a9b6c3d0e1f2a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
  "localPath": "docs/research/paper.pdf",
  "r2Bucket": "large-files-trusted",
  "r2Key": "docs/research/a3f5b8c2-paper.pdf",
  "cdnUrl": "https://cdn-trusted.dario.ca/docs/research/a3f5b8c2-paper.pdf",
  "uploadTimestamp": "2025-10-29T14:30:00.000Z",
  "fileSize": 25165824,
  "contentType": "application/pdf",
  "accessLevel": "trusted",
  "referencedBy": ["notes/research-notes", "notes/literature-review"]
}
```

## Constraints & Invariants

### Data Integrity
1. **No Orphaned Files**: Every `LargeFile` MUST have at least one entry in `referencingNotes`
2. **Hash Uniqueness**: `CDNMapping.hash` MUST be unique across all mappings
3. **Path Consistency**: `LargeFile.r2Key` MUST preserve directory structure from `relativePath`
4. **Access Level Correctness**: `accessLevel` MUST be the least restrictive level from all `referencingNotes`

### State Transitions
1. **Upload Status**: Can only transition forward (no Completed → Pending)
2. **Retry Limit**: `uploadAttempts` MUST NOT exceed 3
3. **Failed State**: If status = Failed, build MUST fail with error

### Build-Time Only
1. **No Persistence**: Entities exist only during build process
2. **Cache Only**: CDNMapping persisted in `.quartz-cache/`, not in git
3. **Idempotent**: Running build twice produces identical CDN state

## Performance Considerations

### Memory Usage
- **LargeFiles**: ~1KB per file → 50KB for 50 files (negligible)
- **FileReferences**: ~500 bytes per reference → 25KB for 50 files
- **CDNMapping**: ~1KB per entry → persistent, loaded once at build start
- **File Streaming**: Hash computation uses constant memory regardless of file size

### Time Complexity
- **Hash Computation**: O(n) where n = file size, but linear to file count (parallelizable)
- **Access Level Resolution**: O(m) where m = number of references per file (typically < 10)
- **Orphan Detection**: O(k) where k = total mappings in cache (typically < 100)
- **Upload**: O(f) where f = number of files, batched for parallelization

### Expected Scale
- Typical: 5-20 large files per build
- Design target: 50-100 large files
- Maximum: 500+ files (would require tuning parallel batch size)
