# Data Model: Filter Orphaned Attachments

**Feature**: 001-filter-orphaned-attachments
**Date**: 2025-10-27
**Phase**: Phase 1 - Design

## Overview

This document defines the data structures and entities used in the attachment filtering system. The system maintains an in-memory whitelist of attachments referenced by published pages and uses it to filter attachment copying during the asset emission phase.

## Core Entities

### 1. AttachmentReference

**Description**: Represents a single reference to an attachment file from a markdown page.

**Structure**:
```typescript
interface AttachmentReference {
  /** Normalized file path relative to content root (e.g., "images/photo.jpg") */
  path: FilePath

  /** Type of reference (how it's embedded in the page) */
  type: "image" | "video" | "audio" | "iframe" | "link"

  /** Original raw reference from HTML AST (for debugging) */
  rawReference: string

  /** Source page that references this attachment */
  sourcePage: SimpleSlug
}
```

**Lifecycle**:
1. Created during HAST traversal of published pages
2. Path normalized using `slugifyFilePath()`
3. Added to AttachmentWhitelist
4. Checked during asset emission

**Validation Rules**:
- `path` must not be empty
- `path` must not be an absolute URL (no `http://`, `https://`)
- `path` must not be an absolute filesystem path (no `/`, `C:\`)
- `path` must not end with `.md` or `.html` (handled by ContentPage emitter)

**Examples**:
```typescript
// Image embed from markdown
{
  path: "images/photo.jpg",
  type: "image",
  rawReference: "./images/photo%20one.jpg",
  sourcePage: "notes/my-page"
}

// Video embed from wikilink
{
  path: "media/video.mp4",
  type: "video",
  rawReference: "![[media/video.mp4]]",
  sourcePage: "projects/demo"
}

// PDF link
{
  path: "docs/document.pdf",
  type: "link",
  rawReference: "../docs/document.pdf",
  sourcePage: "notes/references"
}
```

---

### 2. AttachmentWhitelist

**Description**: Collection of attachment paths that are referenced by at least one published page. Stored in `BuildCtx.state` for communication between filter plugins and emitters.

**Structure**:
```typescript
interface AttachmentWhitelist {
  /** Set of normalized attachment paths to include in build */
  paths: Set<FilePath>

  /** Statistics for logging and auditing */
  stats: {
    totalReferences: number      // Total attachment refs found (with duplicates)
    uniqueAttachments: number    // Unique attachments (deduplicated)
    pagesScanned: number         // Number of pages scanned
  }

  /** Map of attachment path -> source pages (for debugging) */
  references?: Map<FilePath, Set<SimpleSlug>>
}
```

**Storage Location**: `ctx.state.attachmentWhitelist`

**Lifecycle**:
1. Created by AttachmentWhitelist filter plugin when first published page is scanned
2. Populated as each published page is processed (accumulation)
3. Read by Assets emitter to filter attachment copying
4. Discarded after build completes
5. Rebuilt from scratch on watch mode changes

**Operations**:
```typescript
// Initialize
ctx.state.attachmentWhitelist = {
  paths: new Set(),
  stats: { totalReferences: 0, uniqueAttachments: 0, pagesScanned: 0 },
  references: new Map()
}

// Add attachment
const normalized = slugifyFilePath(decodeURIComponent(ref) as FilePath)
whitelist.paths.add(normalized)
whitelist.stats.totalReferences++

// Check if attachment should be copied
const shouldCopy = whitelist.paths.has(slugifyFilePath(filePath))

// Get statistics
console.log(`Scanned ${stats.pagesScanned} pages, found ${stats.uniqueAttachments} attachments`)
```

**Deduplication**: Using a `Set` automatically deduplicates paths. If multiple pages reference the same attachment, it's only stored once:
```typescript
// Page 1 references "images/shared.png"
whitelist.paths.add("images/shared.png")

// Page 2 also references "images/shared.png"
whitelist.paths.add("images/shared.png")  // No-op, already in set

// Result: Set contains ["images/shared.png"] (one entry)
```

---

### 3. BuildCtx Extension

**Description**: Extension to Quartz's `BuildCtx` type to support attachment whitelist communication between plugins.

**Existing Structure** (from `quartz/util/ctx.ts`):
```typescript
export interface BuildCtx {
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]
  // ... other fields
}
```

**Extension**:
```typescript
export interface BuildCtx {
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]

  /** Shared state for cross-plugin communication */
  state: {
    /** Whitelist of attachments to include in build (populated by AttachmentWhitelist filter) */
    attachmentWhitelist?: AttachmentWhitelist
  }
}
```

**Usage**:
```typescript
// In AttachmentWhitelist filter plugin
if (!ctx.state) {
  ctx.state = {}
}
if (!ctx.state.attachmentWhitelist) {
  ctx.state.attachmentWhitelist = {
    paths: new Set(),
    stats: { totalReferences: 0, uniqueAttachments: 0, pagesScanned: 0 }
  }
}

