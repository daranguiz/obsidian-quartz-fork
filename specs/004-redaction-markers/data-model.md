# Data Model: Content Redaction Markers

**Feature**: 004-redaction-markers
**Date**: 2025-11-01

## Overview

This feature is **stateless** and does not persist data. The data model describes processing entities and their relationships during runtime operations (editor manipulation and build-time filtering).

## Core Entities

### 1. Marker (Processing Instruction)

A **Marker** is an HTML comment embedded in markdown that instructs the build system to filter content.

```typescript
interface Marker {
  type: 'redact' | 'no-render'
  form: 'inline' | 'block'
  visibility: VisibilityRule
}

type VisibilityRule = {
  full: boolean      // Visible in full mode?
  trusted: boolean   // Visible in trusted mode?
  shachu: boolean    // Visible in shachu mode?
  public: boolean    // Visible in public mode?
}
```

**Marker Types:**

| Type | Inline Syntax | Block Syntax (Begin/End) | Visibility Rule |
|------|--------------|-------------------------|-----------------|
| `redact` | `<!-- redact -->` | `<!-- redact-begin -->` / `<!-- redact-end -->` | full: true, others: false |
| `no-render` | `<!-- no-render -->` | `<!-- no-render-begin -->` / `<!-- no-render-end -->` | all: false |

**Validation Rules:**
- Inline markers must appear at end of line
- Block markers must appear on their own lines
- Block markers must be properly paired (begin → end)
- Malformed markers trigger file exclusion and warning generation

**Lifecycle:**
1. **Creation**: User inserts via Obsidian plugin hotkey
2. **Detection**: Quartz transformer detects during build via regex
3. **Processing**: Lines/blocks filtered based on publish mode
4. **Removal**: Markers stripped from output (never visible in rendered HTML)

**State Transitions:**
- Inline: `unmarked` ↔ `marked` (toggle)
- Block: `unmarked` ↔ `wrapped` (toggle)
- Malformed: triggers `file_excluded` state

---

### 2. Keyword Tripwire

A **Keyword Tripwire** is an implicit marker triggered by presence of specific text.

```typescript
interface KeywordTripwire {
  keyword: string          // "Juuden"
  matchMode: 'case-insensitive'
  appliesAsMarkerType: 'redact'  // Acts like redact marker
}
```

**Behavior:**
- Any line containing "Juuden" (case-insensitive) is treated as having `<!-- redact -->` marker
- Applies even if line also has explicit marker (explicit takes precedence if more restrictive)
- Tripwire is text-based (not semantic) - applies even in code blocks

**Precedence Rules:**
```
no-render > explicit redact > Juuden tripwire
```

**Example:**
```markdown
This mentions Juuden <!-- no-render -->
```
→ Hidden from ALL builds (no-render wins)

---

### 3. Editor Command

An **Editor Command** is a user-invokable action in Obsidian.

```typescript
interface EditorCommand {
  id: 'toggle-redact' | 'toggle-no-render'
  name: string             // Display name in command palette
  editorCallback: (editor: Editor, view: MarkdownView) => void
  hotkeys?: KeyBinding[]   // User-configured via Obsidian settings
}

interface KeyBinding {
  modifiers: ('Mod' | 'Shift' | 'Alt' | 'Ctrl')[]
  key: string
}
```

**Commands:**
1. **Toggle Redact** (`toggle-redact`)
   - Name: "Toggle redaction marker"
   - Behavior: Inserts/removes `<!-- redact -->` or block form

2. **Toggle No-Render** (`toggle-no-render`)
   - Name: "Toggle no-render marker"
   - Behavior: Inserts/removes `<!-- no-render -->` or block form

**Selection Detection Logic:**
```typescript
if (editor.somethingSelected()) {
  // Block form: wrap selection with begin/end markers on own lines
  insertBlockMarkers(editor, markerType)
} else {
  // Inline form: append marker to current line
  insertInlineMarker(editor, markerType)
}
```

**Toggle-Off Detection:**
```typescript
// Check if cursor is on marked line or selection includes markers
if (hasExistingMarkers(editor, markerType)) {
  removeMarkers(editor, markerType)
} else {
  insertMarkers(editor, markerType)
}
```

---

### 4. Build Warning

