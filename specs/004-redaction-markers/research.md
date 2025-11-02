# Research: Content Redaction Markers Implementation

**Date**: 2025-11-01
**Phase**: 0 (Research)
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Executive Summary

This research investigates best practices for implementing a dual-component system:
1. **Obsidian plugin** for editor integration (hotkey commands, marker insertion/removal)
2. **Quartz filter plugin** for build-time content filtering based on HTML comment markers

Key findings:
- **Editor API**: Obsidian provides robust `replaceRange()` and `getSelection()` methods for text manipulation
- **Command Registration**: `addCommand()` with `editorCallback` pattern is standard for editor-aware commands
- **Filter Plugins**: Existing Quartz filters demonstrate simple `shouldPublish()` pattern with access to file content
- **HTML Comment Detection**: Regex-based detection on raw markdown content, similar to existing `HideInBuild` transformer
- **Build Process**: esbuild for Obsidian plugin, TypeScript for Quartz filter (both already in use)

## 1. Obsidian Editor API Patterns

### Decision: Use Editor.replaceRange() + getSelection() for marker insertion

### Rationale

The Obsidian Editor API provides precise, low-level text manipulation methods that are perfect for our use case:

**Core Methods Available**:
- `getCursor(side?: 'from' | 'to' | 'head' | 'anchor'): EditorPosition` - Get cursor position
- `setCursor(pos: EditorPosition | number, ch?: number): void` - Set cursor position
- `getSelection(): string` - Get selected text
- `setSelection(anchor: EditorPosition, head?: EditorPosition): void` - Set selection range
- `listSelections(): EditorSelection[]` - Get all selections (multi-cursor support)
- `replaceSelection(replacement: string, origin?: string): void` - Replace selected text
- `replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition, origin?: string): void` - Replace text in range
- `getValue(): string` - Get entire document
- `getLine(line: number): string` - Get specific line (0-indexed)

**Why replaceRange() over replaceSelection()**:
- `replaceRange()` allows precise positioning - we can insert at line end for inline markers
- Works for both selection-based (block markers) and cursor-based (line markers) operations
- Can specify exact `from` and `to` positions for surgical edits

**Pattern for Line-Level Markers** (no selection):
```typescript
// Get current cursor position
const cursor = editor.getCursor();
const lineNumber = cursor.line;
const line = editor.getLine(lineNumber);

// Check if marker already exists
if (line.endsWith('<!-- redact -->')) {
  // Remove marker - replace from marker start to line end
  const markerStart = line.lastIndexOf('<!-- redact -->');
  editor.replaceRange(
    '',  // Empty string removes the marker
    { line: lineNumber, ch: markerStart },
    { line: lineNumber, ch: line.length }
  );
} else {
  // Add marker - append to line end
  editor.replaceRange(
    ' <!-- redact -->',  // Space before marker for readability
    { line: lineNumber, ch: line.length },
    { line: lineNumber, ch: line.length }
  );
}
```

**Pattern for Block-Level Markers** (with selection):
```typescript
// Get selection range
const selection = editor.getSelection();
const from = editor.getCursor('from');
const to = editor.getCursor('to');

// Check if selection already has markers
const beforeLine = editor.getLine(from.line - 1);
const afterLine = editor.getLine(to.line + 1);

if (beforeLine.includes('<!-- redact-begin -->') && afterLine.includes('<!-- redact-end -->')) {
  // Remove block markers
  editor.replaceRange(
    '',
    { line: from.line - 1, ch: 0 },
    { line: from.line, ch: 0 }  // Remove entire "begin" line including newline
  );
  editor.replaceRange(
    '',
    { line: to.line, ch: editor.getLine(to.line).length },
    { line: to.line + 1, ch: editor.getLine(to.line + 1).length }  // Remove entire "end" line
  );
} else {
  // Add block markers on separate lines
  editor.replaceRange(
    '<!-- redact-begin -->\n',
    from,
    from  // Insert at selection start
  );
  editor.replaceRange(
    '\n<!-- redact-end -->',
    to,
    to  // Insert at selection end
  );
}
```

### Alternatives Considered

**Alternative 1: Use replaceSelection() only**
- **Pros**: Simpler API, one method for everything
- **Cons**: Can't easily append to line end without selecting entire line first. Requires more cursor manipulation.
- **Rejected**: Less precise, requires extra selection setup for line-level markers

**Alternative 2: Use setValue() for entire document replacement**
- **Pros**: Maximum control, can manipulate text as string
- **Cons**: Destroys undo history, loses cursor position, very heavyweight
- **Rejected**: Poor UX, breaks Obsidian's editing experience

**Alternative 3: DOM manipulation via contentEditable**
- **Pros**: Direct access to editor DOM
- **Cons**: Bypasses Obsidian's internal state management, fragile, not officially supported
- **Rejected**: Violates API boundaries, likely to break in future Obsidian updates

### Implementation Notes

**EditorPosition Type**:
```typescript
interface EditorPosition {
  line: number;  // 0-indexed
  ch: number;    // Character offset (0-indexed)
}
```

**Detection Strategy for Toggle-Off**:
- **Line markers**: Check if line ends with marker syntax using `String.endsWith()`
- **Block markers**: Check lines immediately before/after selection for marker presence
- **Flexible matching**: Use `includes()` rather than exact string match to handle whitespace variations