// In Assets emitter
const whitelist = ctx.state?.attachmentWhitelist
if (whitelist && !whitelist.paths.has(normalizedPath)) {
  console.log(`Filtering orphaned attachment: ${filePath}`)
  continue  // Skip this file
}
```

**Rationale**: Using `ctx.state` allows:
- Clean communication between filter plugins and emitters
- No global variables (better for testing and parallel builds)
- Type-safe with TypeScript
- Follows existing Quartz patterns (ctx is threaded through all plugins)

---

### 4. FileFilterResult

**Description**: Result of checking whether an attachment file should be copied to output.

**Structure**:
```typescript
type FileFilterResult =
  | { action: "copy", reason: "whitelisted", path: FilePath }
  | { action: "skip", reason: "orphaned", path: FilePath }
  | { action: "skip", reason: "missing", path: FilePath }
  | { action: "skip", reason: "absolute-path", path: FilePath }
  | { action: "skip", reason: "markdown-file", path: FilePath }
```

**Usage**:
```typescript
function shouldCopyFile(
  filePath: FilePath,
  whitelist: AttachmentWhitelist | undefined
): FileFilterResult {
  // Markdown files handled by ContentPage emitter
  if (filePath.endsWith(".md") || filePath.endsWith(".html")) {
    return { action: "skip", reason: "markdown-file", path: filePath }
  }

  // If no whitelist, copy everything (backward compatibility)
  if (!whitelist) {
    return { action: "copy", reason: "whitelisted", path: filePath }
  }

  // Check whitelist
  const normalized = slugifyFilePath(filePath)
  if (whitelist.paths.has(normalized)) {
    return { action: "copy", reason: "whitelisted", path: filePath }
  }

  return { action: "skip", reason: "orphaned", path: filePath }
}
```

**Logging**:
```typescript
const result = shouldCopyFile(fp, whitelist)
if (result.action === "skip") {
  console.log(`[Assets] Skipping ${result.path}: ${result.reason}`)
} else {
  console.log(`[Assets] Copying ${result.path}`)
}
```

---

## Data Flow

### Attachment Reference Extraction Flow

```
Published Page (ProcessedContent)
  │
  ├─ [tree: HtmlRoot, vfile: VFile]
  │
  └─> extractAttachments(tree, vfile)
      │
      ├─ visit(tree, "element", callback)
      │  │
      │  ├─ Find <img>, <video>, <audio>, <iframe>, <a> elements
      │  │
      │  ├─ Extract src/href attribute
      │  │
      │  ├─ Filter: Skip external URLs, absolute paths, markdown files
      │  │
      │  └─ decodeURIComponent(src) → slugifyFilePath() → Normalized Path
      │
      └─> Set<FilePath> (attachment references for this page)
