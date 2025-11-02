# Feature Specification: Content Redaction Markers

**Feature Branch**: `004-redaction-markers`
**Created**: 2025-11-01
**Status**: Draft
**Input**: User description: "I want a 'code comment'-like way to mark sections of my notes as hidden. If I have nothing selected, it marks the whole line. If I select text, it should wrap the selected text. It should toggle back and forth like a code comment hotkey. It should be natively integrated into Obsidian (QuickAdd?). I should end up with two hotkeys: one for no-render and one for redact. Redact hides from everything except for the full build. No-render hides from literally everything, including the full build."

## Clarifications

### Session 2025-11-01

- Q: Should "Juuden" keyword matching be case-sensitive or case-insensitive? → A: Case-insensitive (matches all variations: Juuden, juuden, JUUDEN)
- Q: Should editor integration use a native Obsidian plugin or QuickAdd macro? → A: Native Obsidian plugin (provides robust hotkey support, direct Editor API access, simpler deployment as 3 files in .obsidian/plugins/)
- Q: Should topic-based filtering (filtering entire notes with "Juuden" as topic) be hard-coded disabled or configurable? → A: Configuration flag (simple boolean toggle in config file or code constant for future flexibility)
- Q: Where should block markers be placed when wrapping selected text? → A: Own lines (markers on separate lines before/after selection for clarity and easier detection)
- Q: How should toggle-off detect block markers when selection varies? → A: Remove markers if selection includes any combination of content/markers (content only, content+begin, content+end, both markers, markers only)
- Q: How should build handle malformed markers? → A: Log warning and skip file (continue build, exclude problematic file, generate build-warnings.html for visibility)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggling Line-Level Redaction (Priority: P1)

As a note writer, I want to quickly mark an entire line as redacted by pressing a hotkey with no text selected, so that I can hide sensitive content from lower-trust builds while keeping it visible in my full personal build.

**Why this priority**: This is the core functionality that delivers immediate value - the ability to hide content with a single keystroke, which is the primary use case.

**Independent Test**: Can be fully tested by placing cursor on a line, pressing the redact hotkey, and verifying the line is wrapped with `<!-- redact -->` marker and correctly filtered in non-full builds.

**Acceptance Scenarios**:

1. **Given** cursor is on a line with no redaction marker, **When** user presses redact hotkey, **Then** `<!-- redact -->` is appended to the end of the line
2. **Given** cursor is on a line already marked with `<!-- redact -->`, **When** user presses redact hotkey, **Then** the `<!-- redact -->` marker is removed from the line
3. **Given** cursor is on a line marked with `<!-- redact -->`, **When** Quartz builds in public/trusted/shachu mode, **Then** the line is excluded from the output
4. **Given** cursor is on a line marked with `<!-- redact -->`, **When** Quartz builds in full mode, **Then** the line is included in the output

---

### User Story 2 - Toggling Line-Level No-Render (Priority: P1)

As a note writer, I want to quickly mark an entire line as no-render by pressing a hotkey with no text selected, so that I can hide broken Dataview queries, scratch notes, and other content that should never appear in any published build.

**Why this priority**: This is equally critical as redaction - it addresses a different use case (hiding broken/temporary content) that is just as common.

**Independent Test**: Can be fully tested by placing cursor on a line, pressing the no-render hotkey, and verifying the line is wrapped with `<!-- no-render -->` marker and filtered from all builds including full.

**Acceptance Scenarios**:

1. **Given** cursor is on a line with no marker, **When** user presses no-render hotkey, **Then** `<!-- no-render -->` is appended to the end of the line
2. **Given** cursor is on a line marked with `<!-- no-render -->`, **When** user presses no-render hotkey, **Then** the marker is removed
3. **Given** cursor is on a line marked with `<!-- no-render -->`, **When** Quartz builds in any mode (full, trusted, shachu, public), **Then** the line is excluded from all outputs

---

### User Story 3 - Block-Level Redaction (Priority: P2)

As a note writer, I want to select multiple lines/paragraphs and mark them as redacted with a hotkey, so that I can hide entire sections of sensitive content without marking each line individually.

**Why this priority**: This is a natural extension of line-level redaction that significantly improves usability for larger content blocks, but the feature is still functional without it.

