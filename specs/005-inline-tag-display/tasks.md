# Tasks: Inline Tag Display

**Input**: Design documents from `/specs/005-inline-tag-display/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: NOT requested - this is a UI/rendering change with manual testing across publish modes

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All paths are from repository root: `/Users/dario/git/obsidian-quartz-fork/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pre-implementation verification and test content preparation

- [X] T001 Create test markdown file with inline tags in content/tag-test.md for validation
- [X] T002 Build site locally to verify current broken behavior (tags not clickable, missing #)
- [X] T003 Take screenshots of current tag display for before/after comparison

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Bug fix that enables inline tags to work correctly

**⚠️ CRITICAL**: This phase MUST be complete before ANY user story can be implemented. The dead link detection bug prevents inline tags from functioning.

- [X] T004 Fix dead link detection in quartz/plugins/emitters/contentPage.tsx (lines 55-72) to skip tag-link class conversion

**Implementation Details for T004**:
Add check after `if (!allSlugs.includes(href as RelativeURL)) {` line:
```typescript
const isTagLink =
  (Array.isArray(elem.properties.className) &&
    elem.properties.className.includes("tag-link")) ||
  (typeof elem.properties.className === "string" &&
    elem.properties.className.includes("tag-link"))

if (isTagLink) {
  return  // Skip dead link conversion for tag links
}
```

**Checkpoint**: Foundation ready - inline tags should now render as `<a>` elements with proper navigation

---

## Phase 3: User Story 1 - View Tags in Context (Priority: P1) 🎯 MVP

**Goal**: Enable tags to display inline within content at their exact markdown position with proper clickability and # symbol

**Independent Test**: View any page with inline tags and verify they appear as clickable links with # symbol at the correct location in content

**Why this is MVP**: This is the core fix - making inline tags actually work. Without this, tags are completely non-functional in content.

### Implementation for User Story 1

- [X] T005 [US1] Build site with bug fix and verify inline tags are now clickable links
- [X] T006 [US1] Verify hash symbol (#) now appears before inline tag names in content
- [X] T007 [US1] Test inline tag navigation to tag pages works correctly
- [X] T008 [US1] Test inline tags in paragraphs render correctly
- [X] T009 [US1] Test inline tags in lists render correctly
- [X] T010 [US1] Test inline tags in blockquotes render correctly
- [X] T011 [US1] Test inline tags in headers render correctly
- [X] T012 [US1] Test hierarchical tags (e.g., #tea/ceremony/advanced) render with full hierarchy
- [X] T013 [US1] Test multiple inline tags on same page appear at correct positions
- [X] T014 [US1] Verify inline tags styled as regular links (blue color, hover effects)

**Checkpoint**: At this point, inline tags should be fully functional and clickable with # symbols visible

---

## Phase 4: User Story 2 - Remove Top-of-Page Tags Section (Priority: P1)

**Goal**: Remove the TagList component from page layout so tags no longer appear in a separate section at the top of pages

**Independent Test**: View pages that previously showed top tags section and verify no tags section appears in the header area

**Why P1**: Equally critical as US1 - keeping the top section would result in duplicate tags and maintain the current confusing experience

### Implementation for User Story 2

- [X] T015 [US2] Remove Component.TagList() from beforeBody array in quartz.layout.ts (line ~35)
- [X] T016 [US2] Rebuild site and verify no tags section appears at top of pages
- [X] T017 [US2] Verify page layout is clean without gaps where TagList was removed
- [X] T018 [US2] Test pages with frontmatter tags only (no inline tags) show no tags section
- [X] T019 [US2] Test pages with both frontmatter and inline tags only show inline tags
- [X] T020 [US2] Verify TagList component removal doesn't affect tag indexing for tag pages

**Checkpoint**: At this point, tags should only appear inline in content with no top-of-page section

---

## Phase 5: User Story 3 - Maintain Tag Functionality (Priority: P2)

**Goal**: Verify all existing tag functionality (navigation, indexing, tag pages) continues to work correctly

**Independent Test**: Click inline tags and verify navigation to tag pages works correctly with proper content listings

**Why P2**: Important for maintaining system functionality, but secondary to getting the basic display right (US1 and US2)

### Implementation for User Story 3

- [X] T021 [US3] Test inline tag click navigation to tag listing pages
- [X] T022 [US3] Verify tag pages list correct content for each tag
- [X] T023 [US3] Test hierarchical tag pages (parent and child tags both work)
- [X] T024 [US3] Verify tag hover effects display correctly
- [X] T025 [US3] Verify frontmatter tags remain indexed but not displayed visually
- [X] T026 [US3] Test tag page generation still creates all expected /tags/{tag} pages
- [X] T027 [US3] Verify tag index page at /tags/index still works

**Checkpoint**: All user stories should now be independently functional - tags work inline with no top section

---

## Phase 6: Multi-Mode Testing (Cross-Cutting)

**Purpose**: Verify implementation works consistently across all four publish modes

**⚠️ CRITICAL**: Constitution requires testing across all publish modes

- [X] T028 Test inline tags in public publish mode (npx quartz build --publish-mode public --serve)
- [X] T029 Test inline tags in trusted publish mode (npx quartz build --publish-mode trusted --serve)
- [X] T030 Test inline tags in shachu publish mode (npx quartz build --publish-mode shachu --serve)
- [X] T031 Test inline tags in full publish mode (npx quartz build --publish-mode full --serve)
- [X] T032 Verify tag navigation works in all publish modes
- [X] T033 Verify tag pages don't link to filtered content in restricted modes

---

## Phase 7: Polish & Documentation

**Purpose**: Complete implementation with documentation updates

- [X] T034 [P] Update docs-custom/ARCHITECTURE.md with inline tag display changes
- [X] T035 [P] Update docs-custom/CLAUDE.md with note about tag display behavior
- [X] T036 [P] Move task from pending to completed in docs-custom/FUTURE_TASKS.md
- [X] T037 Delete test file content/tag-test.md (cleanup)
- [X] T038 Take screenshots of final implementation for documentation
- [X] T039 Verify quickstart.md instructions match actual implementation
- [ ] T040 Create git commit with descriptive message following convention

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase - Tests the bug fix
- **User Story 2 (Phase 4)**: Depends on US1 completion - Layout change builds on working tags
- **User Story 3 (Phase 5)**: Depends on US1 and US2 - Verifies everything works together
- **Multi-Mode Testing (Phase 6)**: Depends on all user stories - Cross-cutting verification
- **Polish (Phase 7)**: Depends on all phases - Final documentation

### User Story Dependencies

- **User Story 1 (P1)**: MUST complete first - Fixes broken inline tags
- **User Story 2 (P1)**: Can start after US1 - Removes duplicate top tags section
- **User Story 3 (P2)**: Can start after US1 and US2 - Verifies integrated functionality

### Within Each User Story

User Story 1 (all tasks can run sequentially in testing):
- Fix bug (T004) → Build and test (T005-T014)

User Story 2 (all tasks can run sequentially):
- Remove component (T015) → Build and test (T016-T020)

User Story 3 (all tasks can run sequentially in testing):
- Test navigation (T021-T027)

### Parallel Opportunities

**Within Phase 7 (Polish)**, these tasks are marked [P] and can run in parallel:
- T034: Update ARCHITECTURE.md
- T035: Update CLAUDE.md
- T036: Update FUTURE_TASKS.md

All other tasks must run sequentially because they involve:
- Same file edits (contentPage.tsx, quartz.layout.ts)
- Build dependencies (must build before testing)
- Test dependencies (must complete previous tests before next phase)

---

## Parallel Example: Polish Phase Only

```bash
# Only the documentation tasks in Phase 7 can run in parallel:
Task: "Update docs-custom/ARCHITECTURE.md with inline tag display changes"
Task: "Update docs-custom/CLAUDE.md with note about tag display behavior"
Task: "Move task from pending to completed in docs-custom/FUTURE_TASKS.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational - Fix bug (T004) - **CRITICAL**
3. Complete Phase 3: User Story 1 (T005-T014)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. If bugs found, fix before proceeding

### Incremental Delivery

1. Setup (Phase 1) → Foundation ready (Phase 2) → Bug fixed
2. User Story 1 (Phase 3) → Inline tags work correctly → **MVP!**
3. User Story 2 (Phase 4) → Top section removed → Clean layout
4. User Story 3 (Phase 5) → All functionality verified → Feature complete
5. Multi-Mode Testing (Phase 6) → All modes tested → Ready for deployment
6. Polish (Phase 7) → Documentation complete → Ready for commit/push

### Sequential Execution (Recommended)

This feature requires sequential implementation because:
- Bug fix (T004) must work before any testing can proceed
- US1 tests verify bug fix worked
- US2 builds on working US1
- US3 verifies US1 and US2 work together
- Multi-mode testing verifies everything works across all modes

Execute in strict phase order:
1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

---

## Detailed Task Descriptions

### T004 - Fix Dead Link Detection (CRITICAL)

**File**: `quartz/plugins/emitters/contentPage.tsx`
**Location**: Lines 55-72 (around the `if (!allSlugs.includes(href as RelativeURL))` block)

**Current Problem**:
- Tag links have hrefs like `/tags/test-tag`
- These URLs don't exist in `allSlugs` because tag pages are generated dynamically
- Dead link logic converts `<a>` to `<span>` on line 71
- Results in non-functional inline tags

**Solution**:
Add check immediately after `if (!allSlugs.includes(href as RelativeURL)) {`:

```typescript
// Skip dead link conversion for tag links (they're generated dynamically)
const isTagLink =
  (Array.isArray(elem.properties.className) &&
    elem.properties.className.includes("tag-link")) ||
  (typeof elem.properties.className === "string" &&
    elem.properties.className.includes("tag-link"))

if (isTagLink) {
  return  // Skip dead link conversion for tag links
}
```

**Verification**: Build site and inspect rendered HTML - inline tags should be `<a>` elements, not `<span>` elements

### T015 - Remove TagList from Layout

**File**: `quartz.layout.ts`
**Location**: Line ~35 (in `defaultContentPageLayout.beforeBody` array)

**Action**: Delete or comment out the line containing `Component.TagList()`

**Before**:
```typescript
beforeBody: [
  Component.Breadcrumbs(),
  Component.ArticleTitle(),
  Component.ContentMeta(),
  Component.FrontmatterProperties(),
  Component.TagList(),  // <-- Remove this line
],
```

**After**:
```typescript
beforeBody: [
  Component.Breadcrumbs(),
  Component.ArticleTitle(),
  Component.ContentMeta(),
  Component.FrontmatterProperties(),
  // Component.TagList() removed - tags now only appear inline
],
```

**Verification**: Build site and verify no tags section appears at top of pages

---

## Notes

- **No [P] markers on test tasks** - all testing must be done sequentially after builds
- **Only Phase 7 documentation tasks** are parallelizable (different files, no dependencies)
- **[Story] labels** map tasks to specific user stories for traceability
- Each user story should be independently testable at its checkpoint
- Manual testing required - no automated tests for this feature
- Build command: `npx quartz build --publish-mode [MODE] --serve`
- Verify tests pass before moving to next phase
- Commit after completing all phases
- Constitution requires testing all 4 publish modes (public, trusted, shachu, full)

---

## Task Count Summary

- **Total Tasks**: 40
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 1 task (CRITICAL - blocks all stories)
- **Phase 3 (User Story 1 - P1)**: 10 tasks
- **Phase 4 (User Story 2 - P1)**: 6 tasks
- **Phase 5 (User Story 3 - P2)**: 7 tasks
- **Phase 6 (Multi-Mode Testing)**: 6 tasks
- **Phase 7 (Polish)**: 7 tasks (3 parallelizable)

**Parallel Opportunities**: 3 tasks (documentation in Phase 7)

**Independent Test Criteria**:
- US1: Inline tags clickable with # symbol at correct positions
- US2: No top tags section visible on any page
- US3: Tag navigation and tag pages work correctly

**Suggested MVP Scope**: User Story 1 (Phase 1-3) - Makes inline tags functional
