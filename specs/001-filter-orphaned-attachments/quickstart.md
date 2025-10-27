# Quickstart Guide: Attachment Filtering

**Feature**: 001-filter-orphaned-attachments
**Date**: 2025-10-27
**Phase**: Phase 1 - Design

## Overview

This guide helps developers implement, test, and integrate the attachment filtering feature into Quartz. It provides step-by-step instructions for building the feature from scratch and verifying it works correctly across all publish modes.

---

## Prerequisites

### Required Knowledge
- TypeScript / JavaScript
- Node.js file system operations
- Abstract Syntax Trees (AST) - specifically HAST (HTML AST)
- Quartz plugin architecture (filters, transformers, emitters)

### Development Environment
```bash
# Ensure correct versions
node --version   # Should be >=22
npm --version    # Should be >=10.9.2

# Install dependencies
npm install

# Verify build works
npx quartz build --serve
```

### Documentation to Read First
1. [ARCHITECTURE.md](../../../docs-custom/ARCHITECTURE.md) - Understand Quartz architecture
2. [CLAUDE.md](../../../docs-custom/CLAUDE.md) - Development conventions
3. [research.md](./research.md) - Technical decisions and rationale
4. [data-model.md](./data-model.md) - Data structures
5. [contracts/plugin-api.md](./contracts/plugin-api.md) - API contracts

---

## Phase 1: Create Utility Module

### Step 1.1: Create `quartz/util/attachments.ts`

**File**: `quartz/util/attachments.ts`

```typescript
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
  opts?: { verbose?: boolean }
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
  filePath: FilePath,
  whitelist: { paths: Set<FilePath> } | undefined
): FileFilterResult {
  // Skip markdown files (handled by ContentPage emitter)
  if (filePath.endsWith(".md") || filePath.endsWith(".html")) {
    return { action: "skip", reason: "markdown-file" }
  }

  // If no whitelist, copy everything (backward compatibility)
  if (!whitelist) {
    return { action: "copy", reason: "no-whitelist" }
  }

  // Check whitelist
  const normalized = slugifyFilePath(filePath)
  if (whitelist.paths.has(normalized)) {
    return { action: "copy", reason: "whitelisted" }
  }

  return { action: "skip", reason: "orphaned" }
}
```

**Test it**:
```bash
npx tsc --noEmit  # Should compile without errors
```

---

## Phase 2: Extend BuildCtx Types

### Step 2.1: Add types to `quartz/util/ctx.ts`

**File**: `quartz/util/ctx.ts` (add to existing file)

```typescript
import { FilePath } from "./path"
import { SimpleSlug } from "./path"

/** Whitelist of attachments to include in build */
export interface AttachmentWhitelist {
  paths: Set<FilePath>
  stats: {
    totalReferences: number
    uniqueAttachments: number
    pagesScanned: number
  }
  references?: Map<FilePath, Set<SimpleSlug>>
}

/** Shared state for cross-plugin communication */
export interface BuildState {
  attachmentWhitelist?: AttachmentWhitelist
}

// Extend existing BuildCtx interface
export interface BuildCtx {
  // ... existing fields ...
  state?: BuildState  // ADD THIS
}
```

**Test it**:
```bash
npx tsc --noEmit  # Should compile without errors
```

---

## Phase 3: Create AttachmentWhitelist Filter Plugin

### Step 3.1: Create `quartz/plugins/filters/attachmentWhitelist.ts`

**File**: `quartz/plugins/filters/attachmentWhitelist.ts`

```typescript
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
        if (opts.trackReferences && whitelist.references) {
          if (!whitelist.references.has(path)) {
            whitelist.references.set(path, new Set())
          }
          whitelist.references.get(path)!.add(vfile.data.slug!)
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
          `[AttachmentWhitelist] ${vfile.data.slug}: found ${attachments.size} refs (${newAttachments} new)`
        )
      }

      // Always return true - we don't filter content, just build whitelist
      return true
    },
  }
}
```

### Step 3.2: Export plugin in `quartz/plugins/filters/index.ts`

```typescript
export { AttachmentWhitelist } from "./attachmentWhitelist"
```

**Test it**:
```bash
npx tsc --noEmit  # Should compile without errors
```

