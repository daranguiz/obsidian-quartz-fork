# Implementation Plan: Content Redaction Markers

**Branch**: `004-redaction-markers` | **Date**: 2025-11-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-redaction-markers/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature implements a code-comment-style redaction system with two marker types:
1. **Redact markers** (`<!-- redact -->` / block form) - hide content from public/trusted/shachu builds, visible in full build
2. **No-render markers** (`<!-- no-render -->` / block form) - hide content from ALL builds including full

**Technical Approach**:
- **Obsidian Plugin** (TypeScript): Native plugin providing two hotkey commands for editor integration
- **Quartz Filter Plugin** (TypeScript): Build-time content filtering based on publish mode and marker detection
- **Keyword Tripwire**: Automatic redaction for lines containing "Juuden" (case-insensitive)
- **Error Handling**: Malformed markers skip file and generate build-warnings.html

## Technical Context

**Language/Version**: TypeScript (targeting Obsidian plugin API + Quartz v4 Node.js runtime)
**Primary Dependencies**:
  - Obsidian Plugin API (obsidian.d.ts for editor commands)
  - Quartz v4 framework (existing filter plugin architecture)
  - Node.js fs module (for build-warnings.html generation)
**Storage**: N/A (stateless - processes markdown files during build, no persistent storage)
**Testing**: Jest (standard for TypeScript plugins) + manual testing across 4 publish modes
**Target Platform**:
  - Obsidian desktop app (Windows, macOS, Linux)
  - Node.js build environment (Cloudflare Pages)
**Project Type**: Dual-component (Obsidian plugin + Quartz filter plugin)
**Performance Goals**:
  - Editor: <100ms marker toggle response time (SC-001, SC-002)
  - Build: Process 1000+ markdown files without significant slowdown
**Constraints**:
  - Obsidian plugin must be 3 files: main.js, manifest.json, styles.css (clarification answer)
  - HTML comment syntax must be preserved through markdown parsing (ASM-001)
  - Must not break existing publish mode hierarchy (Constitution Principle III)
**Scale/Scope**:
  - ~1000 markdown files in vault (typical)
  - 2 editor commands (toggle redact, toggle no-render)
  - 1 Quartz filter plugin (redactionMarkers.ts)
  - 4 publish modes (full, trusted, shachu, public)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Single Source of Truth
**Status**: PASS - No impact
**Rationale**: This feature does not duplicate content. Markers are added to existing vault files, maintaining single source of truth.

### ✅ Principle II: Clean Separation of Concerns
**Status**: PASS - Compliant
**Rationale**: Obsidian plugin lives in `.obsidian/plugins/` (user-facing tool), Quartz filter plugin lives in build repo (build tooling). Clean separation maintained.

### ✅ Principle III: Hierarchical Access Control
**Status**: PASS - Extends hierarchy
**Rationale**:
- Redact markers respect existing hierarchy (hidden from public/trusted/shachu, visible in full)
- No-render markers add new capability (hidden from ALL tiers) without breaking hierarchy
- "Juuden" tripwire acts as implicit redact marker, respecting same hierarchy
- Topic-based filtering (when enabled) completely excludes files, still respects tier system

### ✅ Principle IV: Frontmatter-Driven Publishing
**Status**: PASS - Complementary
**Rationale**: This feature uses HTML comments (inline markers) rather than frontmatter. This is complementary, not conflicting:
- Frontmatter controls note-level visibility (`publish` field)
- Markers control line/block-level visibility within notes
- Both mechanisms can coexist and operate independently

### ✅ Principle V: Documentation as Living System
**Status**: PASS - Compliance plan in place
**Rationale**: Plan includes updating ARCHITECTURE.md with:
- How redaction markers work (filter plugin logic)
- How Juuden tripwire operates (keyword detection)
- How build-warnings.html is generated
- Integration with existing publish mode system

### ✅ Principle VI: Defense in Depth
**Status**: PASS - Single-layer enforcement justified
**Rationale**: Markers are enforced at filter plugin layer (build-time). Unlike publish mode (which has multi-layer enforcement), markers are:
- Not frontmatter metadata (no component-level visibility needed)
- Not navigable content (no client-side filtering needed)
- Processing instructions removed at source (filter plugin)

