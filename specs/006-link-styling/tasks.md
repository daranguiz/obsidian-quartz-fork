# Tasks: Link Styling Refinements

**Feature**: 006-link-styling
**Input**: Design documents from `/specs/006-link-styling/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not applicable - this is a visual styling feature requiring manual visual testing only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

This feature modifies existing SCSS files in the Quartz framework:
- `quartz/styles/custom.scss` - Dead link styling (.dead-link class)
- `quartz/styles/base.scss` - Internal link styling (.internal) and broken links (.internal.broken)

---

## Phase 1: Setup (Prerequisites Check)

**Purpose**: Verify environment and baseline before making changes

- [x] T001 Verify current branch is 006-link-styling via `git branch --show-current`
- [x] T002 Verify SCSS files exist at quartz/styles/custom.scss and quartz/styles/base.scss
- [x] T003 [P] Read current dead link styling from quartz/styles/custom.scss lines 6-27
- [x] T004 [P] Read current internal link styling from quartz/styles/base.scss lines 86-128
- [x] T005 [P] Read current broken link styling from quartz/styles/base.scss lines 94-116

---

## Phase 2: User Story 1 - Dead Link Visual Refinement (Priority: P1) 🎯 MVP

**Goal**: Update dead link color to darker burnt orange (#cc5500) and remove grey background highlighting while maintaining tier-based visibility

**Independent Test**:
1. Build with `npx quartz build --publish-mode full --serve`
2. Verify dead links show burnt orange color (#cc5500) with no background on full tier
3. Build with `npx quartz build --publish-mode public --serve`
4. Verify dead links appear as plain text on non-full tiers

### Implementation for User Story 1

- [x] T006 [P] [US1] Update .dead-link color to #c9844c in quartz/styles/custom.scss line 10
- [x] T007 [P] [US1] Remove background-color: var(--lightgray) from .dead-link in quartz/styles/custom.scss line 11
- [x] T008 [P] [US1] Change .dead-link background-color to transparent in quartz/styles/custom.scss line 11
- [x] T009 [P] [US1] Update .internal.broken color to #c9844c in quartz/styles/base.scss line 116
- [x] T010 [P] [US1] Change .internal.broken opacity from 0.5 to 1.0 in quartz/styles/base.scss line 117
- [x] T011 [US1] Build site with full tier mode via `npx quartz build --publish-mode full --serve`
- [x] T012 [US1] Visually verify dead links display tan-orange (#c9844c) without background on full tier
- [x] T013 [US1] Verify dead links remain distinguishable from working internal links
- [x] T014 [US1] Build site with public tier mode via `npx quartz build --publish-mode public --serve`
- [x] T015 [US1] Visually verify dead links appear as plain text on non-full tiers (existing behavior maintained)

**Checkpoint**: User Story 1 complete - dead link styling refined and tier-aware behavior preserved

---

## Phase 3: User Story 2 - Internal Link Background Options (Priority: P2)

**Goal**: Create three distinct visual options for internal link backgrounds (no background, current background, bottom border) to allow user evaluation and selection

**Independent Test**:
1. Uncomment each option variant in base.scss
2. Build with `npx quartz build --serve` for each option
3. Visually compare all three options
4. Select preferred option and remove unused variants

### Implementation for User Story 2

- [ ] T016 [US2] Create Option A comment block in quartz/styles/base.scss after line 92 with no background styling
- [ ] T017 [US2] Add Option A CSS: remove background-color, keep color var(--secondary), remove padding
- [ ] T018 [US2] Create Option B comment block in quartz/styles/base.scss with current behavior as baseline
- [ ] T019 [US2] Add Option B CSS: maintain background-color var(--highlight), keep all existing properties
- [ ] T020 [US2] Create Option C comment block in quartz/styles/base.scss with bottom border alternative
- [ ] T021 [US2] Add Option C CSS: remove background-color, add border-bottom 2px solid var(--secondary), adjust padding
- [ ] T022 [US2] Add inline comments explaining each option's use case (minimal/current/modern)
- [ ] T023 [US2] Build site with Option A active via uncommenting and `npx quartz build --serve`
- [ ] T024 [US2] Screenshot or visually evaluate Option A appearance on content with many links
- [ ] T025 [US2] Build site with Option B active (current behavior - default state)
- [ ] T026 [US2] Screenshot or visually evaluate Option B appearance
- [ ] T027 [US2] Build site with Option C active via uncommenting and `npx quartz build --serve`
- [ ] T028 [US2] Screenshot or visually evaluate Option C appearance
- [ ] T029 [US2] Compare all three options side-by-side and select preferred variant
- [ ] T030 [US2] Remove commented code for unselected options from quartz/styles/base.scss
- [ ] T031 [US2] Verify selected option doesn't affect external links, tag links, or image links
- [ ] T032 [US2] Final build test with selected option via `npx quartz build --serve`

**Checkpoint**: User Story 2 complete - internal link background option selected and implemented

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup

- [ ] T033 [P] Test dead link styling in edge cases (headings, long wrapping text, bold/italic contexts)
- [ ] T034 [P] Cross-browser visual verification in Chrome, Firefox, Safari
- [ ] T035 Verify tier-based selectors still intact: body[data-publish-mode="full"] in both files
- [ ] T036 Confirm WCAG AA contrast ratio (5.1:1) for #cc5500 against backgrounds
- [ ] T037 Build all four publish modes and verify consistency (full, trusted, shachu, public)
- [ ] T038 Remove any debug comments or temporary code from SCSS files
- [ ] T039 Update docs-custom/ARCHITECTURE.md with link styling changes and color rationale
- [ ] T040 Document which internal link background option was selected and why in ARCHITECTURE.md
- [ ] T041 Run final validation per quickstart.md testing workflow
- [ ] T042 Commit changes with message: "feat: refine link styling - burnt orange dead links, internal link background options (006)"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - prerequisite verification only
- **User Story 1 (Phase 2)**: Depends on Setup - can start immediately after T001-T005
- **User Story 2 (Phase 3)**: Can start in parallel with US1 (different CSS sections) OR after US1 completion
- **Polish (Phase 4)**: Depends on completion of both User Stories 1 and 2

### User Story Dependencies

- **User Story 1 (P1)**: Independent - modifies .dead-link and .internal.broken selectors
- **User Story 2 (P2)**: Independent - modifies .internal selector only
- **No blocking dependencies between stories** - can be implemented in parallel if desired

### Within Each User Story

**User Story 1**:
- T006-T010 (CSS edits) can run in parallel - different selectors/properties
- T011-T015 (testing) must run sequentially after T006-T010 complete

**User Story 2**:
- T016-T022 (create option variants) can run in parallel - different comment blocks
- T023-T028 (option testing) must run sequentially after T016-T022 complete
- T029-T032 (selection and cleanup) must run after testing complete

### Parallel Opportunities

- **Phase 1**: T003, T004, T005 can run in parallel (reading different files/sections)
- **Phase 2 (US1)**: T006, T007, T008, T009, T010 can run in parallel (different CSS properties)
- **Phase 3 (US2)**: T016-T022 can run in parallel (creating separate comment blocks)
- **Phase 4**: T033, T034 can run in parallel (different validation activities)
- **User Stories 1 and 2 can run in parallel** (different CSS selectors)

---

## Parallel Example: User Story 1

```bash
# Launch all CSS edits for User Story 1 together:
Task: "Update .dead-link color from #d97706 to #cc5500 in quartz/styles/custom.scss line 10"
Task: "Remove background-color: var(--lightgray) from .dead-link in quartz/styles/custom.scss line 11"
Task: "Change .dead-link background-color to transparent in quartz/styles/custom.scss line 11"
Task: "Update .internal.broken color to #cc5500 in quartz/styles/base.scss line 96"
Task: "Change .internal.broken opacity from 0.5 to 1.0 in quartz/styles/base.scss line 97"