**Cursor Behavior**:
- After marker insertion, cursor should remain at original position (Obsidian handles this automatically with `replaceRange()`)
- After marker removal, cursor stays in same logical location

**Edge Case: Partial Line Selection**:
Per spec edge cases, treat as full-line selection if:
- Selection starts at line beginning (`ch === 0`), OR
- Selection ends at line end (`ch === line.length`)

This provides forgiving UX for "almost full line" selections.

---

## 2. Hotkey Registration Patterns

### Decision: Use addCommand() with editorCallback for editor-aware commands

### Rationale

Obsidian's command system has two callback types:
1. **callback**: Global command, works anywhere in the app
2. **editorCallback**: Editor-specific command, only available when markdown editor is active

For our use case, `editorCallback` is required because:
- We need access to the Editor API
- Commands are meaningless outside of markdown editing context
- Obsidian automatically disables commands when editor isn't active

**Command Interface**:
```typescript
interface Command {
  id: string;                    // Unique identifier (e.g., "toggle-redact")
  name: string;                  // Display name in command palette
  callback?: () => any;          // Global command
  editorCallback?: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => any;  // Editor command
  checkCallback?: (checking: boolean) => boolean | void;  // Conditional global
  editorCheckCallback?: (checking: boolean, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => boolean | void;  // Conditional editor
}
```

**Pattern for Our Use Case**:
```typescript
export default class RedactionMarkersPlugin extends Plugin {
  async onload() {
    // Command 1: Toggle Redact
    this.addCommand({
      id: 'toggle-redact',
      name: 'Toggle Redact Marker',
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
        this.toggleMarker(editor, 'redact');
      }
    });

    // Command 2: Toggle No-Render
    this.addCommand({
      id: 'toggle-no-render',
      name: 'Toggle No-Render Marker',
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
        this.toggleMarker(editor, 'no-render');
      }
    });
  }

  toggleMarker(editor: Editor, type: 'redact' | 'no-render') {
    const selection = editor.getSelection();

    if (selection) {
      // Block-level: wrap selection with begin/end markers
      this.toggleBlockMarker(editor, type);
    } else {
      // Line-level: append inline marker to current line
      this.toggleLineMarker(editor, type);
    }
  }
}
```

**Hotkey Assignment**:
- Users assign hotkeys via Obsidian Settings > Hotkeys panel
- No default hotkeys (avoids conflicts with existing shortcuts)
- Plugin documentation suggests recommended hotkeys (e.g., `Cmd+Shift+R` for redact)

### Alternatives Considered

**Alternative 1: Use checkCallback for conditional visibility**
- **Pros**: Can show/hide command based on state (e.g., show "Remove marker" vs "Add marker")
- **Cons**: More complex, requires state checking on every command palette open, not standard for toggle commands
- **Rejected**: Toggle behavior is more intuitive than separate add/remove commands

**Alternative 2: QuickAdd macro integration**
- **Pros**: No plugin development needed, uses existing infrastructure
- **Cons**: Less robust hotkey support, no direct Editor API access, more complex to distribute, requires users to install QuickAdd
- **Rejected**: Per clarification answer, native plugin provides better UX

**Alternative 3: Single command with mode toggle (redact vs no-render)**
- **Pros**: Fewer hotkeys to remember
- **Cons**: Requires modal/prompt to choose type, breaks flow, less intuitive
- **Rejected**: Spec explicitly requires "two separate hotkey commands" (FR-001)

### Implementation Notes

**Command IDs**:
- Must be unique within plugin: `toggle-redact`, `toggle-no-render`
- Will appear in hotkey settings as "Redaction Markers: Toggle Redact Marker"

**Command Names**:
- User-friendly, appear in command palette
- Should be verb phrases: "Toggle Redact Marker" (not "Redact Marker Toggle")

**Editor Context**:
- `editor` parameter provides full Editor API
- `view` parameter provides access to file metadata, but not needed for our use case
- Commands only appear when editing markdown files (Obsidian handles filtering)

**Toggle Pattern**:
- Industry standard: same hotkey adds OR removes marker depending on current state
- Matches behavior of "Toggle Bold" (Cmd+B), "Toggle Bullet List", etc.
- Spec requires cycle behavior: none → marker → none (FR-004)

---

## 3. Plugin Build and Deployment

### Decision: Use esbuild with TypeScript compilation, standard manifest.json

### Rationale

Obsidian plugin development has a well-established toolchain:
- **esbuild**: Fast bundler, standard in Obsidian plugin ecosystem
- **TypeScript**: Required for type safety with Obsidian API
- **manifest.json**: Plugin metadata required by Obsidian

**Standard Build Configuration** (esbuild.config.mjs):
```javascript
import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian'],  // Don't bundle Obsidian API
  format: 'cjs',           // CommonJS for Node.js
  target: 'es2018',        // Obsidian runs on ES2018+
  outfile: 'main.js',
  logLevel: 'info',
  sourcemap: 'inline',     // For debugging
  treeShaking: true,
}).catch(() => process.exit(1));
```