---

## Phase 4: Modify Assets Emitter

### Step 4.1: Update `quartz/plugins/emitters/assets.ts`

**Changes**:
1. Import helper functions
2. Check whitelist before copying files
3. Handle missing files gracefully
4. Log filtering decisions

```typescript
import { FilePath, joinSegments, slugifyFilePath } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { shouldCopyAttachment } from "../../util/attachments"  // ADD THIS
import path from "path"
import fs from "fs"
import { glob } from "../../util/glob"
import { Argv } from "../../util/ctx"
import { QuartzConfig } from "../../cfg"

const filesToCopy = async (argv: Argv, cfg: QuartzConfig) => {
  return await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns])
}

const copyFile = async (argv: Argv, fp: FilePath) => {
  let src = joinSegments(argv.directory, fp) as FilePath

  // Resolve symlinks (FR-017)
  const stats = await fs.promises.lstat(src)
  if (stats.isSymbolicLink()) {
    const resolvedPath = await fs.promises.realpath(src)
    console.log(`[Assets] Resolving symlink: ${src} -> ${resolvedPath}`)
    src = resolvedPath as FilePath
  }

  const name = slugifyFilePath(fp)
  const dest = joinSegments(argv.output, name) as FilePath

  // Ensure dir exists
  const dir = path.dirname(dest) as FilePath
  await fs.promises.mkdir(dir, { recursive: true })

  await fs.promises.copyFile(src, dest)
  return dest
}

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
      let missing = 0

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
        } catch (err: any) {
          if (err.code === "ENOENT") {
            console.warn(`[Assets] Referenced attachment not found: ${fp}`)
            missing++
          } else {
            console.error(`[Assets] Failed to copy ${fp}:`, err)
            throw err
          }
        }
      }

      // Log summary
      if (whitelist) {
        console.log(
          `[Assets] Copied ${copied} attachments, filtered ${filtered} orphaned, ${missing} missing`
        )
      } else {
        console.log(`[Assets] Copied ${copied} files (no attachment filtering)`)
      }
    },

    async *partialEmit(ctx, _content, _resources, changeEvents) {
      const whitelist = ctx.state?.attachmentWhitelist

      for (const changeEvent of changeEvents) {
        const ext = path.extname(changeEvent.path)
        if (ext === ".md") continue

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
    },
  }
}
```

**Test it**:
```bash
npx tsc --noEmit  # Should compile without errors
```

---

## Phase 5: Update Configuration

### Step 5.1: Add plugin to `quartz.config.ts`

```typescript
import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    // ... existing config ...
  },
  plugins: {
    transformers: [
      // ... existing transformers ...
    ],
    filters: [
      Plugin.RemoveDrafts(),
      Plugin.IndexSwapper(),
      Plugin.PublishMode({
        mode: process.env.QUARTZ_PUBLISH_MODE as "trusted" | "public" | undefined,
      }),
      Plugin.AttachmentWhitelist({ verbose: false, trackReferences: false }),  // ADD THIS
    ],
    emitters: [
      // ... existing emitters ...
      Plugin.Assets(),  // This now uses the whitelist
      // ... rest of emitters ...
    ],
  },
}

export default config
```

**Important**: `AttachmentWhitelist` MUST come AFTER `PublishMode` to only scan published pages.

---

## Phase 6: Testing

### Step 6.1: Create Test Fixtures

**Directory structure**:
```
content/
├── test-public.md       # publish: "[[Public]]"
├── test-trusted.md      # publish: "[[Trusted]]"
├── test-private.md      # (no publish field)
└── attachments/
    ├── public.png       # Referenced by test-public.md
    ├── trusted.pdf      # Referenced by test-trusted.md
    ├── private.jpg      # Referenced by test-private.md
    └── orphan.mp4       # Not referenced by any page
```

**test-public.md**:
```markdown
---
title: Public Test Page
publish: "[[Public]]"
---

This is a public page.

![Public Image](attachments/public.png)
```

**test-trusted.md**:
```markdown
---
title: Trusted Test Page
publish: "[[Trusted]]"
---

This is a trusted page.

[Trusted PDF](attachments/trusted.pdf)
```