**Independent Test**: Can be fully tested by selecting multiple lines, pressing redact hotkey, and verifying the selection is wrapped with `<!-- redact-begin -->` and `<!-- redact-end -->` markers.

**Acceptance Scenarios**:

1. **Given** user has selected multiple lines with no redaction markers, **When** user presses redact hotkey, **Then** selection is wrapped with `<!-- redact-begin -->` on its own line before and `<!-- redact-end -->` on its own line after
2. **Given** user has selected a block already wrapped with redact markers, **When** user presses redact hotkey, **Then** the markers are removed
3. **Given** a block is wrapped with redact markers, **When** Quartz builds in non-full mode, **Then** all content between the markers is excluded
4. **Given** a block is wrapped with redact markers, **When** Quartz builds in full mode, **Then** all content between the markers is included (markers themselves are hidden)

---

### User Story 4 - Block-Level No-Render (Priority: P2)

As a note writer, I want to select multiple lines/paragraphs and mark them as no-render with a hotkey, so that I can hide entire sections of broken queries or scratch notes from all builds.

**Why this priority**: Complements block-level redaction for the no-render use case. Equal priority to Story 3.

**Independent Test**: Can be fully tested by selecting multiple lines, pressing no-render hotkey, and verifying the selection is wrapped with `<!-- no-render-begin -->` and `<!-- no-render-end -->` markers and filtered from all builds.

**Acceptance Scenarios**:

1. **Given** user has selected multiple lines with no markers, **When** user presses no-render hotkey, **Then** selection is wrapped with `<!-- no-render-begin -->` on its own line before and `<!-- no-render-end -->` on its own line after
2. **Given** user has selected a block wrapped with no-render markers, **When** user presses no-render hotkey, **Then** the markers are removed
3. **Given** a block is wrapped with no-render markers, **When** Quartz builds in any mode, **Then** all content between the markers is excluded from output

---

### User Story 5 - Toggle Cycling (Priority: P3)

As a note writer, I want repeated presses of the same hotkey to cycle through marker states, so that I can easily switch between unmarked, redact, and no-render states without needing separate "remove marker" commands.

**Why this priority**: This is a usability enhancement that makes the feature more intuitive, but the core functionality works without it.

**Independent Test**: Can be fully tested by repeatedly pressing a hotkey on the same content and verifying the cycling pattern: none → marker → none.

**Acceptance Scenarios**:

1. **Given** cursor on unmarked line, **When** user presses redact hotkey twice, **Then** line cycles: none → `<!-- redact -->` → none
2. **Given** cursor on unmarked line, **When** user presses no-render hotkey twice, **Then** line cycles: none → `<!-- no-render -->` → none
3. **Given** selected block with no markers, **When** user presses redact hotkey twice, **Then** selection cycles: none → block markers → none

---

### Edge Cases

#### Editor Behavior

- What happens when user selects text that partially overlaps existing markers? (Behavior: remove existing markers first, then apply new ones)
- What happens when a line has both inline text and a marker at the end? (Behavior: normal - marker applies to entire line)
- What happens when user tries to toggle on a partially selected line? (Behavior: treat as full-line selection if selection starts at line beginning or ends at line end)
- What happens when user toggles a marker on a line that already contains "Juuden"? (Behavior: explicit marker can be added/removed normally; both tripwire and marker apply during build)
- What happens when toggling off block markers with varying selection? (Behavior: markers removed if selection includes any of: content only, content+begin, content+end, both markers, or markers only)

#### Build-Time Filtering

- What happens when markers are nested (e.g., no-render inside redact block)? (Behavior: inner marker takes precedence - no-render wins over redact)
- What happens when user manually edits marker syntax incorrectly in the markdown? (Behavior: malformed markers are ignored, content treated as unmarked)
- What happens when markers span across frontmatter boundaries? (Behavior: markers only apply to content section, not frontmatter)
- What happens when a line contains both "Juuden" and an explicit `<!-- no-render -->` marker? (Behavior: no-render takes precedence, line is hidden from all builds including full)
- What happens when a line contains "Juuden" inside a code block or inline code? (Behavior: tripwire still applies - keyword matching is text-based, not semantic)
- What happens if "Juuden" appears as part of a URL or link text? (Behavior: tripwire still applies - all occurrences trigger filtering)
- What happens when "Juuden" appears in a nested block marker region with conflicting visibility? (Behavior: most restrictive rule wins - no-render > explicit redact > Juuden tripwire)

