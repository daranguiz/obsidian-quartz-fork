# Research: Filter Orphaned Attachments

**Feature**: 001-filter-orphaned-attachments
**Date**: 2025-10-27
**Phase**: Phase 0 - Research & Technical Discovery

## Overview

This document captures research findings for implementing attachment filtering in Quartz. The goal is to prevent private attachments from being accessible on lower-trust publishing tiers when their source pages are filtered out.

## Key Technical Questions Resolved

### 1. How are attachment references represented in Quartz?

**Finding**: Attachments are processed differently in markdown vs. HTML AST stages:

#### Markdown Stage (MDAST)
The ObsidianFlavoredMarkdown transformer ([ofm.ts:151-250](../../quartz/plugins/transformers/ofm.ts#L151-L250)) processes wikilinks:

**Wikilink Regex** (line 119-121):
```regex
!?\[\[([^\[\]\|\#\\]+)?(#+[^\[\]\|\#\\]+)?(\\?\|[^\[\]\#]*)?\]\]
```

**Supported Formats**:
- `![[image.png]]` → Image embed (line 230-248)
- `![[video.mp4]]` → Video embed (line 249+)
- `![[document.pdf]]` → File embed
- `[[document.pdf|Download]]` → Link with alias

**File Extensions Detected**:
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.svg`, `.webp` (line 233)
- Videos: `.mp4`, `.webm`, `.ogv`, `.mov`, `.mkv` (line 249)
- Audio: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.3gp`, `.flac`
- Documents: All other extensions (PDF, DOCX, etc.)

**Processing**: Wikilinks are converted to markdown AST nodes:
```typescript
{
  type: "image",
  url: slugifyFilePath(fp),
  data: { hProperties: { width, height, alt } }
}
```

#### HTML Stage (HAST)
The CrawlLinks transformer ([links.ts:51-157](../../quartz/plugins/transformers/links.ts#L51-L157)) processes standard markdown and HTML:

**Elements Processed** (line 140):
- `<img src="...">` → Images
- `<video src="...">` → Videos
- `<audio src="...">` → Audio
- `<iframe src="...">` → Embeds
- `<a href="...">` → Links (if pointing to non-markdown files)

**Path Handling** (line 148-155):
- Absolute URLs (http://, https://) → Skipped (line 148)
- Relative paths (`./images/photo.jpg`, `../files/doc.pdf`) → Transformed and tracked
- Uses `transformLink()` to resolve paths relative to current page

**Decision**: Extract attachment references from the **HTML AST (HAST)** during the filter phase. By this stage:
1. Wikilinks have been converted to standard HTML elements
2. All paths have been resolved and normalized
3. We can use a single scanning logic for all attachment types

---

### 2. Where in the build pipeline should attachment filtering happen?

**Finding**: The Quartz build follows a strict **PARSE → FILTER → EMIT** pipeline ([build.ts:73-87](../../quartz/build.ts#L73-L87)):

#### Build Process Flow

```
1. PARSE (line 84: parseMarkdown())
   ├─ Read all markdown files from content/
   ├─ Apply Transformers in sequence
   │  ├─ Text transforms (comments, wikilinks)
   │  ├─ Markdown plugins (MDAST manipulation)
   │  └─ HTML plugins (HAST manipulation)
   └─ Output: ProcessedContent[] (all files)

2. FILTER (line 85: filterContent())
   ├─ Run filter plugins sequentially
   │  ├─ RemoveDrafts (filters draft: true)
   │  ├─ IndexSwapper (swaps index files)
   │  └─ PublishMode (filters by tier)
   └─ Output: ProcessedContent[] (published files only)

3. EMIT (line 87: emitContent())
   ├─ Run emitters in PARALLEL
   │  ├─ ContentPage (writes HTML pages)
   │  ├─ Assets (copies attachments)
   │  └─ Other emitters...
   └─ Output: Built site in public/
```

#### Assets Emitter Current Behavior

The Assets emitter ([assets.ts:28-52](../../quartz/plugins/emitters/assets.ts#L28-L52)) currently:

**Full build** (line 31-36):
```typescript
async *emit({ argv, cfg }) {
  const fps = await filesToCopy(argv, cfg)  // Globs all non-MD files
  for (const fp of fps) {
    yield copyFile(argv, fp)  // Copies ALL attachments
  }
}
```

**Problem**: The `filesToCopy()` function (line 9-12) globs directly from disk:
```typescript
return await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns])
```

It has **no knowledge** of which pages were filtered out by PublishMode. It copies ALL attachments regardless of whether their source pages are published.

**Watch mode** (line 37-50):
```typescript
async *partialEmit(ctx, _content, _resources, changeEvents) {
  for (const changeEvent of changeEvents) {
    if (ext === ".md") continue
    if (changeEvent.type === "add" || "change") {
      yield copyFile(ctx.argv, changeEvent.path)
    }
  }
}
```

Same problem: No filtering based on published pages.

#### Decision: Hybrid Approach (Filter + Emitter Modification)

**Rationale**: Neither pure filter nor pure emitter approach works alone:

**Filter-only approach fails** because:
- Filter plugins receive one file at a time (can't see all published pages together)
- Can't easily communicate whitelist to Assets emitter across parallel execution

**Emitter-only approach fails** because:
- Emitters run in parallel (Assets doesn't know when others finish)
- ProcessedContent passed to emitters is the full filtered list, but we need to scan it before Assets runs

**Solution**: Use BuildCtx as a shared state container:

1. Create a **WhitelistBuilder** filter plugin that:
   - Runs AFTER PublishMode (sees only published pages)
   - Scans each page for attachment references
   - Accumulates references in a Set stored in `ctx.state.attachmentWhitelist`
   - Returns `true` (passes all content through)

2. Modify **Assets emitter** to:
   - Check if `ctx.state.attachmentWhitelist` exists
   - Filter file list before copying: only copy whitelisted attachments
   - Handle watch mode by clearing/rebuilding whitelist on changes

This approach:
- ✅ Has access to filtered content (runs in filter phase)
- ✅ Can scan all pages collectively (accumulates in shared state)
- ✅ Works with parallel emitters (state is set before emit phase)
- ✅ Minimal changes to existing code
- ✅ Testable (can verify whitelist contents)

---

### 3. How should attachment paths be normalized and matched?

**Finding**: Quartz uses `slugifyFilePath()` ([path.ts:142-154](../../quartz/util/path.ts#L142-L154)) to normalize paths:

**Normalization Logic**:
```typescript
export function slugifyFilePath(fp: FilePath, excludeExt?: boolean): FilePath {
  fp = _stripSlashes(_trimSuffix(fp, "index"), true)
  let ext = path.extname(fp)
  const withoutExt = fp.slice(0, -ext.length)
  if (excludeExt) {
    return withoutExt as FilePath
  }
  return (withoutExt + ext) as FilePath
}
```

**Key behaviors**:
- Strips leading/trailing slashes
- Handles index files (removes "index" suffix)
- Preserves file extensions
- Returns normalized path string

**Examples**:
- `./images/photo.jpg` → `images/photo.jpg`
- `../docs/file.pdf` → `docs/file.pdf`
- `/attachments/video.mp4` → `attachments/video.mp4`

**Decision**: Use `slugifyFilePath()` for all attachment path normalization:
- When extracting references from HTML AST (`node.properties.src`)
- When checking if a file should be copied (in Assets emitter)
- Ensures consistent matching between whitelisted paths and actual file paths

**Rationale**: This function is already used throughout Quartz for path handling, so it's battle-tested and handles edge cases (spaces, special characters, URL encoding, etc.)

---

### 4. What attachment file types need to be supported?

**Finding**: Based on spec requirements (FR-009) and Quartz's existing handling:

#### Must Support (Common Types)

| Category | Extensions | Detection Method |
|----------|-----------|------------------|
| **Images** | `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.svg`, `.webp` | `<img>` elements in HAST |
| **Videos** | `.mp4`, `.webm`, `.ogg`, `.ogv`, `.avi`, `.mov`, `.flv`, `.wmv`, `.mkv`, `.mpg`, `.mpeg`, `.3gp`, `.m4v` | `<video>` elements in HAST |
| **Audio** | `.mp3`, `.wav`, `.m4a`, `.ogg`, `.3gp`, `.flac` | `<audio>` elements in HAST |
| **Documents** | `.pdf`, `.docx`, `.txt`, `.doc`, `.xls`, `.xlsx`, `.ppt`, `.pptx` | `<a>` elements linking to non-markdown files |
| **Archives** | `.zip`, `.tar`, `.gz`, `.rar`, `.7z` | `<a>` elements linking to non-markdown files |

#### Detection Strategy

**Don't use file extension matching**. Instead, detect attachment type by:
1. Element type in HAST (`img`, `video`, `audio`, `a`)
2. Whether the `src`/`href` points to a non-markdown file
3. Whether it's an internal link (not absolute URL)

**Rationale**:
- Extension-based detection is fragile (new types, unusual extensions)
- Quartz already categorizes files by how they're embedded
- Future-proof: supports any file type users embed

**Decision**: Whitelist based on **element + internal link**, not extension list.

```typescript
// Pseudocode
function isAttachmentReference(node: Element): boolean {
  const isMediaElement = ["img", "video", "audio", "iframe"].includes(node.tagName)
  const isLinkToFile = node.tagName === "a" && !node.properties.href.endsWith(".html")
  const isInternal = !isAbsoluteUrl(node.properties.src || node.properties.href)

  return (isMediaElement || isLinkToFile) && isInternal
}
```

---

### 5. How to handle symlinks?

**Finding**: Node.js `fs.copyFile()` does NOT follow symlinks by default. From Node.js docs:
- `fs.copyFile(src, dest)` copies the symlink itself (not the target)
- `fs.copyFile(src, dest, fs.constants.COPYFILE_FICLONE_FORCE)` still doesn't follow symlinks

**Current behavior**: Quartz Assets emitter (line 24):
```typescript
await fs.promises.copyFile(src, dest)
```

This copies symlinks as-is, which may break in the output directory if the target isn't also copied.

**Decision**: Resolve symlinks before copying by:
1. Use `fs.promises.realpath(src)` to get the actual file path
2. Copy the resolved file instead of the symlink
3. Log a message indicating symlink resolution

**Implementation**:
```typescript
async function copyFile(argv: Argv, fp: FilePath) {
  let src = joinSegments(argv.directory, fp) as FilePath

  // Resolve symlinks (FR-017)
  const stats = await fs.promises.lstat(src)
  if (stats.isSymbolicLink()) {
    const resolvedPath = await fs.promises.realpath(src)
    console.log(`Resolving symlink: ${src} -> ${resolvedPath}`)
    src = resolvedPath
  }

  // ... rest of copy logic
}
```

**Rationale**: Matches spec requirement FR-017 and prevents broken links in output.

---

### 6. How to handle missing attachments?

**Finding**: Quartz's current `copyFile()` function (assets.ts:14-26) will throw an error if the source file doesn't exist:
```typescript
await fs.promises.copyFile(src, dest)  // Throws ENOENT if src missing
```

This would break the entire build if a page references a non-existent file.

**Decision**: Wrap copy in try-catch and log warnings for missing files (FR-016):

```typescript
try {
  await fs.promises.copyFile(src, dest)
  return dest
} catch (err) {
  if (err.code === 'ENOENT') {
    console.warn(`Warning: Referenced attachment not found: ${fp}`)
    return null  // Continue build
  }
  throw err  // Re-throw other errors
}
```

**Rationale**:
- Broken references shouldn't fail the entire build
- Warnings allow users to fix issues without blocking deployment
- Matches Git's approach (missing files = warning, not error)

---

### 7. How to handle absolute path references?

**Finding**: The CrawlLinks transformer (links.ts:102) explicitly skips absolute URLs:
```typescript
const isInternal = !(isAbsoluteUrl(dest) || dest.startsWith("#"))
if (isInternal) {
  // Only process internal links
}
```

Current behavior: Absolute paths like `/var/files/doc.pdf` or `C:\Documents\file.txt` are treated as internal links (because they don't match `http://` pattern) but won't resolve correctly in the built site.

**Decision**: Skip absolute path references and log warnings (FR-018):

```typescript
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)  // Unix or Windows
}

// In attachment scanner:
if (isAbsolutePath(src)) {
  console.warn(`Warning: Absolute path reference not supported: ${src}`)
  continue  // Skip this reference
}
```

**Rationale**:
- Absolute paths aren't portable (break across environments)
- Can't reliably copy files outside content directory
- Better to warn and skip than fail silently

---

### 8. How to handle URL-encoded filenames?

**Finding**: The CrawlLinks transformer (links.ts:119) already handles URL encoding:
```typescript
const full = decodeURIComponent(stripSlashes(destCanonical, true))
```

This decodes `%20` → space, `%2B` → `+`, etc.

**Decision**: Use `decodeURIComponent()` when extracting attachment paths from HTML AST:

```typescript
const rawPath = node.properties.src || node.properties.href
const decodedPath = decodeURIComponent(rawPath)
const normalizedPath = slugifyFilePath(decodedPath as FilePath)
```

**Rationale**:
- Matches existing Quartz behavior
- Handles user-created links with encoded characters
- Robust to browser encoding differences

---

## Architecture Decisions

### Decision 1: Plugin Type and Placement

**Chosen**: Hybrid approach with custom filter plugin + Assets emitter modification

**Architecture**:
```
Filter Phase:
  RemoveDrafts → IndexSwapper → PublishMode → [NEW] AttachmentWhitelist

Emit Phase:
  Assets (modified to check whitelist) || ContentPage || Other emitters...
```

**AttachmentWhitelist Plugin**:
- Type: `QuartzFilterPlugin`
- Function: Scans published pages, builds whitelist, stores in `ctx.state`
- Returns: Always `true` (doesn't filter content, just accumulates state)

**Assets Emitter Modification**:
- Check `ctx.state.attachmentWhitelist` before copying each file
- Skip files not in whitelist (orphaned attachments)
- Log filtering decisions for audit purposes

**Alternatives Considered**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Pure filter plugin | Clean separation, follows existing pattern | Can't communicate to emitters easily | ❌ Rejected |
| Pure emitter plugin | Has access to all content | Timing issues (parallel execution) | ❌ Rejected |
| Modify Assets only | Minimal code changes | Scanning logic mixed with copying logic | ❌ Rejected |
| **Hybrid (chosen)** | ✅ Sees filtered content<br>✅ Shared state via ctx<br>✅ Clean separation | Requires small ctx modification | ✅ **Chosen** |

---

### Decision 2: Attachment Reference Extraction

**Chosen**: Scan HTML AST (HAST) for `img`, `video`, `audio`, `iframe`, and `a` elements

**Scanning Logic**:
```typescript
function extractAttachments(tree: HtmlRoot, vfile: VFile): Set<FilePath> {
  const attachments = new Set<FilePath>()

  visit(tree, "element", (node: Element) => {
    const src = node.properties?.src || node.properties?.href
    if (!src || typeof src !== "string") return

    // Skip external URLs
    if (isAbsoluteUrl(src)) return

    // Skip absolute paths
    if (isAbsolutePath(src)) {
      console.warn(`Absolute path not supported: ${src}`)
      return
    }

    // Skip markdown files (handled by content pages)
    if (src.endsWith(".md") || src.endsWith(".html")) return

    // Decode and normalize
    const decoded = decodeURIComponent(src)
    const normalized = slugifyFilePath(decoded as FilePath)
    attachments.add(normalized)
  })

  return attachments
}
```

**Why HAST, not MDAST?**
- By HTML stage, wikilinks are converted to standard elements
- All paths are resolved relative to current page
- Single scanning logic handles all formats (wikilinks, markdown, HTML)

**Alternatives Considered**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Regex on raw markdown | Simple, fast | Fragile, misses edge cases | ❌ Rejected |
| Scan MDAST | Earlier in pipeline | Different handling for wikilinks vs. markdown | ❌ Rejected |
| **Scan HAST (chosen)** | ✅ Unified format<br>✅ Resolved paths<br>✅ Leverages existing code | Slightly later in pipeline | ✅ **Chosen** |
| Reuse vfile.data.links | Already tracked | Only tracks page links, not attachments | ❌ Rejected |

---

### Decision 3: Path Normalization Strategy

**Chosen**: Use existing `slugifyFilePath()` function for all paths

**Normalization Pipeline**:
```
Raw Reference → decodeURIComponent() → slugifyFilePath() → Normalized Path
```

**Examples**:
```typescript
// From HTML AST
"./images/photo%20one.jpg"  → "images/photo one.jpg"
"../docs/file.pdf"          → "docs/file.pdf"
"/attachments/video.mp4"    → "attachments/video.mp4" (but warn!)

// From file glob (Assets emitter)
"images/photo one.jpg"      → "images/photo one.jpg"
"docs/file.pdf"             → "docs/file.pdf"
```

**Matching Logic**:
```typescript
const normalizedRef = slugifyFilePath(decodeURIComponent(ref) as FilePath)
const normalizedFile = slugifyFilePath(filePath)

if (normalizedRef === normalizedFile) {
  // ✅ Match: copy this file
}
```

**Why this approach?**
- `slugifyFilePath()` is already used throughout Quartz
- Handles edge cases: spaces, special chars, relative paths
- Consistent with existing path handling

**Alternatives Considered**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| path.resolve() | Node.js standard | Different behavior than Quartz | ❌ Rejected |
| path.normalize() | Simple | Doesn't handle URL encoding | ❌ Rejected |
| **slugifyFilePath() (chosen)** | ✅ Existing function<br>✅ Battle-tested<br>✅ Handles all cases | None | ✅ **Chosen** |
| Custom normalization | Full control | Reinventing wheel, bugs | ❌ Rejected |

---

### Decision 4: BuildCtx State Extension

**Chosen**: Extend `BuildCtx` type to include `state.attachmentWhitelist`

**Type Definition**:
```typescript
// In quartz/util/ctx.ts or new file
export interface AttachmentWhitelistState {
  attachmentWhitelist?: Set<FilePath>
}

// Extend BuildCtx
export interface BuildCtx {
  // ... existing fields
  state: {
    attachmentWhitelist?: Set<FilePath>
  }
}
```

**Usage**:
```typescript
// In AttachmentWhitelist filter plugin
export const AttachmentWhitelist: QuartzFilterPlugin = () => {
  return {
    name: "AttachmentWhitelist",
    shouldPublish(ctx, [tree, vfile]) {
      if (!ctx.state.attachmentWhitelist) {
        ctx.state.attachmentWhitelist = new Set()
      }

      const attachments = extractAttachments(tree, vfile)
      attachments.forEach(fp => ctx.state.attachmentWhitelist!.add(fp))

      return true  // Don't filter content, just build whitelist
    }
  }
}

// In Assets emitter
export const Assets: QuartzEmitterPlugin = () => {
  return {
    name: "Assets",
    async *emit({ argv, cfg, state }) {
      const fps = await filesToCopy(argv, cfg)
      const whitelist = state.attachmentWhitelist

      for (const fp of fps) {
        if (whitelist && !whitelist.has(slugifyFilePath(fp))) {
          console.log(`Filtering orphaned attachment: ${fp}`)
          continue
        }
        yield copyFile(argv, fp)
      }
    }
  }
}
```

**Why this approach?**
- `ctx` is already threaded through all plugins
- Emitters already receive `ctx` (via emit signature)
- Allows filter → emitter communication
- Type-safe with TypeScript

**Alternatives Considered**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Global variable | Simple | Not thread-safe, hard to test | ❌ Rejected |
| Separate state manager | Clean encapsulation | Adds complexity, new dependency | ❌ Rejected |
| **Extend ctx.state (chosen)** | ✅ Existing infrastructure<br>✅ Type-safe<br>✅ Thread-safe | Requires type modification | ✅ **Chosen** |
| File on disk | Persistent | Race conditions, IO overhead | ❌ Rejected |

---

## Testing Strategy

### Unit Tests

**File**: `tests/attachment-filtering/attachment-filter.test.ts`

Test cases:
1. **extractAttachments()**:
   - Detects `img`, `video`, `audio`, `iframe` elements
   - Extracts `src` and `href` attributes correctly
   - Handles URL-encoded paths (`%20` → space)
   - Skips absolute URLs (`http://...`)
   - Warns on absolute paths (`/var/...`)

2. **Path normalization**:
   - `./images/photo.jpg` → `images/photo.jpg`
   - `../docs/file.pdf` → `docs/file.pdf`
   - Handles spaces and special characters

3. **Whitelist building**:
   - Accumulates attachments across multiple pages
   - Deduplicates shared attachments
   - Handles missing files gracefully

### Integration Tests

**File**: `tests/attachment-filtering/integration.test.ts`

Test scenarios (across all 4 publish modes):
1. **Private attachment filtered** (User Story 1, Scenario 1):
   - Page with `publish: "[[Trusted]]"` references `private.png`
   - Build with `--publish-mode public`
   - Verify `private.png` NOT in output

2. **Shared attachment kept** (User Story 1, Scenario 2):
   - Two pages reference `shared.png`
   - One page filtered, one published
   - Verify `shared.png` IS in output

3. **Public attachment in all tiers** (User Story 1, Scenario 3):
   - Page with `publish: "[[Public]]"` references `public.png`
   - Build with all modes (Full, Trusted, Shachu, Public)
   - Verify `public.png` in ALL outputs

4. **Orphaned attachment removed** (User Story 1, Scenario 4):
   - Attachment `orphan.pdf` exists but no page references it
   - Build with any mode
   - Verify `orphan.pdf` NOT in output

5. **Multiple link formats** (User Story 2):
   - Test `![[file.pdf]]`, `![](image.jpg)`, `[link](doc.pdf)`
   - Verify all formats detected and filtered correctly

6. **Complex scenarios** (User Story 3):
   - Subdirectories (`images/`, `files/`)
   - Shared attachments across tiers
   - Various file types (PNG, PDF, MP4)

### Manual Testing

**Commands**:
```bash
# Test each publish mode
npx quartz build --publish-mode full
npx quartz build --publish-mode trusted
npx quartz build --publish-mode shachu
npx quartz build --publish-mode public

# Serve locally and verify
npx quartz build --publish-mode public --serve
# Visit http://localhost:8080 and check:
# 1. Private images return 404
# 2. Public images load correctly
# 3. No broken links
```

**Verification**:
```bash
# Check output directory
ls -R public/

# Verify specific attachments
ls public/images/private.png  # Should NOT exist (404)
ls public/images/public.png   # Should exist

# Check build logs
cat build.log | grep "Filtering orphaned"
```

---

## Performance Considerations

### Time Complexity
- **Whitelist building**: O(n × m) where n = published pages, m = attachments per page
  - Typical: 1000 pages × 5 attachments = 5000 operations
  - Each operation: HAST traversal (fast), Set.add (O(1))
  - Expected overhead: <1 second for typical vaults

- **Attachment filtering**: O(k) where k = total attachments in content/
  - Typical: 5000 attachments × Set lookup (O(1)) = 5000 operations
  - Expected overhead: <0.5 seconds

- **Total overhead**: ~1-2 seconds for typical vaults (1000 pages, 5000 attachments)
- Well within success criteria SC-004 (build time <2x current)

### Space Complexity
- **Whitelist storage**: O(k) where k = referenced attachments
  - Each path: ~50 bytes average
  - 5000 attachments × 50 bytes = 250 KB
  - Negligible memory impact

### Optimization Opportunities
If performance becomes an issue (>10k pages):
1. **Lazy evaluation**: Only scan pages that reference attachments (check for `<img>`, `<video>` first)
2. **Parallel scanning**: Use worker threads for HAST traversal
3. **Incremental updates**: In watch mode, only rescan changed pages
4. **Cache whitelist**: Store whitelist between builds (with invalidation)

Current implementation prioritizes simplicity; optimize only if needed.

---

## Edge Cases & Error Handling

### Edge Case Matrix

| Scenario | Expected Behavior | Implementation |
|----------|-------------------|----------------|
| **Attachment with spaces** | `photo one.jpg` → Normalized and matched | `decodeURIComponent()` + `slugifyFilePath()` |
| **URL-encoded reference** | `%20` → space | `decodeURIComponent()` before normalization |
| **Symlink** | Follow to actual file | `fs.realpath()`, log resolution |
| **Missing file** | Warn, continue build | try-catch, log warning, return null |
| **Absolute path** | Skip, log warning | Check `path.startsWith('/')` or `C:\`, log |
| **Same attachment, multiple pages** | Include if ANY page published | Set deduplication |
| **Attachment in subdirectory** | Preserve directory structure | Use full path in whitelist |
| **Markdown file reference** | Ignore (handled by ContentPage) | Skip `.md` and `.html` extensions |
| **External URL** | Ignore (not an attachment) | Skip if `isAbsoluteUrl()` |
| **Broken wikilink** | Ignore (page doesn't exist) | No special handling needed |
| **Empty src/href** | Ignore | Check `if (!src)` |
| **Non-string src/href** | Ignore | Check `typeof src !== "string"` |

### Error Recovery

```typescript
// In AttachmentWhitelist plugin
try {
  const attachments = extractAttachments(tree, vfile)
  attachments.forEach(fp => ctx.state.attachmentWhitelist!.add(fp))
} catch (err) {
  console.error(`Error scanning ${vfile.path} for attachments:`, err)
  // Continue processing other files
}

// In Assets emitter
try {
  await copyFile(argv, fp)
} catch (err) {
  if (err.code === 'ENOENT') {
    console.warn(`Referenced attachment not found: ${fp}`)
  } else {
    console.error(`Failed to copy ${fp}:`, err)
  }
  // Continue copying other files
}
```

**Philosophy**: Graceful degradation. Attachment filtering is a security feature, but shouldn't break the build. Log warnings, continue processing.

---

## Implementation Roadmap

### Phase 1: Core Implementation
1. Create `quartz/util/attachments.ts` with:
   - `extractAttachments(tree: HtmlRoot, vfile: VFile): Set<FilePath>`
   - `isAbsolutePath(path: string): boolean`
   - Helper functions for path handling

2. Create `quartz/plugins/filters/attachmentWhitelist.ts`:
   - Implement `AttachmentWhitelist` filter plugin
   - Scan published pages, build whitelist
   - Store in `ctx.state.attachmentWhitelist`

3. Modify `quartz/plugins/emitters/assets.ts`:
   - Check whitelist before copying each file
   - Skip orphaned attachments
   - Handle symlinks (realpath)
   - Handle missing files (try-catch)
   - Log filtering decisions

4. Extend `quartz/util/ctx.ts`:
   - Add `state.attachmentWhitelist` to `BuildCtx` type

5. Update `quartz.config.ts`:
   - Add `AttachmentWhitelist` to filter chain after `PublishMode`

### Phase 2: Testing
1. Write unit tests for `extractAttachments()`
2. Write integration tests for all 4 publish modes
3. Create test fixtures (markdown files + attachments)
4. Manual testing across tiers

### Phase 3: Documentation
1. Update `docs-custom/ARCHITECTURE.md` with:
   - Attachment filtering section
   - Plugin execution order (with AttachmentWhitelist)
   - Security implications
2. Update `docs-custom/CLAUDE.md` with:
   - New plugin in codebase map
   - Testing commands
3. Move task in `docs-custom/FUTURE_TASKS.md` from pending to completed

---

## Summary

**Ready to proceed to Phase 1 (Design)?** ✅ YES

All technical unknowns resolved:
- ✅ Attachment reference format (HAST elements)
- ✅ Build pipeline integration point (filter phase + emitter modification)
- ✅ Path normalization strategy (slugifyFilePath)
- ✅ File type support (element-based detection)
- ✅ Symlink handling (realpath)
- ✅ Missing file handling (try-catch + warn)
- ✅ Absolute path handling (skip + warn)
- ✅ URL encoding (decodeURIComponent)
- ✅ Architecture (hybrid filter + emitter)
- ✅ Performance (acceptable overhead)
- ✅ Testing strategy (unit + integration)

**Next steps**: Phase 1 - Generate data-model.md, contracts/, and quickstart.md.
