# Quickstart: Content Redaction Markers

**Feature**: 004-redaction-markers
**Last Updated**: 2025-11-01

This guide helps you get started with using and testing the Content Redaction Markers feature.

---

## For End Users (Obsidian Plugin)

### Installation

1. **Locate plugin directory** in your vault:
   ```
   /path/to/your/vault/.obsidian/plugins/redaction-markers/
   ```

2. **Copy plugin files**:
   - `main.js`
   - `manifest.json`
   - `styles.css`

3. **Enable plugin** in Obsidian:
   - Settings → Community Plugins → Enable "Redaction Markers"

### Basic Usage

#### Marking a Single Line

1. Place cursor on the line you want to hide
2. Press your configured hotkey (or use Command Palette)
   - **Toggle Redact**: Hides from public/trusted/shachu (visible in full)
   - **Toggle No-Render**: Hides from ALL builds

**Before:**
```markdown
This is public content.
This is sensitive content.
```

**After** (cursor on line 2, press redact hotkey):
```markdown
This is public content.
This is sensitive content. <!-- redact -->
```

#### Marking Multiple Lines (Block)

1. Select the lines/paragraphs you want to hide
2. Press your configured hotkey

**Before:**
```markdown
Public intro paragraph.

Confidential section with
multiple lines that should
be hidden from lower tiers.

Public conclusion.
```

**After** (select middle paragraph, press redact hotkey):
```markdown
Public intro paragraph.

<!-- redact-begin -->
Confidential section with
multiple lines that should
be hidden from lower tiers.
<!-- redact-end -->

Public conclusion.
```

#### Removing Markers (Toggle Off)

Simply press the same hotkey again on marked content:
- **Line marker**: Cursor anywhere on the line
- **Block marker**: Select any part of the content (or the markers themselves)

The system intelligently detects and removes markers regardless of what you select.

### Configuring Hotkeys

1. Go to: Settings → Hotkeys
2. Search for: "Toggle redaction marker" or "Toggle no-render marker"
3. Click the (+) icon to add your preferred key combination
4. Recommended:
   - Redact: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - No-Render: `Ctrl+Shift+N` (Windows/Linux) or `Cmd+Shift+N` (Mac)

---

## For Developers (Testing & Building)

### Prerequisites

- Node.js 18+ (check with `node --version`)
- npm or yarn
- Existing Quartz build environment

### Quick Test Setup

#### 1. Test Content Creation

Create test files in your vault:

**test-redact.md:**
```markdown
---
title: "Redaction Test"
---

Public line.
Private line. <!-- redact -->

<!-- redact-begin -->
Private block
with multiple lines.
<!-- redact-end -->

Public conclusion.
```

**test-no-render.md:**
```markdown
---
title: "No-Render Test"
---

Visible content.
Broken dataview query below. <!-- no-render -->

<!-- no-render-begin -->
```dataview
MALFORMED QUERY HERE
```
<!-- no-render-end -->

More visible content.
```

**test-juuden.md:**
```markdown
---
title: "Keyword Tripwire Test"
---

This is public.
This mentions Juuden and should be hidden.
This is also public.
```

#### 2. Build & Verify

Test all four publish modes:

```bash
# Full mode (all content visible except no-render)
npx quartz build --publish-mode full --serve
# Visit http://localhost:8080
# Expected: Redact markers visible, no-render hidden, Juuden visible

# Public mode (most restrictive)
npx quartz build --publish-mode public --serve
# Expected: Redact markers hidden, no-render hidden, Juuden hidden

# Trusted mode
npx quartz build --publish-mode trusted --serve
# Expected: Same as public (unless content marked [[Trusted]])

# Shachu mode
npx quartz build --publish-mode shachu --serve
# Expected: Same as public (unless content marked [[Shachu]])
```

#### 3. Check Build Warnings

If you create malformed markers:

```markdown
<!-- redact-begin -->
Content here but no end tag...
```

Check for warnings file:
```bash
cat public/build-warnings.html
```

### Development Workflow

#### Obsidian Plugin Development

1. **Setup project**:
   ```bash
   cd /path/to/vault/.obsidian/plugins/redaction-markers-dev/
   npm install
   ```

2. **Watch mode** (auto-rebuild on changes):
   ```bash
   npm run dev
   ```

3. **Copy to plugin folder** after building:
   ```bash
   cp main.js manifest.json styles.css ../redaction-markers/
   ```

4. **Reload Obsidian**:
   - Ctrl+R (Windows/Linux) or Cmd+R (Mac)
   - Or: Settings → Community Plugins → Reload

#### Quartz Transformer Development

1. **Edit transformer**:
   ```bash
   cd /Users/dario/git/obsidian-quartz-fork
   code quartz/plugins/transformers/redactionMarkers.ts
   ```