Single-layer enforcement is appropriate for this security model. Malformed markers trigger warning + file exclusion (defense through fail-safe).

### ✅ Principle VII: Automated Deployment
**Status**: PASS - No impact
**Rationale**: No changes to deployment pipeline. Existing auto-rebuild triggers continue to work.

### Gate Decision: ✅ PROCEED TO PHASE 0

All constitutional gates pass. No complexity violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

This feature spans TWO repositories:

#### 1. Obsidian Vault (obsidian-vault-backup)

```text
.obsidian/plugins/redaction-markers/
├── main.js              # Compiled plugin code
├── manifest.json        # Plugin metadata (id, name, version, minAppVersion)
└── styles.css           # Optional styling (likely empty for this feature)

# Development source (if maintained separately):
.obsidian/plugins/redaction-markers-dev/
├── main.ts              # TypeScript source
├── manifest.json        # Same as above
├── package.json         # Build dependencies (esbuild, typescript, @types/node)
└── tsconfig.json        # TypeScript configuration
```

#### 2. Quartz Build Repo (obsidian-quartz-fork)

```text
quartz/plugins/transformers/
├── redactionMarkers.ts   # NEW: Transformer plugin for marker detection
├── hideInBuild.ts        # REMOVED: Legacy system being replaced
├── publishMode.ts        # EXISTING: Tier-based filtering (reference)
└── index.ts              # MODIFIED: Export redactionMarkers, remove HideInBuild

quartz/util/
└── buildWarnings.ts      # NEW: Helper for generating build-warnings.html

public/                   # Build output directory
└── build-warnings.html   # GENERATED: Error report (if markers malformed)

docs-custom/
├── ARCHITECTURE.md       # MODIFIED: Document new transformer, note hideInBuild removal
└── CLAUDE.md            # MODIFIED: Note hideInBuild deprecation

specs/004-redaction-markers/
├── migration.md          # NEW: Guide for migrating hideInBuild → redaction markers
└── styling.md            # NEW: Visual styling guide for Obsidian Live Preview

quartz.config.ts          # MODIFIED: Replace HideInBuild with RedactionMarkers
```

**Structure Decision**: Dual-repository approach required by existing architecture:
- User-facing tool (Obsidian plugin) lives in vault repository
- Build-time processing (Quartz filter) lives in build repository
- This maintains clean separation per Constitution Principle II

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations. This section intentionally left empty.

---

## Implementation Phases

### Phase 0: Research & Design ✅ COMPLETE

**Outputs**: research.md, data-model.md, quickstart.md, migration.md, styling.md

**Key Findings**:
- Use **Transformer plugin** (not Filter) for line/block granularity
- Follow `HideInBuild.ts` pattern for text transformation
- Replace existing hideInBuild system in same PR
- Visual styling via atomic widgets (edit-safe) with gutter mode spec'd for future

---

### Phase 1: Core Transformer (Build-Time Filtering)

**Priority**: P1 (Must have)
**Estimated Effort**: ~200-300 lines of code

#### Tasks

1. **Create redactionMarkers.ts transformer**
   - File: `quartz/plugins/transformers/redactionMarkers.ts`
   - Implements: `QuartzTransformerPlugin` with `textTransform()` method
   - Logic:
     - Line-by-line processing with state machine for block tracking
     - Regex detection for all marker types (inline + block)
     - Publish mode awareness via `process.env.QUARTZ_PUBLISH_MODE`
     - Juuden keyword tripwire (case-insensitive)
     - Topic-based filtering (config flag, disabled by default)
   - Error handling: Malformed markers → collect warnings
   - Returns: Filtered markdown string

2. **Create buildWarnings.ts utility**
   - File: `quartz/util/buildWarnings.ts`
   - Functions:
     - `collectWarning(filePath, error, lineNumber, details)`
     - `generateWarningsReport()` → writes `public/build-warnings.html`
   - HTML format: Simple list with file paths, line numbers, error descriptions