**TypeScript Configuration** (tsconfig.json):
```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "lib": ["ES2018", "DOM"],
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["main.ts"]
}
```

**Manifest File** (manifest.json):
```json
{
  "id": "redaction-markers",
  "name": "Redaction Markers",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Add redact and no-render markers to hide content from specific builds",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourusername",
  "isDesktopOnly": false
}
```

**Required Files for Deployment**:
1. `main.js` - Compiled plugin code (esbuild output)
2. `manifest.json` - Plugin metadata
3. `styles.css` - Optional styles (can be empty)

**Development Workflow**:
```bash
# Install dependencies
npm install -D obsidian esbuild typescript @types/node

# Development mode (watch for changes)
npm run dev  # Runs: esbuild main.ts --bundle --watch --outfile=main.js

# Production build
npm run build  # Runs: esbuild main.ts --bundle --minify --outfile=main.js

# Install to vault for testing
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/redaction-markers/
```

**Hot Reload**:
- Obsidian can reload plugins on file change (Settings > Community Plugins > Enable plugin hot reload)
- Requires plugin manifest to enable: `"enablePluginDevMode": true` (development only)

### Alternatives Considered

**Alternative 1: Rollup instead of esbuild**
- **Pros**: More mature ecosystem, more plugins available
- **Cons**: Slower build times, more complex configuration
- **Rejected**: esbuild is Obsidian community standard, faster, simpler

**Alternative 2: No build step (plain JavaScript)**
- **Pros**: Simplest possible setup, no tooling
- **Cons**: No type safety, no modern ES6+ features, harder to maintain
- **Rejected**: TypeScript is essential for working with Obsidian API types

**Alternative 3: Webpack**
- **Pros**: Industry standard for large projects
- **Cons**: Extremely slow compared to esbuild, overkill for small plugin
- **Rejected**: Build time matters during development

### Implementation Notes

**Package.json Scripts**:
```json
{
  "scripts": {
    "dev": "esbuild main.ts --bundle --watch --external:obsidian --format=cjs --target=es2018 --outfile=main.js",
    "build": "esbuild main.ts --bundle --minify --external:obsidian --format=cjs --target=es2018 --outfile=main.js"
  }
}
```

**Version Management**:
- `manifest.json` contains version number
- Update manually or via npm version script
- For releases, ensure version in manifest matches git tag

**Distribution**:
- For personal use: copy 3 files to `.obsidian/plugins/redaction-markers/`
- For public release: create GitHub release with compiled artifacts
- Community plugins require: manifest.json, main.js, styles.css as release assets

**Development Location**:
- Option 1: Develop directly in `.obsidian/plugins/redaction-markers/` for live testing
- Option 2: Develop in separate directory, use symlink or copy script
- Recommend Option 1 for rapid iteration

**Dependencies**:
```json
{
  "devDependencies": {
    "obsidian": "latest",      // Type definitions only, not bundled
    "esbuild": "^0.25.10",
    "typescript": "^5.9.2",
    "@types/node": "^22.0.0"   // For Node.js types (fs, path, etc.)
  }
}
```

---

## 4. Quartz Filter Plugin Patterns

### Decision: Create new filter plugin (redactionMarkers.ts) following existing patterns

### Rationale

Quartz has a well-defined filter plugin architecture. Examining existing filters reveals a consistent pattern:

**Filter Plugin Type**:
```typescript
export type QuartzFilterPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzFilterPluginInstance

export type QuartzFilterPluginInstance = {
  name: string
  shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean
}
```

**Pattern from publishMode.ts** (lines 18-73):
```typescript
export const PublishMode: QuartzFilterPlugin<Options> = (userOpts) => {
  const opts: Options = { ...userOpts }

  return {
    name: "PublishMode",
    shouldPublish(_ctx, [_tree, vfile]) {
      // Access frontmatter
      const frontmatter = vfile.data?.frontmatter
      const publishValue = frontmatter?.publish

      // Access environment variable
      const publishMode = opts.mode || process.env.QUARTZ_PUBLISH_MODE || "full"

      // Return boolean: true = publish, false = filter out
      return /* logic here */
    },
  }
}
```

**Pattern from indexSwapper.ts** (lines 18-77):
```typescript
export const IndexSwapper: QuartzFilterPlugin = () => {
  const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

  return {
    name: "IndexSwapper",
    shouldPublish(ctx, [tree, vfile]) {
      const slug = vfile.data.slug!

      // Access and modify file data
      if (slug === targetIndexSlug) {
        vfile.data.slug = "index"
        vfile.data.frontmatter.publish = publishModeMap[publishMode]
        return true
      }

      return false  // Filter out other index variants
    },
  }
}
```

**Pattern from draft.ts** (lines 3-10) - Simplest example:
```typescript
export const RemoveDrafts: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [_tree, vfile]) {
    const draftFlag: boolean =
      vfile.data?.frontmatter?.draft === true || vfile.data?.frontmatter?.draft === "true"
    return !draftFlag
  },
})
```

**Key Observations**:
1. **ProcessedContent structure**: `[HtmlRoot, VFile]` tuple
   - `HtmlRoot`: Parsed HTML AST (not needed for marker detection)
   - `VFile`: File metadata including frontmatter, slug, and **raw content**