**test-private.md**:
```markdown
---
title: Private Test Page
---

This is a private page (Full tier only).

![Private Image](attachments/private.jpg)
```

### Step 6.2: Manual Testing Commands

#### Test 1: Full Tier (All Content)
```bash
npx quartz build --publish-mode full

# Verify output
ls public/attachments/
# Expected: public.png, trusted.pdf, private.jpg (all 3)
# NOT expected: orphan.mp4 (not referenced)
```

#### Test 2: Trusted Tier
```bash
npx quartz build --publish-mode trusted

# Verify output
ls public/attachments/
# Expected: public.png, trusted.pdf (2 files)
# NOT expected: private.jpg, orphan.mp4
```

#### Test 3: Public Tier
```bash
npx quartz build --publish-mode public

# Verify output
ls public/attachments/
# Expected: public.png (1 file)
# NOT expected: trusted.pdf, private.jpg, orphan.mp4
```

#### Test 4: Verify Logs
```bash
npx quartz build --publish-mode public 2>&1 | grep Assets

# Expected output:
# [Assets] Skipping attachments/trusted.pdf: orphaned
# [Assets] Skipping attachments/private.jpg: orphaned
# [Assets] Skipping attachments/orphan.mp4: orphaned
# [Assets] Copied 1 attachments, filtered 3 orphaned, 0 missing
```

#### Test 5: Watch Mode
```bash
npx quartz build --publish-mode public --serve

# 1. Start server
# 2. Modify test-public.md to add another image reference
# 3. Check logs for whitelist rebuild
# 4. Verify new image is copied
```

### Step 6.3: Unit Tests (Optional but Recommended)

Create `tests/attachment-filtering/attachment-filter.test.ts`:

```typescript
import { test, describe } from "node:test"
import assert from "node:assert"
import { extractAttachments, shouldCopyAttachment, isAbsolutePath } from "../../quartz/util/attachments"
import { Root as HtmlRoot } from "hast"
import { VFile } from "vfile"

describe("isAbsolutePath", () => {
  test("detects Unix absolute paths", () => {
    assert.strictEqual(isAbsolutePath("/var/files/doc.pdf"), true)
  })

  test("detects Windows absolute paths", () => {
    assert.strictEqual(isAbsolutePath("C:\\Documents\\file.txt"), true)
  })

  test("relative paths are not absolute", () => {
    assert.strictEqual(isAbsolutePath("./images/photo.jpg"), false)
    assert.strictEqual(isAbsolutePath("../docs/file.pdf"), false)
  })
})

describe("shouldCopyAttachment", () => {
  test("copies whitelisted attachments", () => {
    const whitelist = { paths: new Set(["images/photo.jpg"]) }
    const result = shouldCopyAttachment("images/photo.jpg" as any, whitelist)
    assert.strictEqual(result.action, "copy")
    assert.strictEqual(result.reason, "whitelisted")
  })

  test("skips orphaned attachments", () => {
    const whitelist = { paths: new Set(["images/photo.jpg"]) }
    const result = shouldCopyAttachment("images/orphan.png" as any, whitelist)
    assert.strictEqual(result.action, "skip")
    assert.strictEqual(result.reason, "orphaned")
  })

  test("copies all when no whitelist", () => {
    const result = shouldCopyAttachment("images/anything.jpg" as any, undefined)
    assert.strictEqual(result.action, "copy")
    assert.strictEqual(result.reason, "no-whitelist")
  })
})

// Add more tests for extractAttachments...
```

**Run tests**:
```bash
npm test
```

---

## Phase 7: Verification Checklist

### Functional Verification

- [ ] Public attachments appear in ALL tiers (Full, Trusted, Shachu, Public)
- [ ] Trusted attachments appear in Full + Trusted tiers only
- [ ] Shachu attachments appear in Full + Shachu tiers only
- [ ] Private attachments appear in Full tier only
- [ ] Orphaned attachments (not referenced) do NOT appear in any tier
- [ ] Shared attachments (referenced by multiple pages) appear when at least one page is published
- [ ] Attachments in subdirectories preserve directory structure
- [ ] Multiple link formats (wikilinks, markdown, HTML) all detected

