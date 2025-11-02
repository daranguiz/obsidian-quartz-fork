# Obsidian Styling Guide: Redaction Markers

**Feature**: 004-redaction-markers
**Date**: 2025-11-01

## Problem Statement

In Obsidian's **Live Preview mode**, HTML comments are rendered inline, making redaction markers visually cluttered:

**Current appearance**:
```
This is normal text. <!-- redact --> ← Ugly gray comment visible
```

**Goal**: Style markers to be:
- Less visually intrusive
- Color-coded by type (redact vs no-render)
- Small and compact
- Clearly distinguishable from normal content

---

## Solution: Atomic Widgets (Edit-Safe Markers)

### Core Approach: CodeMirror Widgets

Instead of styling HTML comments directly, we replace them with **atomic widgets** in the editor view. This makes markers:
- ✅ **Edit-safe**: Can't accidentally type in the middle of marker syntax
- ✅ **Visually clean**: Appears as a styled badge, not raw HTML
- ✅ **Portable**: Underlying markdown still contains `<!-- redact -->` comment
- ✅ **Non-intrusive**: Widget acts as a single character at line end

### Approach 1 (RECOMMENDED): Atomic Widgets

**How it works**:
1. User toggles marker → Plugin inserts `<!-- redact -->` in markdown
2. In Live Preview, plugin detects comment → replaces with widget badge
3. User edits line → Widget stays at end, can't cursor into it
4. User saves → Widget persists as `<!-- redact -->` in markdown file
5. Build system reads markdown → Sees normal HTML comment

**Implementation**:

```typescript
// Define widget classes
class RedactMarkerWidget extends WidgetType {
  constructor(readonly type: 'redact' | 'no-render') {}

  toDOM() {
    const badge = document.createElement("span")
    badge.className = `redaction-widget ${this.type}-widget`
    badge.contentEditable = "false" // Cannot edit into it

    // Add icon + text
    const icon = this.type === 'redact' ? '🔒' : '❌'
    const label = this.type === 'redact' ? 'REDACT' : 'HIDDEN'
    badge.textContent = `${icon} ${label}`

    return badge
  }

  // Required for widget comparison/updates
  eq(other: RedactMarkerWidget) {
    return other.type === this.type
  }

  // Makes widget atomic (treated as single character)
  ignoreEvent() { return false }
}

// ViewPlugin to detect comments and replace with widgets
const markerWidgetPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()

    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to)

      // Match inline markers and replace with widgets
      const redactRegex = /<!--\s*redact\s*-->/g
      let match
      while ((match = redactRegex.exec(text)) !== null) {
        const start = from + match.index
        const end = start + match[0].length

        // Replace the HTML comment with a widget
        builder.add(
          start,
          end,
          Decoration.replace({
            widget: new RedactMarkerWidget('redact'),
            inclusive: false,
            block: false
          })
        )
      }

      // Same for no-render
      const noRenderRegex = /<!--\s*no-render\s*-->/g
      while ((match = noRenderRegex.exec(text)) !== null) {
        const start = from + match.index
        const end = start + match[0].length
        builder.add(
          start,
          end,
          Decoration.replace({
            widget: new RedactMarkerWidget('no-render'),
            inclusive: false,
            block: false
          })
        )
      }
    }

    return builder.finish()
  }
}, {
  decorations: v => v.decorations
})
```

**CSS Styling** (in styles.css):

```css
/* Base widget styling */
.redaction-widget {
  display: inline-block;
  font-size: 0.7em;
  font-family: var(--font-monospace);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease, transform 0.2s ease;
  cursor: default;
  user-select: none; /* Can't select text inside widget */
  vertical-align: middle;
}

/* Redact widget - orange/amber theme */
.redact-widget {
  background-color: rgba(255, 165, 0, 0.2);
  color: #ff8c00;
  border: 1px solid rgba(255, 140, 0, 0.4);
}

/* No-render widget - red theme */
.no-render-widget {
  background-color: rgba(220, 20, 60, 0.2);
  color: #dc143c;
  border: 1px solid rgba(220, 20, 60, 0.4);
}

/* Hover effect */
.redaction-widget:hover {
  opacity: 1;
  transform: translateY(-1px);
}

/* Dark theme adjustments */
.theme-dark .redact-widget {
  background-color: rgba(255, 165, 0, 0.3);
  color: #ffb347;
  border-color: rgba(255, 179, 71, 0.5);
}

.theme-dark .no-render-widget {
  background-color: rgba(220, 20, 60, 0.3);
  color: #ff6b8a;
  border-color: rgba(255, 107, 138, 0.5);
}
```