A **Build Warning** records errors encountered during marker processing.

```typescript
interface BuildWarning {
  filePath: string         // Relative path to problematic file
  errorType: 'malformed-marker' | 'unclosed-block' | 'parse-error'
  lineNumber?: number      // Line where error detected
  details: string          // Human-readable description
  timestamp: Date
}

interface BuildWarningsReport {
  buildMode: 'full' | 'trusted' | 'shachu' | 'public'
  warnings: BuildWarning[]
  generatedAt: Date
}
```

**Persistence:**
- Written to `public/build-warnings.html` during build
- Overwritten on each build (not cumulative)
- Only generated if warnings exist

**HTML Format:**
```html
<!DOCTYPE html>
<html>
<head><title>Build Warnings</title></head>
<body>
  <h1>Build Warnings Report</h1>
  <p>Build Mode: {mode}</p>
  <p>Generated: {timestamp}</p>
  <ul>
    <li><strong>{filePath}</strong>: {errorType} at line {lineNumber} - {details}</li>
    ...
  </ul>
</body>
</html>
```

---

### 5. Marker Widget (Visual Representation)

A **Marker Widget** is a non-editable visual element in Obsidian Live Preview that replaces HTML comment markers.

```typescript
interface MarkerWidget {
  type: 'redact' | 'no-render'
  form: 'inline' | 'block-begin' | 'block-end'
  underlyingComment: string    // The actual HTML comment in markdown
  visualElement: HTMLSpanElement
  atomic: true                 // Cannot cursor into widget
}

class RedactMarkerWidget extends WidgetType {
  constructor(readonly type: 'redact' | 'no-render') {}

  toDOM(): HTMLElement {
    // Returns non-editable span element
    // contentEditable = "false"
    // className based on type
  }

  eq(other: RedactMarkerWidget): boolean {
    // Equality check for widget updates
  }

  ignoreEvent(): boolean {
    // Makes widget atomic (single unit)
  }
}
```

**Widget Properties:**

| Property | Value | Purpose |
|----------|-------|---------|
| `contentEditable` | `"false"` | Prevents cursor from entering widget |
| `className` | `.redaction-widget .redact-widget` or `.no-render-widget` | Enables CSS styling |
| `atomic` | `true` | Widget acts as single character |
| `portability` | Full | Underlying markdown still has `<!-- redact -->` |

**Lifecycle:**
1. **Creation**: User toggles marker → Plugin inserts `<!-- redact -->` in markdown
2. **Rendering**: CodeMirror ViewPlugin detects comment → creates widget via `Decoration.replace()`
3. **Display**: Widget appears in Live Preview as styled badge (e.g., `🔒 REDACT`)
4. **Editing**: User can select/delete widget as single unit, cannot cursor into it
5. **Deletion**: Backspace on widget → removes underlying `<!-- redact -->` comment from markdown
6. **Persistence**: Widget is view-only → markdown file always contains HTML comment

**Visual Variants:**

Inline Widgets:
- Redact: `🔒 REDACT` (orange/amber theme)
- No-Render: `❌ HIDDEN` (red theme)

Block Widgets:
- Redact Begin: `🔒 REDACT BEGIN`
- Redact End: `🔒 REDACT END`
- No-Render Begin: `❌ NO-RENDER BEGIN`
- No-Render End: `❌ NO-RENDER END`

**Decoration Pattern:**

```typescript
// Replace HTML comment with widget
builder.add(
  commentStartPos,
  commentEndPos,
  Decoration.replace({
    widget: new RedactMarkerWidget('redact'),
    inclusive: false,  // Don't capture adjacent text
    block: false       // Inline widget
  })
)
```

**Edit-Safety Guarantees:**
- ✅ Cannot accidentally type in middle of marker syntax
- ✅ Cannot partially delete marker (all-or-nothing)
- ✅ Cannot move cursor into widget
- ✅ Widget stays at line end even when editing line text
- ✅ Deleting widget properly removes underlying comment

**Future Enhancement (Gutter Mode):**
```typescript
class RedactGutterMarker extends GutterMarker {
  toDOM(): HTMLElement {
    // Returns icon element in gutter column
    // Less intrusive than inline widgets
  }
}
```

---

### 6. Topic Filter Configuration

