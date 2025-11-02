# Implementation Plan: Inline Tag Display

**Branch**: `005-inline-tag-display` | **Date**: 2025-11-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-inline-tag-display/spec.md`

## Summary

This feature changes how tags are displayed on the published site. Currently, tags appear in a separate section at the top of each page using pill-style badges. This implementation will remove that top section and instead render tags inline within content at their exact position in the markdown source, styled as regular links (matching internal/external link styling) with the # symbol visible.

**Technical approach**: (1) Fix dead link detection bug in contentPage.tsx that converts tag links to non-functional spans, (2) Remove TagList component from page layout. CSS is already correct and will work once bug is fixed.

## Technical Context

**Language/Version**: TypeScript (targeting ES2020, Node.js runtime for build, browser runtime for components)
**Primary Dependencies**: Quartz v4 framework, React 18 (for components), remark/unified (markdown processing), preact (runtime)
**Storage**: N/A (stateless build-time transformation)
**Testing**: Manual testing with local builds across publish modes, visual inspection of rendered pages
**Target Platform**: Static site generator (build-time), browser (rendered output)
**Project Type**: Static site generator with React components (existing Quartz architecture)
**Performance Goals**: No performance degradation (tag processing already happens during build)
**Constraints**: Must work across all 4 publish modes, must not break existing tag indexing/navigation
**Scale/Scope**: Affects all content pages with tags (hundreds of pages across vault)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Compliance Analysis

✅ **I. Single Source of Truth**: No violations - feature only modifies rendering, not content storage

✅ **II. Clean Separation of Concerns**: No violations - all changes in build repo (obsidian-quartz-fork), no vault changes required

✅ **III. Hierarchical Access Control**: No violations - tag filtering/display is independent of publish mode hierarchy

✅ **IV. Frontmatter-Driven Publishing**: No violations - feature doesn't modify publishing logic

✅ **V. Documentation as Living System**: Requires update to ARCHITECTURE.md after implementation

✅ **VI. Defense in Depth**: No violations - tags are display-only, no security implications

✅ **VII. Automated Deployment**: No violations - existing deployment pipeline handles changes automatically

### Development Standards

✅ **Plugin Architecture**: Following Quartz patterns - using existing transformers, modifying component usage
✅ **Testing Requirements**: Must test across all 4 publish modes (public, trusted, shachu, full)
✅ **Configuration Management**: No new configuration required
✅ **File Size Handling**: Not applicable

### Maintenance Practices

✅ **Task Tracking**: Using TodoWrite for this planning phase
✅ **Feature Implementation Workflow**: Will follow documented workflow
✅ **Documentation Standards**: Will update ARCHITECTURE.md with changes

**Result**: ✅ All constitutional requirements satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/005-inline-tag-display/
├── plan.md              # This file
├── research.md          # Design decisions and alternatives
├── quickstart.md        # Implementation guide for developers
└── checklists/
    └── requirements.md  # Spec quality validation (already completed)
```

Note: No `data-model.md` or `contracts/` needed - this is a UI/rendering change with no data model or API contracts.

### Source Code (repository root)

```text
quartz/
├── components/
│   ├── TagList.tsx           # MODIFY: Remove from layout (currently shows top tags)
│   └── styles/
│       └── listPage.scss     # REVIEW: Tag styling in list views
├── plugins/
│   └── transformers/
│       └── ofm.ts            # VERIFY: Inline tag parsing (no changes needed)
├── styles/
│   └── base.scss             # MODIFY: Update tag-link styling to match regular links
└── util/
    └── path.ts               # VERIFY: Tag slugification (no changes needed)

quartz.layout.ts              # MODIFY: Remove TagList from beforeBody section
```

**Structure Decision**: All changes are in the existing Quartz framework structure. This is a modification of existing components and configuration, not new feature addition. Changes are isolated to:
1. Layout configuration (removing TagList component)
2. CSS styling (changing tag-link appearance)
3. Documentation updates

No new directories or files needed in source code. All implementation files already exist in the Quartz architecture.

## Complexity Tracking

No constitutional violations - this section is not needed.

## Phase 0: Research & Design Decisions

See [research.md](research.md) for detailed findings.

**Key Decisions**:

1. **Fix dead link bug**: Modify contentPage.tsx to exclude `tag-link` class from dead link conversion (prevents `<a>` → `<span>` transformation)
2. **Tag parsing unchanged**: ofm.ts transformer already handles inline tags correctly, converting them to links with `tag-link` class
3. **Remove TagList component**: Remove from quartz.layout.ts beforeBody section
4. **CSS unchanged**: base.scss already correct - adds `#` symbol to `a.tag-link` elements
5. **Frontmatter tags**: Will remain indexed but not displayed (existing behavior)
6. **Tag pages**: No changes needed - TagPage emitter continues working

## Phase 1: Technical Design

### Bug Fix: Dead Link Detection

**File**: `quartz/plugins/emitters/contentPage.tsx`
- **Problem**: Lines 55-72 convert `<a>` tags to `<span>` tags when href doesn't match any slug in `allSlugs`
- **Issue**: Tag page URLs (e.g., `/tags/test-tag`) aren't in `allSlugs` because they're generated dynamically by TagPage emitter
- **Result**: Inline tags become non-clickable spans with invalid `href` attributes
- **Action**: Add check to skip dead link conversion for elements with `tag-link` class

**Implementation**:
```typescript
// Around line 55-72, add check for tag-link class
if (!allSlugs.includes(href as RelativeURL)) {
  // Check if this is a tag link (skip dead link conversion for tags)
  const isTagLink =
    (Array.isArray(elem.properties.className) &&
     elem.properties.className.includes("tag-link")) ||
    (typeof elem.properties.className === "string" &&
     elem.properties.className.includes("tag-link"))

  if (isTagLink) {
    return  // Skip dead link conversion for tag links
  }

  // Rest of existing dead link logic...
  if (elem.properties.className === undefined) {
    elem.properties.className = "dead-link"
  }
  // ... etc
}
```

### Layout Change: Remove TagList Component

**File**: `quartz.layout.ts`
- **Action**: Remove `Component.TagList()` from `beforeBody` array in `defaultContentPageLayout`
- **Current location**: Line 35 (after Component.FrontmatterProperties())
- **Impact**: Tags will no longer appear in separate section at top of pages

### No CSS Changes Needed

**File**: `quartz/styles/base.scss`
- **Current state**: Lines 123-127 already have correct CSS:
  ```scss
  a.tag-link::before {
    content: "#";
  }
  ```
- **Why no changes**: CSS is correct, it just wasn't working because tags were being rendered as `<span>` instead of `<a>`
- **After bug fix**: Existing CSS will automatically apply to properly rendered `<a>` tags

### Tag Processing Flow (Unchanged)

1. **Markdown parse**: ofm.ts regex finds `#tag` syntax
2. **Link generation**: Converts to `<a class="internal tag-link">` elements
3. **Frontmatter merge**: Inline tags added to frontmatter.tags array
4. **Page generation**: TagPage emitter creates `/tags/{tag}` pages
5. **Navigation**: Tag links point to generated tag pages

**What changes**:
1. Dead link detection skips tag-link class (bug fix)
2. TagList component removed from layout
Everything else remains functional.

### Testing Strategy

**Manual test cases** (repeat for each publish mode):

1. **Inline tag rendering**:
   - Create test page with inline tags in various contexts (paragraph, list, header)
   - Verify tags appear inline at correct positions
   - Verify tags are clickable links
   - Verify tags navigate to correct tag pages
   - Verify hash symbol is visible

2. **Top section removal**:
   - View pages that previously showed top tags section
   - Confirm no tags section appears above content
   - Confirm page layout is clean without gaps

3. **Tag functionality**:
   - Click inline tag links
   - Verify tag pages still generate correctly
   - Verify tag pages list correct content
   - Verify hierarchical tags work (e.g., `#tea/ceremony`)

4. **Edge cases**:
   - Pages with only frontmatter tags (no inline tags)
   - Pages with both frontmatter and inline tags
   - Pages with multiple inline tags at different locations
   - Tags in different markdown contexts (blockquotes, lists, etc.)

**Test publish modes**: public, trusted, shachu, full

**Test command**: `npx quartz build --publish-mode [MODE] --serve`

## Phase 2: Implementation Tasks

*Tasks will be generated by `/speckit.tasks` command after planning phase completes.*

## Open Questions

None - research phase resolved all technical unknowns and discovered the root cause bug. Implementation is straightforward:
1. Fix dead link detection to exclude tag-link class
2. Remove TagList from layout
3. Test across all contexts and publish modes
4. Update documentation