### Security Verification

- [ ] Private attachments inaccessible via direct URL on Public tier
  ```bash
  # Build Public tier
  npx quartz build --publish-mode public

  # Try to access private attachment
  curl http://localhost:8080/attachments/private.jpg
  # Expected: 404 Not Found
  ```

- [ ] No information disclosure through broken links
- [ ] Logs don't expose private content paths in public repos

### Performance Verification

- [ ] Build time increase <2x for typical vaults
  ```bash
  # Measure build time without feature
  time npx quartz build --publish-mode full

  # Measure build time with feature
  # (Should be <2x the above)
  time npx quartz build --publish-mode full
  ```

- [ ] Memory usage reasonable (<10 MB overhead)
- [ ] Large vaults (10k+ pages) build successfully

### Edge Cases Verification

- [ ] URL-encoded filenames handled (`photo%20one.jpg`)
- [ ] Symlinks resolved and copied
- [ ] Missing attachments logged as warnings, build continues
- [ ] Absolute path references logged as warnings, skipped
- [ ] External URLs ignored (not treated as attachments)
- [ ] Markdown files not treated as attachments

---

## Phase 8: Documentation

### Step 8.1: Update ARCHITECTURE.md

Add section after "Multi-Tier Publishing" section:

```markdown
## Attachment Filtering

### Overview
Attachment filtering prevents private media files (images, PDFs, videos) from being accessible on lower-trust publishing tiers. The system scans all published pages to build a whitelist of referenced attachments and filters the asset copying process accordingly.

### Implementation
- **Plugin**: `AttachmentWhitelist` (filter plugin)
- **Location**: `quartz/plugins/filters/attachmentWhitelist.ts`
- **Execution**: Runs AFTER `PublishMode` in filter phase
- **Modified Emitter**: `Assets` emitter checks whitelist before copying files

### How It Works
1. **Whitelist Building** (Filter Phase):
   - `AttachmentWhitelist` plugin scans each published page's HTML AST
   - Extracts attachment references from `<img>`, `<video>`, `<audio>`, `<iframe>`, `<a>` elements
   - Normalizes and deduplicates paths
   - Stores whitelist in `ctx.state.attachmentWhitelist`

2. **Attachment Filtering** (Emit Phase):
   - `Assets` emitter receives the filtered content list
   - For each non-markdown file, checks if it's in the whitelist
   - Copies whitelisted attachments, skips orphaned ones
   - Logs filtering decisions for audit

3. **Hierarchical Inheritance**:
   - Public tier: Only attachments from Public pages
   - Trusted tier: Attachments from Public + Trusted pages
   - Shachu tier: Attachments from Public + Shachu pages
   - Full tier: All attachments from published pages

### Edge Cases
- **Symlinks**: Resolved to actual file before copying
- **Missing files**: Logged as warnings, build continues
- **Absolute paths**: Logged as warnings, skipped
- **External URLs**: Ignored (not attachments)

### Performance
- Whitelist building: O(pages × attachments_per_page)
- Attachment filtering: O(total_attachments)
- Typical overhead: ~1-2 seconds for 1,000 pages

### Files Modified
- `quartz/util/attachments.ts` - New utility module
- `quartz/plugins/filters/attachmentWhitelist.ts` - New filter plugin
- `quartz/plugins/emitters/assets.ts` - Modified to check whitelist
- `quartz/util/ctx.ts` - Extended BuildCtx with state field
- `quartz.config.ts` - Added AttachmentWhitelist to filter chain
```

### Step 8.2: Update CLAUDE.md

Update the "Custom Features" table:

```markdown
| Feature | Primary File(s) | Type |
|---------|----------------|------|
| Multi-tier publishing | `quartz/plugins/filters/publishMode.ts` | Plugin (custom) |
| Index swapping | `quartz/plugins/filters/indexSwapper.ts` | Plugin (custom) |
| **Attachment filtering** | **`quartz/plugins/filters/attachmentWhitelist.ts`** | **Plugin (custom)** |
| Frontmatter display | `quartz/components/FrontmatterProperties.tsx` | Component (custom) |
```

### Step 8.3: Update FUTURE_TASKS.md