A **Topic Filter Configuration** controls note-level exclusion based on frontmatter topic.

```typescript
interface TopicFilterConfig {
  enabled: boolean         // Default: false
  topicKeyword: string     // "Juuden"
  frontmatterField: 'topic' | 'topics'
  matchMode: 'exact' | 'contains'
}
```

**Behavior (when enabled):**
```yaml
---
topic: "Juuden"
---
```
→ Entire note excluded from builds (more restrictive than line-level)

**Configuration Method:**
- Boolean flag in `quartz/plugins/transformers/redactionMarkers.ts`
- Can be toggled by changing constant (no UI needed)

---

## Relationships

```
┌────────────────┐
│ Editor Command │
└────────┬───────┘
         │ creates
         ▼
    ┌─────────┐
    │ Marker  │◄────────┐
    └────┬────┘         │
         │              │ acts like
         │              │
         ├──────────► ┌──┴───────────────┐
         │ triggers   │ Keyword Tripwire │
         │            └──────────────────┘
         │
         │ rendered as (Live Preview)
         ▼
    ┌────────────┐
    │   Widget   │
    └────────────┘
         │
         │ underlying comment detected by
         ▼
┌────────────────────┐
│ Quartz Transformer │
└────────┬───────────┘
         │ on error
         ▼
┌─────────────────┐
│ Build Warning   │
└─────────────────┘
```

**Flow:**
1. User invokes **Editor Command** via hotkey
2. Command creates **Marker** (HTML comment) in markdown file
3. In Obsidian Live Preview, **Widget** replaces marker visually (edit-safe)
4. During build, **Quartz Transformer** detects **Marker** (reads underlying HTML comment)
5. **Keyword Tripwire** also checked (implicit markers)
6. Malformed markers generate **Build Warning**
7. Properly formed markers filter content based on publish mode

**Key Insight**: Widget is a view-layer entity only. Quartz never sees widgets - it only processes the underlying HTML comments in the markdown file.

---

## Validation Rules Summary

| Entity | Rule | Violation Behavior |
|--------|------|-------------------|
| Inline Marker | Must be at line end | Ignored, content treated as unmarked |
| Block Marker | Must be on own line | Ignored, content treated as unmarked |
| Block Marker | Must have matching begin/end | File skipped, warning generated |
| Marker | Cannot span frontmatter boundary | Frontmatter never filtered |
| Keyword Tripwire | Case-insensitive match | Applies even to partial matches (e.g., "JuUdEn") |
| Nested Blocks | Inner marker precedence | Most restrictive wins |

---

## Performance Considerations

**Editor Commands:**
- Target: <100ms response time (SC-001, SC-002)
- Operation: O(n) where n = line length (small, typically <200 chars)
- No async operations needed

**Quartz Transformer:**
- Target: Process 1000+ files without slowdown
- Operation: O(m * n) where m = files, n = lines per file
- Single-pass line-by-line processing
- No file I/O during transformation (operates on in-memory strings)

**Build Warnings:**
- File I/O only if warnings exist
- One write per build cycle
- Size: Typically <10KB (assuming <100 warnings)

---

## Testing Considerations

**Entity-Level Tests:**
1. **Marker Detection**: Unit tests for regex patterns
2. **Toggle Logic**: Unit tests for selection detection and marker insertion/removal
3. **Precedence Rules**: Unit tests for nested markers and tripwire interactions
4. **Build Warnings**: Unit tests for warning collection and HTML generation

**Integration Tests:**
1. End-to-end: Create marker in Obsidian → Build with Quartz → Verify filtering
2. Cross-mode: Same file built in all 4 modes → Verify hierarchy
3. Edge cases: All scenarios from spec's "Edge Cases" section

---

## Future Extensibility

**Planned:**
- Topic-based filtering (already modeled, just needs flag enabled)

**Potential:**
- Additional keyword tripwires (e.g., multiple sensitive terms)
- Marker types beyond redact/no-render (e.g., "internal-only")
- Custom visibility rules per marker (e.g., `<!-- redact:shachu+trusted -->`)

**Not Planned:**
- Mid-word or inline-text markers (spec explicitly line/block granularity)
- Per-user visibility (constitutional hierarchical model only)
- Marker versioning or history (stateless system)