2. **Access to content**: Use `vfile` parameter to access file data
3. **Return value**: `true` = publish file, `false` = filter out completely
4. **Environment variables**: Use `process.env.QUARTZ_PUBLISH_MODE` to get current build mode
5. **No state**: Filters are stateless, called once per file

**Our Implementation Pattern**:
```typescript
export const RedactionMarkers: QuartzFilterPlugin = () => {
  const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

  return {
    name: "RedactionMarkers",
    shouldPublish(ctx, [tree, vfile]) {
      // Note: This filter operates on ENTIRE FILE level
      // Line/block filtering happens in transformer (textTransform)
      // Filter plugin only needs to detect malformed markers

      try {
        // Parse markers to detect syntax errors
        validateMarkerSyntax(vfile.value)
        return true  // File is valid, publish it (transformer will handle marker removal)
      } catch (error) {
        // Malformed markers detected
        logBuildWarning(vfile.path, error)
        return false  // Skip this file
      }
    },
  }
}
```

**Wait, that's wrong!** Filter plugins operate at **file level** (include/exclude entire files). We need **line/block level** filtering.

**Corrected Approach: Use Transformer Plugin, not Filter Plugin**

Looking at `hideInBuild.ts` (lines 45-125), we see the correct pattern for line-level content removal:

```typescript
export const HideInBuild: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  return {
    name: "HideInBuild",
    textTransform(_ctx, src) {
      const publishMode = (process.env.QUARTZ_PUBLISH_MODE || "full") as PublishMode

      // Process raw markdown text BEFORE parsing
      const lines = src.split("\n")
      const outputLines: string[] = []

      let insideHideBlock = false
      for (const line of lines) {
        if (line.match(/<!--\s*hide-in-build/)) {
          insideHideBlock = true
          continue  // Skip marker line
        }
        if (line.match(/<!--\s*\/hide-in-build/)) {
          insideHideBlock = false
          continue  // Skip marker line
        }
        if (!insideHideBlock) {
          outputLines.push(line)
        }
      }

      return outputLines.join("\n")
    },
  }
}
```

**Key Insight**: Use `textTransform` method of **QuartzTransformerPlugin**, not filter plugin!
- `textTransform` receives raw markdown string (`src`)
- Returns modified markdown string
- Runs BEFORE markdown parsing (can remove content at text level)
- This is how `HideInBuild` works - same pattern we need

### Alternatives Considered

**Alternative 1: Filter plugin with file-level exclusion**
- **Pros**: Simple boolean logic
- **Cons**: Can only include/exclude entire files, not lines/blocks within files
- **Rejected**: Spec requires line/block granularity (FR-002, FR-003)

**Alternative 2: Transformer plugin with markdown AST manipulation**
- **Pros**: Semantic understanding of markdown structure
- **Cons**: HTML comments may not be preserved in AST, more complex
- **Rejected**: `textTransform` is simpler and proven to work (see HideInBuild)

**Alternative 3: Custom emitter that filters during HTML generation**
- **Pros**: Most precise control over output
- **Cons**: Much more complex, requires understanding entire Quartz emit pipeline
- **Rejected**: Overkill, textTransform is sufficient

### Implementation Notes

**Plugin Type: Transformer, not Filter**
```typescript
import { QuartzTransformerPlugin } from "../types"

export const RedactionMarkers: QuartzTransformerPlugin = () => {
  return {
    name: "RedactionMarkers",
    textTransform(ctx, src) {
      const publishMode = (process.env.QUARTZ_PUBLISH_MODE || "full") as PublishMode

      // Process line by line
      const lines = src.split("\n")
      const outputLines: string[] = []

      // Implementation here

      return outputLines.join("\n")
    },
  }
}
```

**Plugin Placement**:
- Add to `quartz/plugins/transformers/redactionMarkers.ts`
- Export from `quartz/plugins/transformers/index.ts`
- Register in `quartz.config.ts` transformers array (after FrontMatter, before markdown parsing)

**Processing Order**:
```typescript
// quartz.config.ts
transformers: [
  Plugin.FrontMatter(),        // Parse frontmatter first
  Plugin.RedactionMarkers(),   // NEW: Process markers on raw text
  Plugin.HideInBuild(),        // Existing hide-in-build logic
  // ... rest of transformers
]
```

**Access to Content**:
- `src` parameter is raw markdown string (not parsed)
- Can use string operations, regex, line-by-line processing
- Return value is modified markdown string

---

## 5. HTML Comment Detection in Markdown

### Decision: Line-by-line regex matching on raw markdown text

### Rationale

HTML comments in markdown need to be detected reliably across multiple syntaxes:
- Inline markers: `content <!-- redact -->`
- Block markers: `<!-- redact-begin -->` and `<!-- redact-end -->` on separate lines
- Keyword tripwire: lines containing "Juuden" (case-insensitive)

**Detection Strategy** (based on HideInBuild pattern):