3. **Export transformer**
   - File: `quartz/plugins/transformers/index.ts`
   - Add: `export { RedactionMarkers } from "./redactionMarkers"`
   - Remove: `export { HideInBuild } from "./hideInBuild"`

4. **Update quartz.config.ts**
   - Replace: `Plugin.HideInBuild()` → `Plugin.RedactionMarkers()`
   - Order: After `FrontMatter`, before markdown parsing transformers

5. **Delete hideInBuild.ts**
   - File: `quartz/plugins/transformers/hideInBuild.ts`
   - Action: `git rm` (preserve in git history)

6. **Unit tests**
   - Test all regex patterns
   - Test precedence rules (no-render > redact > Juuden)
   - Test block nesting
   - Test malformed marker detection
   - Test all 4 publish modes

#### Acceptance Criteria

- [ ] Inline redact markers filtered correctly in public/trusted/shachu, visible in full
- [ ] Inline no-render markers filtered in ALL modes
- [ ] Block markers work identically to inline
- [ ] Juuden keyword triggers redaction
- [ ] Malformed markers generate build-warnings.html
- [ ] All hideInBuild functionality replaced
- [ ] Builds succeed without errors

---

### Phase 2: Obsidian Plugin (Editor Integration)

**Priority**: P1 (Must have)
**Estimated Effort**: ~300-400 lines of code

#### Tasks

1. **Plugin scaffold**
   - Directory: `.obsidian/plugins/redaction-markers-dev/`
   - Files: `main.ts`, `manifest.json`, `package.json`, `tsconfig.json`, `styles.css`
   - Build: esbuild configuration
   - Dependencies: `obsidian`, `@codemirror/view`, `@codemirror/state`

2. **Implement toggle commands**
   - Command 1: `toggle-redact` → inserts/removes `<!-- redact -->` markers
   - Command 2: `toggle-no-render` → inserts/removes `<!-- no-render -->` markers
   - Logic:
     - Detect cursor position vs selection
     - Inline form: no selection → append to line end
     - Block form: with selection → wrap with begin/end on own lines
     - Toggle off: detect existing markers, remove them
     - Selection flexibility: handle partial overlaps

3. **Implement marker detection**
   - Functions:
     - `hasInlineMarker(line, markerType)` → boolean
     - `hasBlockMarkers(editor, markerType)` → {hasBegin, hasEnd, range}
     - `removeInlineMarker(editor, line)`
     - `removeBlockMarkers(editor, range)`

4. **Implement marker insertion**
   - Functions:
     - `insertInlineMarker(editor, markerType)`
     - `insertBlockMarkers(editor, selection, markerType)`
   - Use `Editor.replaceRange()` for all insertions

5. **Register commands**
   - Use `addCommand()` with `editorCallback` pattern
   - Name: User-friendly names for command palette
   - Hotkeys: User-configurable (no defaults)

6. **Build & deployment**
   - Script: `npm run dev` for watch mode
   - Output: `main.js` (compiled), `manifest.json`, `styles.css`
   - Copy to: `.obsidian/plugins/redaction-markers/`

#### Acceptance Criteria

- [ ] Hotkeys toggle markers on/off
- [ ] Inline markers append to line end
- [ ] Block markers wrap selection on own lines
- [ ] Toggle-off works for any selection combination
- [ ] Commands appear in command palette
- [ ] Plugin loads without errors

---

### Phase 3: Visual Styling (Live Preview Enhancement)