# After edits complete, run sequential tests:
Task: "Build site with full tier mode via npx quartz build --publish-mode full --serve"
# Then verify visually...
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005) - verify baseline
2. Complete Phase 2: User Story 1 (T006-T015) - dead link refinement
3. **STOP and VALIDATE**: Test dead link styling independently
4. Optional: Commit and deploy just US1 if satisfactory

### Incremental Delivery

1. Complete Setup → Baseline verified
2. Add User Story 1 → Test independently → Commit (MVP - dead links refined!)
3. Add User Story 2 → Test independently → Select option → Commit (Full feature complete!)
4. Polish and document → Final commit

### Parallel Strategy (if desired)

Since User Stories 1 and 2 modify different CSS selectors, they can be worked on simultaneously:

1. Complete Setup together (T001-T005)
2. Split work:
   - Path A: User Story 1 (T006-T015) - dead link styling
   - Path B: User Story 2 (T016-T032) - internal link options
3. Merge and test together
4. Complete Polish phase (T033-T042)

---

## Notes

- **No automated tests**: This is a pure visual styling change requiring manual visual verification
- **[P] tasks**: Can run in parallel - different files or non-conflicting lines
- **[Story] labels**: Map tasks to specific user stories for traceability
- **Each user story is independently completable**: Can stop after US1 for MVP
- **Testing workflow**: Defined in quickstart.md - follow Step 1-4 for comprehensive validation
- **Color accessibility**: #cc5500 has 5.1:1 contrast ratio, meets WCAG AA
- **Tier preservation**: Both stories must maintain body[data-publish-mode="full"] selectors
- **Option selection (US2)**: Requires user decision after visual comparison - T029 is a decision point
- **Commit strategy**: Can commit after each user story or as single feature commit

---

## Task Summary

- **Total tasks**: 42
- **Setup (Phase 1)**: 5 tasks (T001-T005)
- **User Story 1 (Phase 2)**: 10 tasks (T006-T015)
- **User Story 2 (Phase 3)**: 17 tasks (T016-T032)
- **Polish (Phase 4)**: 10 tasks (T033-T042)

**Parallel opportunities**: 15 tasks marked [P] can run in parallel
**MVP scope**: Phase 1 + Phase 2 (15 tasks) delivers dead link refinement
**Full feature**: All phases (42 tasks) delivers both user stories

---

## Validation Checklist

Format validation - all tasks follow required format:
- ✅ All tasks have checkbox `- [ ]`
- ✅ All tasks have sequential Task ID (T001-T042)
- ✅ Parallelizable tasks marked with [P]
- ✅ User story tasks marked with [US1] or [US2]
- ✅ All tasks include specific file paths
- ✅ Tasks organized by user story for independent implementation
- ✅ Each user story has independent test criteria
- ✅ Dependencies clearly documented
- ✅ Parallel opportunities identified
- ✅ MVP scope defined (US1 only)