```typescript
// Regex patterns
const INLINE_REDACT = /<!--\s*redact\s*-->/i
const INLINE_NO_RENDER = /<!--\s*no-render\s*-->/i
const BLOCK_REDACT_BEGIN = /<!--\s*redact-begin\s*-->/i
const BLOCK_REDACT_END = /<!--\s*redact-end\s*-->/i
const BLOCK_NO_RENDER_BEGIN = /<!--\s*no-render-begin\s*-->/i
const BLOCK_NO_RENDER_END = /<!--\s*no-render-end\s*-->/i
const JUUDEN_KEYWORD = /juuden/i  // Case-insensitive

// Processing logic
function processMarkers(src: string, publishMode: string): string {
  const lines = src.split("\n")
  const outputLines: string[] = []

  let insideRedactBlock = false
  let insideNoRenderBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check block markers first (higher precedence)
    if (line.match(BLOCK_NO_RENDER_BEGIN)) {
      insideNoRenderBlock = true
      continue  // Skip marker line
    }
    if (line.match(BLOCK_NO_RENDER_END)) {
      insideNoRenderBlock = false
      continue  // Skip marker line
    }
    if (line.match(BLOCK_REDACT_BEGIN)) {
      insideRedactBlock = true
      continue  // Skip marker line
    }
    if (line.match(BLOCK_REDACT_END)) {
      insideRedactBlock = false
      continue  // Skip marker line
    }

    // Inside block: filter based on publish mode
    if (insideNoRenderBlock) {
      continue  // Always skip, regardless of mode
    }
    if (insideRedactBlock && publishMode !== "full") {
      continue  // Skip in non-full modes
    }

    // Check inline markers
    if (line.match(INLINE_NO_RENDER)) {
      continue  // Always skip
    }
    if (line.match(INLINE_REDACT) && publishMode !== "full") {
      continue  // Skip in non-full modes
    }

    // Check Juuden keyword tripwire
    if (line.match(JUUDEN_KEYWORD) && publishMode !== "full") {
      continue  // Skip in non-full modes (acts like redact)
    }

    // If we got here, include the line
    // But remove markers from output in full mode
    let outputLine = line
    if (publishMode === "full") {
      // Remove redact markers but keep content
      outputLine = outputLine.replace(INLINE_REDACT, '')
    }

    outputLines.push(outputLine)
  }

  return outputLines.join("\n")
}
```

**Marker Precedence Rules** (per spec edge cases):
1. No-render > Redact > Juuden
2. Block markers > inline markers (when nested)
3. Most restrictive rule wins

**Edge Case: Markers in Code Blocks**:
Per spec clarification (edge case: "What happens when 'Juuden' appears in code block?"), the answer is: "tripwire still applies - keyword matching is text-based, not semantic"

This means we do NOT need to parse markdown structure to exclude code blocks. Simple regex on all lines is sufficient.

### Alternatives Considered

**Alternative 1: Semantic markdown parsing (skip code blocks)**
- **Pros**: More "correct" - respects markdown structure
- **Cons**: Much more complex, requires AST traversal, contradicts spec requirements
- **Rejected**: Spec explicitly states tripwire applies in code blocks (edge case answer)

**Alternative 2: Multi-pass processing (markers first, then keywords)**
- **Pros**: Clearer separation of concerns
- **Cons**: Requires two iterations over content, slightly slower
- **Rejected**: Single-pass is sufficient and more efficient

**Alternative 3: State machine with nested block tracking**
- **Pros**: Can handle deeply nested markers
- **Cons**: Spec doesn't require nested support, adds complexity
- **Rejected**: Simple boolean flags are sufficient (per spec: "inner marker takes precedence")

### Implementation Notes

**Regex Flags**:
- `/i` for case-insensitive matching (required for Juuden keyword)
- `\s*` for flexible whitespace (handles `<!-- redact -->` vs `<!--redact-->`)
- No need for multiline flag - processing line-by-line

**Marker Removal in Full Mode**:
- Redact markers are HIDDEN in full mode (content visible, markers invisible)
- Use `String.replace()` to remove marker syntax: `line.replace(INLINE_REDACT, '')`
- No-render markers never appear (content always filtered), so no removal needed

**Block Marker State**:
- Track with boolean flags: `insideRedactBlock`, `insideNoRenderBlock`
- Reset state at marker end
- If block never closes (missing end marker), treat as malformed

**Malformed Marker Detection**:
- Unclosed blocks: If `insideRedactBlock` or `insideNoRenderBlock` is true at end of file
- Mismatched markers: Begin marker without matching end
- Invalid syntax: `<!-- redact` (missing closing `-->`)

For malformed markers, per spec (FR-018):
1. Log warning with file path and error details
2. Skip entire file (exclude from build)
3. Generate `build-warnings.html` with list of skipped files

**Build Warnings Implementation**:
```typescript
// quartz/util/buildWarnings.ts (NEW FILE)
interface BuildWarning {
  filePath: string
  error: string
  lineNumber?: number
}

const warnings: BuildWarning[] = []

export function logBuildWarning(filePath: string, error: string, lineNumber?: number) {
  warnings.push({ filePath, error, lineNumber })
  console.warn(`[RedactionMarkers] ${filePath}:${lineNumber || '?'} - ${error}`)
}

export function generateWarningsReport(): string {
  if (warnings.length === 0) return ''

  let html = '<html><head><title>Build Warnings</title></head><body>'
  html += '<h1>Redaction Markers: Build Warnings</h1>'
  html += '<ul>'
  for (const warning of warnings) {
    html += `<li><strong>${warning.filePath}</strong>:${warning.lineNumber || '?'} - ${warning.error}</li>`
  }
  html += '</ul></body></html>'
  return html
}

export function hasWarnings(): boolean {
  return warnings.length > 0
}
```

