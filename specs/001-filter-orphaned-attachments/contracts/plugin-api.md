# Plugin API Contract: Attachment Filtering

**Feature**: 001-filter-orphaned-attachments
**Date**: 2025-10-27
**Phase**: Phase 1 - Design

## Overview

This document defines the API contracts for the attachment filtering feature. It specifies the interfaces, function signatures, and behaviors that must be implemented to integrate attachment filtering into the Quartz build system.

---

## 1. AttachmentWhitelist Filter Plugin

### Plugin Interface

```typescript
import { QuartzFilterPlugin } from "../types"
import { FilePath } from "../../util/path"

export interface Options {
  /** Enable detailed logging of attachment scanning */
  verbose?: boolean

  /** Enable reference tracking (stores which pages reference each attachment) */
  trackReferences?: boolean
}

export const AttachmentWhitelist: QuartzFilterPlugin<Partial<Options>>
```

### Plugin Signature

```typescript
export const AttachmentWhitelist: QuartzFilterPlugin<Partial<Options>> = (userOpts) => {
  const opts: Options = {
    verbose: false,
    trackReferences: false,
    ...userOpts,
  }

  return {
    name: "AttachmentWhitelist",
    shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean
  }
}
```

### shouldPublish Method

**Signature**:
```typescript
shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean
```

**Parameters**:
- `ctx: BuildCtx` - Build context containing configuration and shared state
- `content: ProcessedContent` - Tuple of `[tree: HtmlRoot, vfile: VFile]` representing the current page