## Requirements *(mandatory)*

### Functional Requirements

#### Editor Integration

- **FR-001**: System MUST provide two separate hotkey commands: one for toggling redact markers and one for toggling no-render markers
- **FR-002**: System MUST append inline markers (`<!-- redact -->` or `<!-- no-render -->`) to the end of the current line when no text is selected
- **FR-003**: System MUST wrap selected text with block markers on separate lines (`<!-- redact-begin -->` and `<!-- redact-end -->` or `<!-- no-render-begin -->` and `<!-- no-render-end -->`) when text is selected, with markers placed on their own lines before and after the selection
- **FR-004**: System MUST remove markers when toggling on already-marked content (toggle off behavior), detecting block markers even when selection includes any combination of markers and content
- **FR-005**: System MUST integrate with Obsidian's hotkey system to allow user-configurable keyboard shortcuts
- **FR-006**: Editor commands MUST be implemented as a native Obsidian plugin for reliable hotkey support and direct Editor API access
- **FR-019**: Plugin MUST replace HTML comment markers with atomic widgets in Live Preview mode to prevent accidental editing
- **FR-020**: Widgets MUST be non-editable (contentEditable=false) and act as single atomic units
- **FR-021**: Widgets MUST preserve underlying HTML comment syntax in markdown file (transparent conversion)
- **FR-022**: Deleting a widget (via backspace) MUST remove the underlying HTML comment from markdown
- **FR-023**: Plugin SHOULD support optional gutter marker display mode as future enhancement

#### Build-Time Filtering

- **FR-007**: Quartz build system MUST filter out lines with `<!-- redact -->` markers in all non-full publish modes (public, trusted, shachu)
- **FR-008**: Quartz build system MUST include lines with `<!-- redact -->` markers in full publish mode
- **FR-009**: Quartz build system MUST filter out lines with `<!-- no-render -->` markers in all publish modes including full
- **FR-010**: Quartz build system MUST filter out content between `<!-- redact-begin -->` and `<!-- redact-end -->` markers in non-full modes
- **FR-011**: Quartz build system MUST include content between redact block markers in full mode
- **FR-012**: Quartz build system MUST filter out content between `<!-- no-render-begin -->` and `<!-- no-render-end -->` markers in all modes
- **FR-013**: System MUST hide the marker syntax itself from rendered output (markers are processing instructions, not visible content)

#### Keyword Tripwire

- **FR-014**: Quartz build system MUST automatically treat any line containing the word "Juuden" as if it has a `<!-- redact -->` marker, regardless of whether an explicit marker is present
- **FR-015**: The "Juuden" tripwire MUST apply the same filtering rules as explicit redact markers (hidden in non-full modes, visible in full mode)
- **FR-016**: System MUST implement topic-based filtering capability where notes with "Juuden" set as a topic can be completely excluded, controlled by a configuration flag (boolean toggle) that is disabled by default

#### Edge Case Handling

- **FR-017**: System MUST handle nested markers correctly, with no-render taking precedence over redact
- **FR-018**: When encountering malformed markers or parsing errors, build system MUST log a warning, skip the problematic file, continue building other files, and generate a build-warnings.html file listing all skipped files with error details

#### Legacy System Migration

- **FR-021**: System MUST replace existing hideInBuild transformer with new redactionMarkers transformer
- **FR-022**: Build system MUST NOT support old `<!-- hide-in-build -->` syntax after migration (users must migrate content)

### Key Entities

- **Redaction Marker**: Processing instruction that indicates content should be hidden from non-full builds
  - Types: inline (`<!-- redact -->` appended to line end) or block (`<!-- redact-begin -->` and `<!-- redact-end -->` on their own lines)
  - Scope: Applies to current line (inline) or enclosed content (block)
  - Visibility: Hidden in public, trusted, shachu modes; visible in full mode

- **No-Render Marker**: Processing instruction that indicates content should be hidden from all builds
  - Types: inline (`<!-- no-render -->` appended to line end) or block (`<!-- no-render-begin -->` and `<!-- no-render-end -->` on their own lines)
  - Scope: Applies to current line (inline) or enclosed content (block)
  - Visibility: Hidden in all build modes