This helper would be called from the transformer, and warnings HTML generated by an emitter plugin at end of build.

---

## 6. Integration with Existing System

### Decision: Add transformer to existing pipeline, respect publish mode hierarchy

### Rationale

The existing Quartz system has:
- Publish mode hierarchy: full > trusted > shachu > public (from publishMode.ts)
- Filter plugins that exclude entire files (draft.ts, publishMode.ts, indexSwapper.ts)
- Transformer plugins that modify content (hideInBuild.ts, frontmatter.ts)

Our feature integrates as:
- **Transformer plugin** (redactionMarkers.ts) for line/block filtering
- **Respects publish mode** (uses `process.env.QUARTZ_PUBLISH_MODE`)
- **Runs early** (after FrontMatter, before markdown parsing)

**Plugin Execution Order** (from quartz.config.ts):
```typescript
transformers: [
  Plugin.FrontMatter(),           // 1. Parse frontmatter
  Plugin.RedactionMarkers(),      // 2. NEW: Filter markers (raw text)
  Plugin.HideInBuild(),           // 3. Filter hide-in-build comments
  Plugin.CreatedModifiedDate(),   // 4. Add timestamps
  Plugin.SyntaxHighlighting(),    // 5. Parse markdown, highlight code
  // ... rest of transformers
]

filters: [
  Plugin.RemoveDrafts(),          // 1. Remove drafts
  Plugin.IndexSwapper(),          // 2. Swap index files
  Plugin.PublishMode(),           // 3. Filter by publish tier
  Plugin.AttachmentWhitelist(),   // 4. Filter orphaned attachments
]
```

**Why This Order**:
1. FrontMatter first - needed by other plugins to access metadata
2. RedactionMarkers early - operates on raw text before parsing
3. HideInBuild after - similar functionality, separate concern
4. Filters run after transformers - decide which files to include

**Interaction with Publish Mode**:
- Redaction markers use same mode hierarchy
- Redact = hidden from public/trusted/shachu, visible in full
- This matches existing behavior of publish field (from publishMode.ts lines 54-68)

**Interaction with HideInBuild**:
- Both use `textTransform` to filter content
- HideInBuild is mode-aware (can specify modes to hide)
- RedactionMarkers is simpler (two types: redact vs no-render)
- No conflicts - they process different marker types

### Alternatives Considered

**Alternative 1: Merge with HideInBuild plugin**
- **Pros**: Single plugin for all hiding logic
- **Cons**: Different semantics (hide-in-build is mode-configurable, redact is fixed), harder to maintain
- **Rejected**: Separate concerns, easier to understand

**Alternative 2: Filter plugin instead of transformer**
- **Pros**: Simpler plugin type
- **Cons**: Can't do line-level filtering, only file-level
- **Rejected**: Doesn't meet requirements

**Alternative 3: Emitter plugin with custom HTML generation**
- **Pros**: Most control over output
- **Cons**: Much more complex, requires reimplementing entire page generation
- **Rejected**: Overkill

### Implementation Notes

**Configuration in quartz.config.ts**:
```typescript
transformers: [
  Plugin.FrontMatter(),
  Plugin.RedactionMarkers(),  // No options needed
  Plugin.HideInBuild(),
  // ...
]
```

**No Options Required**:
- Plugin reads `process.env.QUARTZ_PUBLISH_MODE` directly
- No configuration needed (unlike publishMode which takes `mode` option)

**Exporting Plugin**:
```typescript
// quartz/plugins/transformers/index.ts
export { RedactionMarkers } from "./redactionMarkers"

// quartz/plugins/index.ts (re-exports all plugins)
export * from "./transformers"
```

**Build Output**:
- If malformed markers detected: `public/build-warnings.html` generated
- Normal builds: no warnings file (or empty file)

---

## 7. Testing Strategy

### Decision: Multi-level testing - unit tests for logic, integration tests for builds, manual tests for editor

### Rationale

This feature has three distinct components requiring different testing approaches:

**1. Obsidian Plugin (Editor Integration)**:
- **Primary method**: Manual testing in Obsidian
- **Why**: Editor API interactions are hard to unit test (requires Obsidian environment)
- **Test cases**: From spec User Stories 1-5
  - Place cursor on line, press hotkey, verify marker added
  - Press hotkey again, verify marker removed
  - Select multiple lines, press hotkey, verify block markers added
  - Select block with markers, press hotkey, verify markers removed