**Key Features**:
- `Decoration.replace()` removes HTML comment, inserts widget
- Widget is non-editable (`contentEditable = "false"`)
- Acts as atomic unit (can't cursor into it)
- Backspace deletes entire widget (which removes marker)
- Underlying markdown unchanged (still has `<!-- redact -->`)

---

### Block Markers: Two-Widget Approach

For block markers, use **two separate widgets** for begin/end:

```typescript
class BlockMarkerWidget extends WidgetType {
  constructor(
    readonly type: 'redact' | 'no-render',
    readonly position: 'begin' | 'end'
  ) {}

  toDOM() {
    const badge = document.createElement("span")
    badge.className = `block-marker-widget ${this.type}-block ${this.position}`
    badge.contentEditable = "false"

    const icon = this.type === 'redact' ? '🔒' : '❌'
    const label = this.position === 'begin' ? 'BEGIN' : 'END'
    badge.textContent = `${icon} ${this.type.toUpperCase()} ${label}`

    return badge
  }

  eq(other: BlockMarkerWidget) {
    return other.type === this.type && other.position === this.position
  }
}
```

**Visual result**:

```
Normal text here.

🔒 REDACT BEGIN
Block content line 1
Block content line 2
🔒 REDACT END

More normal text.
```

---

### Fallback: CSS-Only Styling (No Widget Protection)

The plugin can add **decorations** to comment markers using CodeMirror 6 API.

**In main.ts**:

```typescript
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state"

// Define marker decoration styles
const redactMarkerDecoration = Decoration.mark({
  class: "redaction-marker redact-marker",
  attributes: { "data-marker-type": "redact" }
})

const noRenderMarkerDecoration = Decoration.mark({
  class: "redaction-marker norender-marker",
  attributes: { "data-marker-type": "no-render" }
})

// ViewPlugin to detect and decorate markers
const redactionMarkerPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()

    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to)

      // Match redact markers
      const redactRegex = /<!--\s*(redact(?:-begin|-end)?)\s*-->/g
      let match
      while ((match = redactRegex.exec(text)) !== null) {
        const start = from + match.index
        const end = start + match[0].length
        builder.add(start, end, redactMarkerDecoration)
      }

      // Match no-render markers
      const noRenderRegex = /<!--\s*(no-render(?:-begin|-end)?)\s*-->/g
      while ((match = noRenderRegex.exec(text)) !== null) {
        const start = from + match.index
        const end = start + match[0].length
        builder.add(start, end, noRenderMarkerDecoration)
      }
    }

    return builder.finish()
  }
}, {
  decorations: v => v.decorations
})
```

**In styles.css**:

```css
/* Base marker styling */
.redaction-marker {
  font-size: 0.75em;
  font-family: var(--font-monospace);
  padding: 1px 6px;
  border-radius: 3px;
  margin: 0 2px;
  opacity: 0.7;
  transition: opacity 0.2s ease, transform 0.2s ease;
  display: inline-block;
  vertical-align: middle;
}

/* Redact marker - amber/orange theme */
.redact-marker {
  background-color: rgba(255, 165, 0, 0.15);
  color: #ff8c00;
  border: 1px solid rgba(255, 140, 0, 0.3);
}

/* No-render marker - red theme */
.norender-marker {
  background-color: rgba(220, 20, 60, 0.15);
  color: #dc143c;
  border: 1px solid rgba(220, 20, 60, 0.3);
}

/* Hover states */
.redaction-marker:hover {
  opacity: 1;
  transform: translateY(-1px);
}

/* Dark theme adjustments */
.theme-dark .redact-marker {
  background-color: rgba(255, 165, 0, 0.25);
  color: #ffb347;
  border-color: rgba(255, 179, 71, 0.4);
}

.theme-dark .norender-marker {
  background-color: rgba(220, 20, 60, 0.25);
  color: #ff6b8a;
  border-color: rgba(255, 107, 138, 0.4);
}

/* Compact mode for less intrusion */
.redaction-marker.compact {
  font-size: 0.6em;
  padding: 0px 4px;
  opacity: 0.5;
}

/* Optional: Icon-based markers (if using icon font) */
.redact-marker::before {
  content: "🔒";
  margin-right: 2px;
  opacity: 0.7;
}

.norender-marker::before {
  content: "❌";
  margin-right: 2px;
  opacity: 0.7;
}
```

---

## Recommended Approach: Plugin Decorations + User CSS

**Plugin provides**:
- CodeMirror decorations for precise marker detection
- Base CSS classes (`redact-marker`, `norender-marker`)
- Minimal default styling

**User can customize**:
- Colors and themes
- Size and opacity
- Icons or badges
- Animation effects

---

## Visual Examples

### Before Styling
```
Sensitive content about project X. <!-- redact -->
Broken query below. <!-- no-render -->
```

### After Styling (Compact)
```
Sensitive content about project X. [🔒 redact]
Broken query below. [❌ no-render]
```

### After Styling (Badge)
```
Sensitive content about project X. ⟨REDACT⟩
Broken query below. ⟨HIDDEN⟩
```

### After Styling (Minimal)
```
Sensitive content about project X. •
Broken query below. ✕
```

---

## Implementation Priority

**P1 (Must Have)**:
- Basic CodeMirror decoration to detect markers
- CSS classes applied to markers
- Default styles.css with minimal, non-intrusive styling

**P2 (Should Have)**:
- Color differentiation (redact vs no-render)
- Hover effects for better visibility
- Dark theme support

**P3 (Nice to Have)**:
- Icons or emoji prefixes
- User-configurable themes via settings
- Animation effects
- Compact/expanded toggle

---

## Testing Visual Styling

1. **Create test note** with various marker types:
   ```markdown
   Normal text. <!-- redact --> More normal text.

   Another line. <!-- no-render --> End of line.

   <!-- redact-begin -->
   Block content here.
   Multiple lines.
   <!-- redact-end -->
   ```

2. **View in Live Preview mode**
3. **Adjust CSS** in styles.css until satisfied
4. **Test in both light and dark themes**
5. **Test with different font sizes** (Settings → Appearance → Font size)

---

## User Customization Guide

Users who want custom styling can create a CSS snippet:

**Path**: `.obsidian/snippets/my-redaction-style.css`

**Example - Minimal style**:
```css
.redaction-marker {
  font-size: 0.5em;
  opacity: 0.3;
  color: gray;
}

.redaction-marker::before {
  content: "•";
  margin-right: 2px;
}
```

**Example - Badge style**:
```css
.redact-marker {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 12px;
}

.redact-marker::before {
  content: "REDACTED";
  font-size: 0.7em;
}
```

Then enable snippet in: Settings → Appearance → CSS snippets

---

## Alternative: Gutter Icons (Advanced)

For an even less intrusive approach, markers could appear as **gutter icons** (similar to line numbers):

```typescript
// Add gutter marker instead of inline decoration
const redactGutterMarker = new class extends GutterMarker {
  toDOM() {
    const icon = document.createElement("span")
    icon.textContent = "🔒"
    icon.className = "redact-gutter-icon"
    icon.setAttribute("aria-label", "Redacted line")
    return icon
  }
}
```

**Pros**:
- Completely non-intrusive to text flow
- Easy to scan vertically
- Can use color-coding or icons

**Cons**:
- Requires gutter extension
- Less obvious which exact text is marked
- Doesn't work well for inline markers

---

## Final Recommendation

**Phase 1 Implementation**:
1. Use CodeMirror decorations in plugin
2. Apply CSS classes to markers
3. Provide minimal default styling (small, slightly transparent)
4. Document how users can customize with CSS snippets

**Styling Defaults**:
- Font size: 70% of normal
- Opacity: 0.6 (60%)
- Color: Orange for redact, Red for no-render
- Border: Subtle 1px with transparency
- Hover: Increase opacity to 1.0

This balances visibility (so users know markers exist) with non-intrusiveness (so they don't dominate the view).

---

## Future Enhancement: Settings Panel

Could add plugin settings for:
- Enable/disable marker styling
- Choose color theme (preset options)
- Adjust marker size
- Toggle icons on/off
- Gutter vs inline display

But this is P3 - start with CSS-based approach first.