```

### Whitelist Building Flow

```
Filter Phase (AttachmentWhitelist plugin)
  │
  ├─ Initialize: ctx.state.attachmentWhitelist = { paths: Set(), stats: {...} }
  │
  └─ For each published page:
      │
      ├─ shouldPublish(ctx, [tree, vfile])
      │  │
      │  ├─ attachments = extractAttachments(tree, vfile)
      │  │
      │  └─ attachments.forEach(path => whitelist.paths.add(path))
      │
      └─> return true (don't filter content)
  │
  └─> ctx.state.attachmentWhitelist.paths = Set<FilePath> (complete whitelist)
```

### Attachment Filtering Flow

```
Emit Phase (Assets emitter)
  │
  ├─ fps = await filesToCopy(argv, cfg)  // All non-MD files from disk
  │
  └─ For each file path:
      │
      ├─ normalized = slugifyFilePath(fp)
      │
      ├─ isWhitelisted = ctx.state.attachmentWhitelist?.paths.has(normalized)
      │
      ├─ IF isWhitelisted OR no whitelist:
      │  └─> yield copyFile(argv, fp)  ✅ COPY
      │
      └─ ELSE:
         └─> console.log("Filtering orphaned:", fp)  ❌ SKIP
```

---

## State Transitions

### AttachmentWhitelist Lifecycle

```
[Uninitialized]
  │
  │ First published page enters AttachmentWhitelist.shouldPublish()
  │
  ├─> [Initializing]
  │    │
  │    └─ ctx.state.attachmentWhitelist = { paths: Set(), stats: {...} }
  │
  ├─> [Accumulating]
  │    │
  │    └─ For each published page: Add attachment references to whitelist
  │
  ├─> [Complete]
  │    │
  │    └─ All filter plugins finished, whitelist contains all refs
  │
  ├─> [In Use]
  │    │
  │    └─ Emitters read whitelist to filter asset copying
  │
  └─> [Discarded]
       │
       └─ Build complete, ctx goes out of scope
```

### Watch Mode Lifecycle

```
[Initial Build]
  │
  └─> Full whitelist built from all published pages
  │
  ├─> [Watching for Changes]
  │    │
  │    └─ File system watcher detects changes
  │
  ├─> [Partial Rebuild]
  │    │
  │    ├─ IF markdown file changed:
  │    │  ├─ Clear whitelist
  │    │  └─ Rebuild from all published pages (including updated page)
  │    │
  │    └─ IF attachment file changed:
  │       ├─ Check whitelist
  │       └─ Copy only if whitelisted
  │
  └─> Return to [Watching for Changes]
```

**Watch Mode Challenges**:
- Whitelist must be rebuilt when any markdown file changes (page might add/remove refs)
- Attachments added/removed must check against current whitelist
- Incremental updates complex; simplest approach is rebuild whitelist on any markdown change

---

## Data Integrity

### Invariants

1. **Uniqueness**: `AttachmentWhitelist.paths` contains no duplicates (enforced by Set)
2. **Normalization**: All paths in whitelist are normalized via `slugifyFilePath()`
3. **Completeness**: Whitelist includes all attachments from ALL published pages
4. **Consistency**: Same attachment referenced multiple times appears once in whitelist
5. **Validity**: All paths in whitelist are relative (no absolute URLs or filesystem paths)

### Validation

```typescript
function validateWhitelist(whitelist: AttachmentWhitelist): boolean {
  for (const path of whitelist.paths) {
    // Check no absolute URLs
    if (isAbsoluteUrl(path)) {
      console.error(`Invalid whitelist entry (absolute URL): ${path}`)
      return false
    }

    // Check no absolute paths
    if (isAbsolutePath(path)) {
      console.error(`Invalid whitelist entry (absolute path): ${path}`)
      return false
    }

    // Check not a markdown file
    if (path.endsWith(".md") || path.endsWith(".html")) {
      console.error(`Invalid whitelist entry (markdown file): ${path}`)
      return false
    }
  }

  return true
}
```

---

## Statistics & Metrics

### Build-time Statistics

The system collects statistics for audit and debugging purposes:

```typescript
interface AttachmentStats {
  pagesScanned: number          // Total pages processed
  totalReferences: number       // Total attachment refs (with duplicates)
  uniqueAttachments: number     // Unique attachments (whitelist size)
  orphanedAttachments: number   // Attachments skipped (not in whitelist)
  copiedAttachments: number     // Attachments actually copied
  missingAttachments: number    // References to non-existent files
}
```

**Logging Example**:
```
[AttachmentWhitelist] Scanned 1,245 pages
[AttachmentWhitelist] Found 3,821 attachment references
[AttachmentWhitelist] Whitelisted 1,502 unique attachments
[Assets] Filtered 247 orphaned attachments
[Assets] Copied 1,502 attachments
[Assets] Warnings: 12 missing files
```

**Success Criteria Metrics** (from spec.md SC-001 to SC-008):
- **SC-001**: Count direct URL access attempts to private attachments (0% exposure)
- **SC-002**: `copiedAttachments / uniqueAttachments` (100% inclusion)
- **SC-003**: `orphanedAttachments / totalFilesOnDisk` (100% exclusion)
- **SC-007**: Log filtering decisions clearly for audit

---

## Example Scenarios

### Scenario 1: Basic Filtering

**Input**:
- `notes/page1.md` (published): `![Photo](images/photo.jpg)`
- `notes/page2.md` (filtered): `![Private](images/private.png)`
- `content/images/photo.jpg` (exists)
- `content/images/private.png` (exists)

**Whitelist**:
```typescript
{
  paths: Set(["images/photo.jpg"]),
  stats: { totalReferences: 1, uniqueAttachments: 1, pagesScanned: 1 }
}
```

**Output**:
- ✅ `images/photo.jpg` copied (whitelisted)
- ❌ `images/private.png` skipped (orphaned)

---

### Scenario 2: Shared Attachment

**Input**:
- `page1.md` (published, Public): `![Shared](shared.png)`
- `page2.md` (published, Trusted): `![Shared](shared.png)`
- `page3.md` (filtered): `![Shared](shared.png)`
- `content/shared.png` (exists)

**Whitelist** (Public tier):
```typescript
{
  paths: Set(["shared.png"]),
  stats: { totalReferences: 1, uniqueAttachments: 1, pagesScanned: 1 },
  references: Map([
    ["shared.png", Set(["page1"])]  // Only page1 published in Public tier
  ])
}
```

**Output**:
- ✅ `shared.png` copied (at least one published page references it)

---

### Scenario 3: Multiple Formats

**Input**:
- `page.md`: Contains multiple references
  ```markdown
  ![[wikilink.jpg]]
  ![markdown](./image.png)
  [PDF link](../docs/file.pdf)
  <video src="media/video.mp4"></video>
  ```

**Whitelist**:
```typescript
{
  paths: Set([
    "wikilink.jpg",
    "image.png",
    "docs/file.pdf",
    "media/video.mp4"
  ]),
  stats: { totalReferences: 4, uniqueAttachments: 4, pagesScanned: 1 }
}
```

**Output**:
- ✅ All 4 attachments copied

---

### Scenario 4: Missing File

**Input**:
- `page.md`: `![Missing](missing.jpg)`
- `content/missing.jpg` does NOT exist

**Whitelist**:
```typescript
{
  paths: Set(["missing.jpg"]),
  stats: { totalReferences: 1, uniqueAttachments: 1, pagesScanned: 1 }
}
```

**Processing**:
```typescript
// In Assets emitter
try {
  await fs.promises.copyFile("content/missing.jpg", "public/missing.jpg")
} catch (err) {
  if (err.code === 'ENOENT') {
    console.warn("Warning: Referenced attachment not found: missing.jpg")
    stats.missingAttachments++
    // Continue build (don't fail)
  }
}
```

**Output**:
- ⚠️ Warning logged
- ❌ `missing.jpg` NOT copied (doesn't exist)
- ✅ Build continues successfully

---

## Memory & Performance

### Memory Usage Estimates

**Typical vault** (1,000 pages, 5,000 attachments, 1,500 referenced):

| Data Structure | Count | Size per Item | Total |
|---------------|-------|---------------|-------|
| AttachmentWhitelist.paths | 1,500 | 50 bytes (avg path length) | 75 KB |
| AttachmentWhitelist.references | 1,500 | 100 bytes (path + Set of slugs) | 150 KB |
| AttachmentWhitelist.stats | 1 | 100 bytes | 0.1 KB |
| **Total** | | | **~225 KB** |

**Large vault** (10,000 pages, 50,000 attachments, 15,000 referenced):

| Data Structure | Count | Size per Item | Total |
|---------------|-------|---------------|-------|
| AttachmentWhitelist.paths | 15,000 | 50 bytes | 750 KB |
| AttachmentWhitelist.references | 15,000 | 100 bytes | 1.5 MB |
| AttachmentWhitelist.stats | 1 | 100 bytes | 0.1 KB |
| **Total** | | | **~2.25 MB** |

**Conclusion**: Memory overhead is negligible even for very large vaults (<10 MB).

### Time Complexity

| Operation | Complexity | Typical Time |
|-----------|-----------|--------------|
| Extract attachments from one page | O(n) where n = nodes in HAST | <1 ms per page |
| Add attachment to whitelist | O(1) (Set.add) | <0.01 ms |
| Build complete whitelist | O(p × n) where p = pages, n = avg nodes | ~1 second for 1,000 pages |
| Check if attachment whitelisted | O(1) (Set.has) | <0.01 ms |
| Filter attachments | O(a) where a = attachments | ~0.5 seconds for 5,000 attachments |
| **Total overhead** | | **~1-2 seconds** for typical vault |

**Success Criteria**: SC-004 requires <2x current build time. The overhead is well within acceptable limits.

---

## Data Model Summary

### Key Entities
1. **AttachmentReference**: Individual attachment reference from a page
2. **AttachmentWhitelist**: Set of whitelisted attachment paths + metadata
3. **BuildCtx Extension**: Shared state for cross-plugin communication
4. **FileFilterResult**: Result of attachment filtering decision

### Key Operations
1. **Extract**: Scan HAST for attachment references
2. **Normalize**: Convert raw paths to normalized FilePath
3. **Accumulate**: Build whitelist from all published pages
4. **Filter**: Check whitelist before copying attachments
5. **Log**: Record filtering decisions for audit

### Data Flow
1. Filter phase: Scan published pages → Build whitelist
2. Emit phase: Check whitelist → Copy or skip attachments
3. Watch mode: Rebuild whitelist on markdown changes

### Validation
1. No absolute URLs in whitelist
2. No absolute filesystem paths
3. No markdown files in whitelist
4. All paths normalized consistently

**Ready for Phase 1 contracts generation!** ✅