**2. Quartz Transformer (Marker Detection)**:
- **Primary method**: Unit tests with Jest
- **Why**: Pure functions (string in, string out), easy to test in isolation
- **Test cases**:
  ```typescript
  describe('RedactionMarkers', () => {
    test('filters inline redact markers in public mode', () => {
      const input = 'Public content\nSecret <!-- redact -->\n'
      const output = processMarkers(input, 'public')
      expect(output).toBe('Public content\n')
    })

    test('includes redact markers in full mode', () => {
      const input = 'Public content\nSecret <!-- redact -->\n'
      const output = processMarkers(input, 'full')
      expect(output).toContain('Secret')
      expect(output).not.toContain('<!-- redact -->')  // Marker hidden
    })

    test('filters no-render in all modes', () => {
      const input = 'Content\nScratch <!-- no-render -->\n'
      expect(processMarkers(input, 'full')).not.toContain('Scratch')
      expect(processMarkers(input, 'public')).not.toContain('Scratch')
    })

    test('filters Juuden keyword in non-full modes', () => {
      const input = 'Public content\nMentions Juuden here\n'
      expect(processMarkers(input, 'public')).not.toContain('Juuden')
      expect(processMarkers(input, 'full')).toContain('Juuden')
    })

    test('handles nested markers - no-render wins', () => {
      const input = '<!-- redact-begin -->\nContent\n<!-- no-render -->\n<!-- redact-end -->\n'
      expect(processMarkers(input, 'full')).not.toContain('no-render')  // Inner marker wins
    })

    test('detects malformed markers', () => {
      const input = '<!-- redact-begin -->\nContent\n'  // Missing end
      expect(() => processMarkers(input, 'public')).toThrow()
    })
  })
  ```

**3. Integration (Full Build)**:
- **Primary method**: Manual builds with test vault
- **Why**: Verifies entire pipeline (editor → markdown → build → output)
- **Test cases**:
  ```bash
  # Create test vault with marked content
  cd test-vault
  # ... create test notes with markers ...

  # Build in each mode
  npx quartz build --publish-mode full
  npx quartz build --publish-mode trusted
  npx quartz build --publish-mode shachu
  npx quartz build --publish-mode public

  # Verify output HTML in public/ directory
  # - Full mode: redact content visible
  # - Public mode: redact content hidden
  # - All modes: no-render content hidden
  ```

### Implementation Notes

**Test File Structure**:
```text
specs/004-redaction-markers/
├── tests/
│   ├── redactionMarkers.test.ts   # Unit tests for transformer
│   ├── fixtures/                   # Test markdown files
│   │   ├── redact-inline.md
│   │   ├── redact-block.md
│   │   ├── no-render.md
│   │   ├── juuden-keyword.md
│   │   └── malformed.md
│   └── integration.test.ts         # Build pipeline tests (optional)
```

**Jest Configuration** (if adding tests to Quartz repo):
```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": ["**/*.test.ts"]
}
```

**Manual Testing Checklist** (from spec.md User Stories):
- [ ] User Story 1: Line-level redaction toggle
- [ ] User Story 2: Line-level no-render toggle
- [ ] User Story 3: Block-level redaction
- [ ] User Story 4: Block-level no-render
- [ ] User Story 5: Toggle cycling
- [ ] Edge Case: Partial overlapping markers
- [ ] Edge Case: Juuden in code blocks
- [ ] Edge Case: Nested markers
- [ ] Edge Case: Malformed markers

---

## 8. Documentation Requirements

### Decision: Update ARCHITECTURE.md, create dedicated feature doc (optional), update CLAUDE.md

### Rationale

Per project constitution (CLAUDE.md Principle V):
- **ARCHITECTURE.md is a living document**: Must update with any architectural changes
- **Create feature documentation** for substantial features
- **Keep CLAUDE.md updated** with new patterns

**Required Updates**:

1. **ARCHITECTURE.md** - Add section:
   ```markdown
   ### Content Redaction Markers

   #### Overview
   Allows hiding content at line/block granularity using HTML comment markers.

   #### Marker Types
   - Redact markers: Hidden in public/trusted/shachu, visible in full
   - No-render markers: Hidden in all modes
   - Keyword tripwire: "Juuden" acts as implicit redact marker

   #### Implementation
   - Editor integration: Obsidian plugin (`.obsidian/plugins/redaction-markers/`)
   - Build filtering: Transformer plugin (`quartz/plugins/transformers/redactionMarkers.ts`)
   - Processing: Line-by-line regex matching on raw markdown
   - Error handling: Malformed markers skip file, generate `build-warnings.html`

   #### Plugin Order
   Must run after FrontMatter, before markdown parsing (textTransform phase)

   #### Interaction with Publish Modes
   Redaction respects existing publish mode hierarchy (full > trusted > shachu > public)
   ```

2. **CLAUDE.md** - Update Quick Reference:
   ```markdown
   | "Where is..." | Location |
   |---------------|----------|
   | Redaction markers filter | `quartz/plugins/transformers/redactionMarkers.ts` |
   | Obsidian redaction plugin | Vault: `.obsidian/plugins/redaction-markers/` |
   | Build warnings output | `public/build-warnings.html` |
   ```

3. **Optional: Create REDACTION_MARKERS.md** (if feature is complex enough):
   - Detailed explanation of marker syntax
   - Usage examples
   - Troubleshooting common issues
   - Integration with publish modes

### Implementation Notes

**When to Update**:
- **During development**: Keep notes in research.md (this file)
- **After implementation**: Update ARCHITECTURE.md with final design
- **After testing**: Add troubleshooting notes if issues found