- **Keyword Tripwire**: Automatic redaction behavior triggered by specific keywords
  - Keywords: "Juuden" (case-insensitive matching - catches all variations: Juuden, juuden, JUUDEN)
  - Behavior: Acts as implicit `<!-- redact -->` marker
  - Scope: Line-level (any line containing the keyword)

- **Editor Command**: User-invokable action bound to a hotkey
  - Types: Toggle Redact, Toggle No-Render
  - Behavior: Detects selection state, applies or removes appropriate markers
  - Integration: Native Obsidian plugin (deployed as 3 files in .obsidian/plugins/redaction-markers/)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle redaction markers on a line in under 1 second using a single hotkey press
- **SC-002**: Users can toggle no-render markers on a line in under 1 second using a single hotkey press
- **SC-003**: Redacted content is correctly filtered from 100% of non-full builds (verified by testing all publish modes)
- **SC-004**: No-render content is correctly filtered from 100% of all builds including full mode
- **SC-005**: Users can toggle markers on multi-line selections with the same single-keystroke experience as single lines
- **SC-006**: Build process completes successfully even when files contain malformed markers (skips problematic files, generates build-warnings.html with diagnostic information)
- **SC-007**: Marker syntax is completely hidden from rendered output in all cases (zero visible marker artifacts)
- **SC-008**: Users can configure custom hotkeys through Obsidian's hotkey settings panel
- **SC-009**: Toggle operations are idempotent - repeated toggling cycles predictably between marked and unmarked states
- **SC-010**: The "Juuden" keyword tripwire correctly identifies and filters 100% of lines containing the keyword in non-full builds
- **SC-011**: Lines containing "Juuden" are visible in full builds, matching explicit redact marker behavior
- **SC-012**: Markers are visually styled in Obsidian Live Preview mode to be less intrusive than plain HTML comments
- **SC-013**: Users can distinguish between redact and no-render markers visually (different colors/icons)

### User Experience Goals

- **UX-001**: The toggle behavior feels as natural and immediate as code comment toggling in IDEs
- **UX-002**: Users can visually distinguish marked content in the Obsidian editor (markers are visible in source mode)
- **UX-003**: The two-hotkey system is immediately understandable - users can remember which key does what after first use
- **UX-004**: Workflow is non-disruptive - marking content doesn't require leaving the keyboard or breaking writing flow

## Dependencies & Assumptions *(mandatory)*

### Dependencies

- **DEP-001**: Obsidian editor API (for cursor position, selection detection, text insertion)
- **DEP-002**: Obsidian hotkey registration system and Editor API
- **DEP-003**: Quartz markdown parsing and filtering pipeline (must support HTML comment detection)
- **DEP-004**: Existing Quartz publish mode system (full, trusted, shachu, public)

### Assumptions

- **ASM-001**: HTML comments are preserved in markdown parsing and available to filter plugins
- **ASM-002**: Users are comfortable with keyboard-driven workflows (this is a power-user feature)
- **ASM-003**: Users understand the difference between "hidden from some builds" (redact) and "hidden from all builds" (no-render)
- **ASM-004**: A native Obsidian plugin provides the necessary robustness and simplicity for this feature
- **ASM-005**: Plugin deployment consists of 3 files (main.js, manifest.json, styles.css) in .obsidian/plugins/redaction-markers/
- **ASM-006**: Markers will be applied at line granularity (inline) or block granularity (multi-line), not mid-sentence word-level granularity
- **ASM-007**: Users will primarily use this feature in source/live-preview mode, not pure reading mode
- **ASM-008**: The "Juuden" keyword will be matched case-insensitively to catch all spelling variations
- **ASM-009**: Topic-based filtering will be controlled by a simple configuration flag (boolean) that can be toggled without code changes

## Implementation Approach *(optional)*

[Reserved for planning phase]

## Open Questions

- **OQ-001**: Should there be a way to force-include lines containing "Juuden" even when the tripwire is active?
  - **Status**: Deferred - marked as future enhancement
  - **Notes**: User acknowledged this as a future consideration but not required for initial implementation