2. **Run tests** (if using Jest):
   ```bash
   npm test -- redactionMarkers
   ```

3. **Test build**:
   ```bash
   npx quartz build --publish-mode full
   ```

4. **Check output**:
   ```bash
   # Verify marker was filtered
   cat public/test-redact/index.html | grep -i "private"

   # Should NOT appear in public mode
   npx quartz build --publish-mode public
   cat public/test-redact/index.html | grep -i "private"
   # (Should return empty)
   ```

### Testing Checklist

Use this checklist to verify all acceptance scenarios:

**User Story 1: Line-Level Redaction**
- [ ] Append marker to unmarked line
- [ ] Remove marker from marked line
- [ ] Content filtered in public mode
- [ ] Content visible in full mode

**User Story 2: Line-Level No-Render**
- [ ] Append marker to unmarked line
- [ ] Remove marker from marked line
- [ ] Content filtered in ALL modes (including full)

**User Story 3: Block-Level Redaction**
- [ ] Wrap selection with block markers
- [ ] Remove block markers when toggling
- [ ] Content filtered in public mode
- [ ] Content visible in full mode

**User Story 4: Block-Level No-Render**
- [ ] Wrap selection with block markers
- [ ] Remove block markers when toggling
- [ ] Content filtered in ALL modes

**User Story 5: Toggle Cycling**
- [ ] Double-press cycles: none → marker → none
- [ ] Works for both inline and block forms

**Edge Cases**
- [ ] Partial selection still removes markers
- [ ] Selecting just markers removes them
- [ ] Nested markers (no-render wins)
- [ ] Malformed markers skip file + warning
- [ ] "Juuden" keyword filtered in non-full modes
- [ ] "Juuden" keyword visible in full mode

---

## Troubleshooting

### Plugin Not Appearing

**Problem**: Plugin doesn't show in Community Plugins list

**Solutions**:
1. Check `manifest.json` has correct format:
   ```json
   {
     "id": "redaction-markers",
     "name": "Redaction Markers",
     "version": "1.0.0",
     "minAppVersion": "0.15.0"
   }
   ```
2. Restart Obsidian completely (not just reload)
3. Check console for errors: View → Toggle Developer Tools

### Hotkeys Not Working

**Problem**: Pressing hotkey does nothing

**Solutions**:
1. Verify hotkey is assigned: Settings → Hotkeys
2. Check for conflicts with other plugins
3. Make sure editor is focused (not settings panel)
4. Try via Command Palette first (Ctrl+P / Cmd+P)

### Markers Not Filtering During Build

**Problem**: Content still appears in public build

**Solutions**:
1. Verify marker syntax is exact:
   - Inline: `<!-- redact -->` (spaces matter!)
   - Block: Must be on own lines
2. Check `quartz.config.ts` includes transformer:
   ```typescript
   transformers: [
     // ...
     Plugin.RedactionMarkers(),
     // ...
   ]
   ```
3. Check execution order (should be after FrontMatter, before markdown parsing)
4. Look for build warnings: `cat public/build-warnings.html`

### Build Warnings Not Generating

**Problem**: Malformed markers don't produce warnings file

**Solutions**:
1. Check `buildWarnings.ts` utility is imported correctly
2. Verify `public/` directory exists and is writable
3. Check console output during build for error messages
4. Ensure at least one warning was collected (file only created if warnings exist)

---

## Performance Benchmarks

Expected performance targets:

**Editor Operations**:
- Marker toggle: <100ms (SC-001, SC-002)
- Block marker insertion: <200ms for 50-line selection

**Build Operations** (1000 files):
- Transformation overhead: <5 seconds additional
- Memory usage: No significant increase (<50MB extra)

If you observe slower performance:
1. Check for nested loops in transformer code
2. Profile with Node.js profiler: `node --prof`
3. Verify regex patterns are efficient (no catastrophic backtracking)

---

## Next Steps

1. **Test thoroughly** with your actual vault content
2. **Configure hotkeys** to your preference
3. **Document any issues** for future reference
4. **Update ARCHITECTURE.md** with findings

For implementation details, see:
- [spec.md](spec.md) - Full feature specification
- [plan.md](plan.md) - Implementation plan
- [data-model.md](data-model.md) - Entity relationships
- [research.md](research.md) - Technical research findings

---

## Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Review build logs in terminal
3. Check browser console (for Quartz output)
4. Check Obsidian developer console (for plugin issues)
5. Verify all prerequisites are met

**Common Gotchas**:
- Marker syntax must be exact (including spaces)
- Block markers MUST be on their own lines
- Selection can include markers when toggling off
- Malformed markers fail-safe (exclude file, warn)