**Returns**: `boolean`
- **Always returns `true`** (this plugin doesn't filter content, only builds whitelist)

**Side Effects**:
- Initializes `ctx.state.attachmentWhitelist` on first invocation
- Scans the HTML AST (`tree`) for attachment references
- Adds normalized attachment paths to `ctx.state.attachmentWhitelist.paths`
- Updates statistics in `ctx.state.attachmentWhitelist.stats`
- If `trackReferences` enabled, updates `ctx.state.attachmentWhitelist.references`

**Behavior**:
```typescript
shouldPublish(ctx, [tree, vfile]) {
  // 1. Initialize whitelist if needed
  if (!ctx.state) {
    ctx.state = {}
  }
  if (!ctx.state.attachmentWhitelist) {
    ctx.state.attachmentWhitelist = {
      paths: new Set(),
      stats: { totalReferences: 0, uniqueAttachments: 0, pagesScanned: 0 },
      references: opts.trackReferences ? new Map() : undefined
    }
  }

  const whitelist = ctx.state.attachmentWhitelist

  // 2. Extract attachments from this page
  const attachments = extractAttachments(tree, vfile, opts)

  // 3. Add to whitelist
  const beforeSize = whitelist.paths.size
  attachments.forEach(path => {
    whitelist.paths.add(path)

    if (opts.trackReferences) {
      if (!whitelist.references!.has(path)) {
        whitelist.references!.set(path, new Set())
      }
      whitelist.references!.get(path)!.add(vfile.data.slug!)
    }
  })

  // 4. Update statistics
  whitelist.stats.totalReferences += attachments.size
  whitelist.stats.uniqueAttachments = whitelist.paths.size
  whitelist.stats.pagesScanned++

  if (opts.verbose) {
    const newAttachments = whitelist.paths.size - beforeSize
    console.log(`[AttachmentWhitelist] ${vfile.data.slug}: found ${attachments.size} refs (${newAttachments} new)`)
  }

  // 5. Always return true (don't filter content)
  return true
}
```

### Configuration

**In quartz.config.ts**:
```typescript
plugins: {
  filters: [
    Plugin.RemoveDrafts(),
    Plugin.IndexSwapper(),
    Plugin.PublishMode({ mode: process.env.QUARTZ_PUBLISH_MODE }),
    Plugin.AttachmentWhitelist({ verbose: false, trackReferences: false }),  // ADD THIS
  ],
  // ...
}
```

**Plugin Order**: MUST run after `PublishMode` to only scan published pages.

---

## 2. extractAttachments Utility Function

### Function Signature

```typescript
export function extractAttachments(
  tree: HtmlRoot,
  vfile: VFile,
  opts?: { verbose?: boolean }
): Set<FilePath>
```

**Module**: `quartz/util/attachments.ts`

**Parameters**:
- `tree: HtmlRoot` - HTML AST to scan for attachment references
- `vfile: VFile` - Virtual file containing metadata about the current page
- `opts?: { verbose?: boolean }` - Optional configuration

**Returns**: `Set<FilePath>`
- Set of normalized attachment paths referenced in this page
- Empty set if no attachments found

**Behavior**:
1. Traverse HTML AST using `visit(tree, "element", callback)`
2. For each element node:
   - Check if it's an attachment-bearing element (`img`, `video`, `audio`, `iframe`, `a`)
   - Extract `src` or `href` attribute
   - Validate the reference (skip external URLs, absolute paths, markdown files)
   - Normalize the path using `slugifyFilePath()`
   - Add to result set
3. Return deduplicated set of attachment paths

**Validation Rules**:
```typescript
function isValidAttachmentReference(src: string): boolean {
  // Must be non-empty string
  if (!src || typeof src !== "string") return false

  // Skip external URLs
  if (isAbsoluteUrl(src)) return false

  // Skip absolute filesystem paths
  if (isAbsolutePath(src)) {
    console.warn(`[AttachmentWhitelist] Skipping absolute path: ${src}`)
    return false
  }

  // Skip markdown/HTML files (handled by ContentPage emitter)
  if (src.endsWith(".md") || src.endsWith(".html")) return false

  // Skip anchor links
  if (src.startsWith("#")) return false

  return true
}
```

**Example Implementation**:
```typescript
export function extractAttachments(
  tree: HtmlRoot,
  vfile: VFile,
  opts?: { verbose?: boolean }
): Set<FilePath> {
  const attachments = new Set<FilePath>()

  visit(tree, "element", (node: Element) => {
    // Get src or href attribute
    const src = (node.properties?.src || node.properties?.href) as string | undefined
    if (!src) return

    // Validate reference
    if (!isValidAttachmentReference(src)) return

    // Normalize path
    try {
      const decoded = decodeURIComponent(src)
      const normalized = slugifyFilePath(decoded as FilePath)
      attachments.add(normalized)

      if (opts?.verbose) {
        console.log(`[AttachmentWhitelist] ${vfile.data.slug}: ${src} -> ${normalized}`)
      }
    } catch (err) {
      console.warn(`[AttachmentWhitelist] Failed to normalize path: ${src}`, err)
    }
  })

  return attachments
}
```

**Error Handling**:
- Invalid URIs (malformed URL encoding) → Log warning, skip reference
- Null/undefined src → Skip silently
- Absolute paths → Log warning, skip reference
- External URLs → Skip silently (expected behavior)

---

## 3. Assets Emitter Modification

### Modified emit Method

**File**: `quartz/plugins/emitters/assets.ts`

**Signature**:
```typescript
async *emit(ctx: BuildCtx): AsyncGenerator<FilePath>
```

**Changes**:
```typescript
export const Assets: QuartzEmitterPlugin = () => {
  return {
    name: "Assets",
    async *emit(ctx) {
      const { argv, cfg, state } = ctx
      const fps = await filesToCopy(argv, cfg)
      const whitelist = state?.attachmentWhitelist

      // Statistics
      let copied = 0
      let filtered = 0

      for (const fp of fps) {
        // Check if this file should be copied
        const result = shouldCopyAttachment(fp, whitelist)

        if (result.action === "skip") {
          console.log(`[Assets] Skipping ${fp}: ${result.reason}`)
          filtered++
          continue
        }

        // Copy the file
        try {
          const dest = await copyFile(argv, fp)
          yield dest
          copied++
        } catch (err) {
          if (err.code === 'ENOENT') {
            console.warn(`[Assets] Referenced attachment not found: ${fp}`)
          } else {
            console.error(`[Assets] Failed to copy ${fp}:`, err)
            throw err
          }
        }
      }

      // Log summary
      if (whitelist) {
        console.log(`[Assets] Copied ${copied} attachments, filtered ${filtered} orphaned`)
      }
    },

    // partialEmit remains largely unchanged, but also checks whitelist
    async *partialEmit(ctx, _content, _resources, changeEvents) {
      const whitelist = ctx.state?.attachmentWhitelist

      for (const changeEvent of changeEvents) {
        const ext = path.extname(changeEvent.path)
        if (ext === ".md") {
          // Markdown file changed → rebuild whitelist
          // This is handled by full rebuild trigger in watch mode
          continue
        }

        if (changeEvent.type === "add" || changeEvent.type === "change") {
          const result = shouldCopyAttachment(changeEvent.path, whitelist)
          if (result.action === "copy") {
            yield copyFile(ctx.argv, changeEvent.path)
          } else {
            console.log(`[Assets] Skipping ${changeEvent.path}: ${result.reason}`)
          }
        } else if (changeEvent.type === "delete") {
          const name = slugifyFilePath(changeEvent.path)
          const dest = joinSegments(ctx.argv.output, name) as FilePath
          await fs.promises.unlink(dest)
        }
      }
    }
  }
}
```

---

## 4. shouldCopyAttachment Helper Function

### Function Signature

```typescript
export function shouldCopyAttachment(
  filePath: FilePath,
  whitelist: AttachmentWhitelist | undefined
): FileFilterResult
```

**Module**: `quartz/util/attachments.ts`

**Parameters**:
- `filePath: FilePath` - Path to the attachment file (relative to content directory)
- `whitelist: AttachmentWhitelist | undefined` - Whitelist built by AttachmentWhitelist filter plugin

**Returns**: `FileFilterResult`
```typescript
type FileFilterResult =
  | { action: "copy", reason: "whitelisted" }
  | { action: "copy", reason: "no-whitelist" }
  | { action: "skip", reason: "orphaned" }
  | { action: "skip", reason: "markdown-file" }
```

**Behavior**:
```typescript
export function shouldCopyAttachment(
  filePath: FilePath,
  whitelist: AttachmentWhitelist | undefined
): FileFilterResult {
  // Skip markdown files (handled by ContentPage emitter)
  if (filePath.endsWith(".md") || filePath.endsWith(".html")) {
    return { action: "skip", reason: "markdown-file" }
  }

  // If no whitelist exists, copy everything (backward compatibility)
  if (!whitelist) {
    return { action: "copy", reason: "no-whitelist" }
  }

  // Check whitelist
  const normalized = slugifyFilePath(filePath)
  if (whitelist.paths.has(normalized)) {
    return { action: "copy", reason: "whitelisted" }
  }

  // Not in whitelist → orphaned
  return { action: "skip", reason: "orphaned" }
}
```

**Backward Compatibility**: If `ctx.state.attachmentWhitelist` is undefined (plugin not configured), all attachments are copied. This ensures existing Quartz installations don't break.

---

## 5. BuildCtx State Extension

### Type Definition

**File**: `quartz/util/ctx.ts` (or new file `quartz/util/types.ts`)

```typescript
import { FilePath } from "./path"
import { SimpleSlug } from "./path"

/** Whitelist of attachments to include in build */
export interface AttachmentWhitelist {
  /** Set of normalized attachment paths to copy */
  paths: Set<FilePath>

  /** Statistics for logging */
  stats: {
    totalReferences: number      // Total refs found (with duplicates)
    uniqueAttachments: number    // Unique attachments (whitelist size)
    pagesScanned: number         // Number of pages scanned
  }

  /** Optional: Map of attachment -> source pages (for debugging) */
  references?: Map<FilePath, Set<SimpleSlug>>
}

/** Shared state for cross-plugin communication */
export interface BuildState {
  /** Attachment whitelist (populated by AttachmentWhitelist filter plugin) */
  attachmentWhitelist?: AttachmentWhitelist
}

/** Extend BuildCtx with state field */
export interface BuildCtx {
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]

  /** Shared state for plugins */
  state?: BuildState
}
```

**Initialization**:
```typescript
// In build.ts or wherever BuildCtx is created
const ctx: BuildCtx = {
  argv,
  cfg,
  allSlugs,
  state: {}  // Initialize empty state
}
```

---

## 6. Helper Utilities

### isAbsolutePath Function

```typescript
/**
 * Check if a path is an absolute filesystem path (Unix or Windows)
 * @param path - Path to check
 * @returns true if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  // Unix absolute path (starts with /)
  if (path.startsWith("/")) return true

  // Windows absolute path (starts with C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\/]/.test(path)) return true

  return false
}
```

**Module**: `quartz/util/attachments.ts`

---

## 7. Error Handling Contract

### Error Recovery Behavior

| Error Scenario | Expected Behavior | Error Code | User Visible |
|---------------|-------------------|------------|--------------|
| **Missing attachment file** | Log warning, continue build | ENOENT | ⚠️ Warning in logs |
| **Invalid URI (malformed encoding)** | Log warning, skip reference | URIError | ⚠️ Warning in logs |
| **Absolute path reference** | Log warning, skip reference | N/A | ⚠️ Warning in logs |
| **External URL** | Skip silently | N/A | ❌ No warning (expected) |
| **File copy failure (permissions)** | Throw error, fail build | EACCES | ❌ Build fails |
| **Out of disk space** | Throw error, fail build | ENOSPC | ❌ Build fails |

**Principle**: Graceful degradation for content issues (missing files, invalid refs), but fail fast for infrastructure issues (permissions, disk space).

### Logging Contract

**Log Levels**:
- `console.log()` - Informational (attachment filtering decisions)
- `console.warn()` - Warnings (missing files, invalid refs)
- `console.error()` - Errors (file copy failures, unexpected errors)

**Log Format**:
```
[PluginName] Message: details
```

**Examples**:
```
[AttachmentWhitelist] Scanned 1,245 pages, found 1,502 unique attachments
[Assets] Skipping images/orphan.png: orphaned
[Assets] Warning: Referenced attachment not found: missing.jpg
[Assets] Copied 1,502 attachments, filtered 247 orphaned
```

---

## 8. Testing Contracts

### Unit Test Interface

**File**: `tests/attachment-filtering/attachment-filter.test.ts`

**Required Test Functions**:
```typescript
describe("extractAttachments", () => {
  test("extracts img src attributes", () => { ... })
  test("extracts video src attributes", () => { ... })
  test("extracts audio src attributes", () => { ... })
  test("extracts a href attributes", () => { ... })
  test("skips external URLs", () => { ... })
  test("skips absolute paths", () => { ... })
  test("skips markdown files", () => { ... })
  test("handles URL-encoded paths", () => { ... })
  test("normalizes paths correctly", () => { ... })
})

describe("shouldCopyAttachment", () => {
  test("copies whitelisted attachments", () => { ... })
  test("skips orphaned attachments", () => { ... })
  test("skips markdown files", () => { ... })
  test("copies all when no whitelist", () => { ... })
})

describe("AttachmentWhitelist plugin", () => {
  test("initializes whitelist on first page", () => { ... })
  test("accumulates attachments across pages", () => { ... })
  test("deduplicates shared attachments", () => { ... })
  test("updates statistics correctly", () => { ... })
  test("tracks references when enabled", () => { ... })
})
```

### Integration Test Interface

**File**: `tests/attachment-filtering/integration.test.ts`

**Required Test Scenarios** (per spec.md acceptance scenarios):
```typescript
describe("Attachment Filtering Integration", () => {
  test("US1-S1: Private attachment filtered on Public tier", async () => { ... })
  test("US1-S2: Shared attachment kept when one page published", async () => { ... })
  test("US1-S3: Public attachment in all tiers", async () => { ... })
  test("US1-S4: Orphaned attachment removed", async () => { ... })

  test("US2-S1: Wikilink format detected", async () => { ... })
  test("US2-S2: Markdown image format detected", async () => { ... })
  test("US2-S3: Markdown link format detected", async () => { ... })
  test("US2-S4: Deduplication across formats", async () => { ... })

  test("US3-S1: Subdirectories preserved", async () => { ... })
  test("US3-S2: Shared attachment across tiers", async () => { ... })
  test("US3-S3: Multiple file types handled", async () => { ... })
})
```

---

## 9. Performance Contracts

### Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Whitelist building** | <1 second per 1,000 pages | Time from first to last shouldPublish call |
| **Attachment filtering** | <0.5 seconds per 5,000 attachments | Time in Assets emitter loop |
| **Memory overhead** | <10 MB for 10,000 pages | Max heap size increase |
| **Total build overhead** | <2x current build time | End-to-end build time comparison |

**Monitoring**:
```typescript
// In AttachmentWhitelist plugin
const startTime = Date.now()
// ... scan pages ...
const endTime = Date.now()
console.log(`[AttachmentWhitelist] Scanned ${pagesScanned} pages in ${endTime - startTime}ms`)

// In Assets emitter
const startTime = Date.now()
// ... filter attachments ...
const endTime = Date.now()
console.log(`[Assets] Filtered ${totalFiles} files in ${endTime - startTime}ms`)
```

---

## 10. Backward Compatibility Contract

### Compatibility Requirements

1. **Existing Quartz installations** MUST continue to work without modification
2. **Opt-in behavior**: Attachment filtering is ONLY active when `AttachmentWhitelist` plugin is added to config
3. **Default behavior**: If plugin not configured, all attachments are copied (existing behavior)
4. **No breaking changes** to existing plugin interfaces or BuildCtx

**Implementation**:
```typescript
// In Assets emitter
const whitelist = ctx.state?.attachmentWhitelist

if (!whitelist) {
  // No AttachmentWhitelist plugin configured → copy everything
  for (const fp of fps) {
    yield copyFile(argv, fp)
  }
  return
}

// Plugin configured → filter attachments
for (const fp of fps) {
  if (shouldCopyAttachment(fp, whitelist).action === "copy") {
    yield copyFile(argv, fp)
  }
}
```

**Testing**: Run existing Quartz test suite without AttachmentWhitelist plugin to ensure no regressions.

---

## Summary

### Key Contracts

1. **AttachmentWhitelist Plugin**
   - Runs in filter phase after PublishMode
   - Scans published pages for attachment references
   - Stores whitelist in `ctx.state.attachmentWhitelist`
   - Always returns `true` (doesn't filter content)

2. **Assets Emitter Modification**
   - Checks whitelist before copying each attachment
   - Skips orphaned attachments
   - Handles missing files gracefully
   - Logs filtering decisions

3. **extractAttachments Utility**
   - Extracts attachment references from HTML AST
   - Validates and normalizes paths
   - Returns deduplicated set of FilePath

4. **shouldCopyAttachment Helper**
   - Determines if an attachment should be copied
   - Returns structured result for logging
   - Backward compatible (no whitelist = copy all)

5. **BuildCtx Extension**
   - Adds `state.attachmentWhitelist` field
   - Type-safe with TypeScript
   - Shared across plugins

6. **Error Handling**
   - Graceful degradation for content issues
   - Fail fast for infrastructure issues
   - Clear warning messages for users

7. **Performance**
   - <2x build time overhead
   - <10 MB memory overhead
   - Optimized for typical vaults (1,000-10,000 pages)

8. **Testing**
   - Comprehensive unit tests for utilities
   - Integration tests for all user scenarios
   - Manual testing across all publish modes

9. **Backward Compatibility**
   - Opt-in behavior
   - No breaking changes
   - Existing installations unaffected

**Implementation is ready to proceed to /speckit.tasks phase!** ✅