**Documentation Standards**:
- Use clear, concise language
- Include code examples
- Explain WHY, not just WHAT
- Cross-reference related features (publish modes, hide-in-build)

---

## Open Questions & Risks

### Open Questions

1. **Q**: Should Juuden keyword be configurable (different keyword per user)?
   **A**: Deferred. Spec has hard-coded "Juuden". Can make configurable in future.

2. **Q**: Should there be a visual indicator in Obsidian for marked content (beyond the comment)?
   **A**: Out of scope for this spec. Markers are visible in source mode. Could add CSS styling in future.

3. **Q**: How to handle markers that span frontmatter boundaries?
   **A**: Per spec edge case, "markers only apply to content section, not frontmatter". FrontMatter plugin runs first and parses frontmatter separately, so markers in frontmatter YAML will be ignored by redactionMarkers transformer.

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| HTML comments not preserved through markdown parsing | HIGH | LOW | Verified with HideInBuild - textTransform runs BEFORE parsing, so raw comments are accessible |
| Regex performance on large files | MEDIUM | LOW | Line-by-line processing is O(n), benchmarking recommended if files > 10MB |
| Obsidian API changes break plugin | MEDIUM | LOW | Use stable API (Editor methods are core API since v0.15.0), pin minAppVersion in manifest |
| Users forget which hotkey is which | LOW | MEDIUM | Document recommended mnemonics: R for Redact, N for No-render |
| Malformed markers cause build failures | HIGH | MEDIUM | Mitigated by FR-018: skip file, log warning, continue build |
| Juuden false positives (keyword in URLs, etc.) | MEDIUM | MEDIUM | Per spec edge case: "tripwire still applies". Accepted trade-off for simplicity. |

---

## Recommended Implementation Order

Based on dependencies and testing needs:

### Phase 1: Core Transformer (Build-Time Filtering)
1. Create `quartz/plugins/transformers/redactionMarkers.ts`
2. Implement line-by-line processing logic
3. Add unit tests for marker detection
4. Test with manual builds (full, public, trusted, shachu modes)
5. Implement malformed marker detection and build-warnings.html generation

**Why first**: Can test independently of editor plugin. Validates core filtering logic.

### Phase 2: Obsidian Plugin (Editor Integration)
1. Set up plugin project structure (main.ts, manifest.json, package.json, tsconfig.json, esbuild.config.mjs)
2. Implement toggle commands (addCommand with editorCallback)
3. Implement line-level marker insertion/removal (replaceRange)
4. Implement block-level marker insertion/removal (replaceRange on multiple lines)
5. Manual testing in Obsidian (User Stories 1-5)

**Why second**: Depends on marker syntax finalized in Phase 1. Can use Phase 1 output for testing.

### Phase 3: Integration & Documentation
1. Test full workflow: Obsidian → mark content → build → verify output
2. Test all edge cases from spec (nested markers, malformed syntax, Juuden keyword)
3. Update ARCHITECTURE.md with implementation details
4. Update CLAUDE.md with file locations
5. Create usage documentation (optional)

**Why last**: Requires both components working together.

---

## Success Criteria Validation

From spec.md, these success criteria must be testable:

- **SC-001, SC-002**: Hotkey response time < 1 second
  - **Test**: Manual timing with stopwatch. Easily achievable (replaceRange is instant).

- **SC-003**: Redacted content filtered from 100% of non-full builds
  - **Test**: Automated unit tests + manual build verification.

- **SC-004**: No-render content filtered from 100% of all builds
  - **Test**: Automated unit tests + manual build verification.

- **SC-005**: Multi-line selections work with same single-keystroke experience
  - **Test**: Manual testing in Obsidian.

- **SC-006**: Build completes with malformed markers (skip file, generate warnings)
  - **Test**: Create test file with unclosed markers, verify build succeeds and generates build-warnings.html.

- **SC-007**: Marker syntax hidden from output
  - **Test**: Inspect rendered HTML in full mode, verify no `<!-- redact -->` visible.

- **SC-008**: Users can configure hotkeys
  - **Test**: Open Obsidian Settings > Hotkeys, search for "Redaction Markers", assign custom hotkeys.

- **SC-009**: Toggle operations are idempotent
  - **Test**: Press hotkey twice, verify state cycles: none → marker → none.

- **SC-010, SC-011**: Juuden keyword tripwire works correctly
  - **Test**: Unit tests for keyword detection + manual build verification.

All success criteria are testable with proposed implementation.

---

## Conclusion

This research establishes a clear path forward:

1. **Obsidian Plugin**: Use Editor API with `replaceRange()` and `editorCallback` for robust marker insertion/removal
2. **Quartz Transformer**: Use `textTransform` method (not filter plugin) for line/block filtering, following HideInBuild pattern
3. **Build Process**: Standard esbuild + TypeScript for Obsidian plugin, integrated into existing Quartz transformer pipeline
4. **Testing**: Unit tests for transformer logic, manual testing for editor integration, integration tests for full builds
5. **Documentation**: Update ARCHITECTURE.md, CLAUDE.md with implementation details

No major technical risks identified. All requirements are achievable with existing APIs and patterns.

**Next steps**: Proceed to Phase 1 (Data Model & Contracts) to formalize marker syntax and transformer interface.