**Priority**: P2 (Should have for Phase 1, nice-to-have for Phase 2 spec'd)
**Estimated Effort**: ~150-200 lines (Atomic Widgets), +100 lines (Gutter mode - future)

#### Atomic Widget Implementation (P1 - Edit-Safe Markers)

**Key Decision**: Use `Decoration.replace()` with atomic widgets to prevent accidental editing of marker syntax.

1. **Create WidgetType classes**
   - File: `main.ts` (within plugin)
   - Classes:
     - `RedactMarkerWidget extends WidgetType`
     - `BlockMarkerWidget extends WidgetType`
   - Implementation:
     ```typescript
     class RedactMarkerWidget extends WidgetType {
       constructor(readonly type: 'redact' | 'no-render') {}

       toDOM() {
         const badge = document.createElement("span")
         badge.className = `redaction-widget ${this.type}-widget`
         badge.contentEditable = "false"  // Key: non-editable

         const icon = this.type === 'redact' ? '🔒' : '❌'
         const label = this.type === 'redact' ? 'REDACT' : 'HIDDEN'
         badge.textContent = `${icon} ${label}`

         return badge
       }

       eq(other: RedactMarkerWidget) {
         return other.type === this.type
       }

       ignoreEvent() { return false }  // Makes widget atomic
     }
     ```

2. **Create ViewPlugin for widget replacement**
   - Plugin: `markerWidgetPlugin extends ViewPlugin`
   - Method: `buildDecorations(view)` → scans for HTML comments, replaces with widgets
   - Pattern:
     ```typescript
     // Detect HTML comments
     const redactRegex = /<!--\s*redact\s*-->/g
     const noRenderRegex = /<!--\s*no-render\s*-->/g

     // Replace with widgets
     builder.add(
       commentStart,
       commentEnd,
       Decoration.replace({
         widget: new RedactMarkerWidget('redact'),
         inclusive: false,  // Don't capture adjacent text
         block: false       // Inline widget
       })
     )
     ```
   - Handle both inline markers and block markers (begin/end)

3. **Define widget styles**
   - CSS in `styles.css`:
     ```css
     .redaction-widget {
       display: inline-block;
       font-size: 0.7em;
       font-family: var(--font-monospace);
       padding: 2px 6px;
       border-radius: 4px;
       margin-left: 4px;
       opacity: 0.7;
       transition: opacity 0.2s ease;
       cursor: default;
       user-select: none;
       vertical-align: middle;
     }

     .redact-widget {
       background-color: rgba(255, 165, 0, 0.2);
       color: #ff8c00;
       border: 1px solid rgba(255, 140, 0, 0.4);
     }

     .no-render-widget {
       background-color: rgba(220, 20, 60, 0.2);
       color: #dc143c;
       border: 1px solid rgba(220, 20, 60, 0.4);
     }

     .redaction-widget:hover {
       opacity: 1;
       transform: translateY(-1px);
     }
     ```
   - Dark theme variants

4. **Register editor extension**
   - In `plugin.onload()`:
     ```typescript
     this.registerEditorExtension(markerWidgetPlugin)
     ```

**Edit-Safety Features:**
- Widget is non-editable (`contentEditable="false"`)
- Acts as atomic unit (can't cursor into it)
- Deleting widget removes underlying HTML comment
- Widget stays at line end even when editing line text
- Cannot accidentally type in middle of marker syntax

#### Gutter Mode (P2 Spec - Future Enhancement)

1. **Create gutter marker class**
   - Class: `RedactGutterMarker extends GutterMarker`
   - Method: `toDOM()` → returns icon element
   - Icons: 🔒 for redact, ❌ for no-render, visual variants for block begin/end

2. **Define gutter extension**
   - Function: `redactionGutter()` using `gutter()` API
   - Scan lines for markers, return `RangeSet<GutterMarker>`

3. **CSS for gutter**
   - Class: `redact-gutter-icon`, `no-render-gutter-icon`
   - Styling: Icon size, colors, alignment

4. **Make it optional**
   - Settings panel (future): Toggle gutter vs inline widget display
   - Default: Inline widgets (better for block markers)

#### Acceptance Criteria

- [ ] HTML comments replaced with atomic widgets in Live Preview
- [ ] Widgets are non-editable and act as single units
- [ ] Redact and no-render widgets use different colors/icons
- [ ] Widgets are smaller and less intrusive than raw HTML comments
- [ ] Hover increases visibility
- [ ] Deleting widget removes underlying HTML comment from markdown
- [ ] Cannot cursor into widget (edit-safe)
- [ ] Widget position stable during line editing
- [ ] Works in both light and dark themes
- [ ] No performance degradation with 100+ markers per file

---

#### Future Enhancement: Gutter Mode Spec

- [ ] Gutter icons appear for marked lines
- [ ] Icons distinguishable by type
- [ ] Configurable via settings (inline vs gutter vs both)

---

### Phase 4: Documentation & Testing

**Priority**: P1 (Must have)
**Estimated Effort**: ~2-3 hours

#### Tasks

1. **Update ARCHITECTURE.md**
   - Add section: "Content Redaction Markers"
   - Subsections:
     - How redactionMarkers transformer works
     - Marker syntax and precedence rules
     - Juuden keyword tripwire
     - Build warnings system
     - Integration with publish mode hierarchy
   - Note: hideInBuild removal and migration path

2. **Update CLAUDE.md**
   - Note hideInBuild deprecation
   - Add redactionMarkers to plugin list
   - Document where to find marker logic

3. **Integration testing**
   - Create test vault with all marker types
   - Build in all 4 modes
   - Verify filtering correctness
   - Test all edge cases from spec
   - Check build-warnings.html generation

4. **User testing**
   - Install plugin in actual vault
   - Test hotkeys for 1 week of normal use
   - Identify any UX issues
   - Adjust styling based on real usage

#### Acceptance Criteria

- [ ] ARCHITECTURE.md updated
- [ ] CLAUDE.md updated
- [ ] All edge cases tested and passing
- [ ] Build warnings work correctly
- [ ] No regressions in existing publish mode functionality
- [ ] Plugin usable for daily note-taking

---

## Migration Plan (hideInBuild → Redaction Markers)

### Vault-Side Migration (User Responsibility)

**Before implementation**:
1. Audit vault for hideInBuild usage: `grep -r "hide-in-build" --include="*.md"`
2. Count instances to estimate migration effort

**After Quartz implementation**:
1. Run migration script (provided in migration.md)
2. Replace `<!-- hide-in-build -->` → `<!-- redact-begin -->`
3. Replace `<!-- /hide-in-build -->` → `<!-- redact-end -->`
4. Test builds in all modes
5. Fix any warnings in build-warnings.html

**Rollback**: Backups created automatically (`.md.backup` files)

### Quartz-Side Changes (This PR)

**Removed**:
- `quartz/plugins/transformers/hideInBuild.ts` (deleted)
- `Plugin.HideInBuild()` from `quartz.config.ts` (removed)
- Export from `quartz/plugins/transformers/index.ts` (removed)

**Added**:
- `quartz/plugins/transformers/redactionMarkers.ts` (new)
- `quartz/util/buildWarnings.ts` (new)
- `Plugin.RedactionMarkers()` in `quartz.config.ts` (new)

**Testing**:
- Verify no references to hideInBuild remain
- Confirm builds work with new transformer
- Test that old hideInBuild markers no longer work (expected)

---

## Risk Assessment

### Low Risk
- ✅ Transformer pattern proven (HideInBuild reference)
- ✅ Editor API stable since Obsidian 0.15.0
- ✅ No new dependencies beyond Obsidian API
- ✅ Constitutional gates all pass

### Medium Risk
- ⚠️ **CodeMirror 6 decorations**: First time using in this project
  - Mitigation: Simple use case, well-documented API
- ⚠️ **hideInBuild migration**: User must update content
  - Mitigation: Provide migration script + clear documentation

### Mitigated
- ~~Filter vs Transformer confusion~~ → Research clarified: use Transformer
- ~~Styling complexity~~ → Atomic widgets solve edit-safety, gutter mode deferred to future
- ~~Marker edit-safety~~ → Atomic widgets prevent accidental mangling during text editing

---

## Success Metrics

- Build time: No more than +10% overhead for 1000-file vault
- Editor response: <100ms marker toggle (SC-001, SC-002)
- Accuracy: 100% filtering correctness across all modes (SC-003, SC-004)
- Adoption: User prefers new markers over old hideInBuild system
- Visual quality: Markers less intrusive than default comments (SC-012)

---

## Next Steps

This planning document is complete. Proceed to:

```
/speckit.tasks
```

This will generate dependency-ordered implementation tasks in `tasks.md`.