Move the task from "High Priority" to "Completed Tasks":

```markdown
## Completed Tasks

### HIGH Priority

- [x] **Orphaned Attachments Not Removed When Source Pages Are Filtered** (Security)
  - Completed: 2025-10-27
  - Implementation: AttachmentWhitelist filter plugin + Assets emitter modification
  - Spec: specs/001-filter-orphaned-attachments/
```

---

## Troubleshooting

### Issue: Whitelist not being populated

**Symptoms**: All attachments filtered, logs show 0 attachments whitelisted

**Diagnosis**:
```bash
# Enable verbose logging
# In quartz.config.ts:
Plugin.AttachmentWhitelist({ verbose: true, trackReferences: true })

# Rebuild and check logs
npx quartz build --publish-mode full 2>&1 | grep AttachmentWhitelist
```

**Common Causes**:
1. Plugin in wrong order (before PublishMode)
2. No pages being published (all filtered)
3. extractAttachments not finding elements

**Solution**: Check plugin order, verify pages are published, enable verbose mode

---

### Issue: Attachments still copied despite filtering

**Symptoms**: Private attachments appearing in Public tier

**Diagnosis**:
```bash
# Check if whitelist exists
# Add debug logging in Assets emitter:
console.log("Whitelist:", ctx.state?.attachmentWhitelist)

# Check if attachment is in whitelist
console.log("Checking:", fp, "->", shouldCopyAttachment(fp, whitelist))
```

**Common Causes**:
1. Whitelist undefined (plugin not configured)
2. Path normalization mismatch
3. Attachment referenced by a public page

**Solution**: Verify plugin is in config, check path normalization, verify page publish field

---

### Issue: Build failing with "Cannot read property 'paths' of undefined"

**Symptoms**: Build crashes when Assets emitter runs

**Diagnosis**:
```bash
# Check if ctx.state initialized
console.log("ctx.state:", ctx.state)
```

**Common Causes**:
1. BuildCtx.state not initialized
2. AttachmentWhitelist plugin not running
3. Type mismatch

**Solution**: Ensure plugin runs, initialize ctx.state in build.ts

---

### Issue: Performance degradation (build time >2x)

**Symptoms**: Builds taking significantly longer

**Diagnosis**:
```bash
# Add timing logs
const startTime = Date.now()
// ... scan pages ...
console.log(`Scanning took ${Date.now() - startTime}ms`)
```

**Common Causes**:
1. Very large vault (>10k pages)
2. Inefficient AST traversal
3. Too many attachments per page

**Solution**: Profile with `npm run profile`, optimize hot paths, consider caching

---

## Next Steps

After completing this quickstart:

1. **Generate tasks.md**: Run `/speckit.tasks` to generate implementation tasks
2. **Implement feature**: Follow tasks.md step-by-step
3. **Test thoroughly**: Verify all acceptance scenarios pass
4. **Update documentation**: Complete ARCHITECTURE.md updates
5. **Create PR**: Submit for review with all tests passing

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `quartz/util/attachments.ts` | Utility functions (extract, validate, filter) |
| `quartz/plugins/filters/attachmentWhitelist.ts` | Filter plugin (builds whitelist) |
| `quartz/plugins/emitters/assets.ts` | Emitter (filters attachments) |
| `quartz/util/ctx.ts` | Type definitions (BuildCtx extension) |
| `quartz.config.ts` | Configuration (add plugin) |

### Key Commands

```bash
# Build with specific mode
npx quartz build --publish-mode [full|trusted|shachu|public]

# Build and serve locally
npx quartz build --publish-mode public --serve

# Run tests
npm test

# Type check
npx tsc --noEmit

# Format code
npm run format
```

### Key Concepts

- **Whitelist**: Set of attachment paths referenced by published pages
- **Orphaned attachment**: File exists but not referenced by any published page
- **Filter phase**: Where whitelist is built (scans published pages)
- **Emit phase**: Where filtering happens (Assets emitter)
- **BuildCtx.state**: Shared state for cross-plugin communication

---

**Ready to implement!** Follow this guide step-by-step, and refer to [contracts/plugin-api.md](./contracts/plugin-api.md) for detailed API specifications.
