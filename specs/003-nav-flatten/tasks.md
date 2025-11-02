# Tasks: Smart Navigation Defaults

**Input**: Design documents from `/specs/003-nav-flatten/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not requested in feature specification - no test tasks included

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: Quartz framework at repository root
- Paths: `quartz/components/`, `quartz/components/scripts/`, `quartz.layout.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify current Explorer implementation and prepare for modification

- [ ] T001 Review Explorer component current implementation in quartz/components/Explorer.tsx
- [ ] T002 Review Explorer inline script current implementation in quartz/components/scripts/explorer.inline.ts
- [ ] T003 Review current Explorer configuration in quartz.layout.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add autoExpandFolders option to Options interface in quartz/components/Explorer.tsx
- [ ] T005 Pass autoExpandFolders via data attribute in Explorer.tsx render method

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Quick Access to Frequently Used Content (Priority: P1) 🎯 MVP

**Goal**: Auto-expand "Tea Resources" and "紙片 (Shihen)" folders on lower trust tiers (Public, Shachu, Trusted) to reduce clicks from 3 to 1

**Independent Test**: Visit any lower trust tier site (Public, Shachu, or Trusted), verify "Tea Resources" and "紙片 (Shihen)" folders are already expanded on page load, and confirm Shihen files are immediately visible without manual expansion

### Implementation for User Story 1

- [ ] T006 [US1] Read autoExpandFolders from data attribute in quartz/components/scripts/explorer.inline.ts (after line 203)
- [ ] T007 [US1] Implement state injection logic for auto-expand folders in explorer.inline.ts (after loading saved state, before folder creation)
- [ ] T008 [US1] Configure autoExpandFolders for lower tiers in quartz.layout.ts (left sidebar Explorer configuration)
- [ ] T009 [US1] Configure autoExpandFolders for lower tiers in quartz.layout.ts (right sidebar Explorer configuration if present)

**Checkpoint**: At this point, User Story 1 should be fully functional - lower tiers auto-expand, Full tier unchanged

---

## Phase 4: User Story 2 - Preserve Collapsed State for Full Tier (Priority: P2)

**Goal**: Ensure Full tier keeps all folders collapsed by default, no auto-expansion

**Independent Test**: Visit Full tier site and verify all folders including "Tea Resources" and "紙片 (Shihen)" start in collapsed state

### Implementation for User Story 2

- [ ] T010 [US2] Verify autoExpandFolders is empty array for Full tier in quartz.layout.ts configuration
- [ ] T011 [US2] Test Full tier build locally with `npx quartz build --publish-mode full --serve`
- [ ] T012 [US2] Verify no auto-expansion occurs on Full tier (all folders collapsed by default)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - lower tiers auto-expand, Full tier stays collapsed

---

## Phase 5: User Story 3 - Explicit Control Over Auto-Expansion (Priority: P3)

**Goal**: Ensure only explicitly configured folders auto-expand; new folders remain collapsed unless added to configuration

**Independent Test**: Add a new folder "Tea Activities" to the vault, build for a lower trust tier, and verify this new folder remains collapsed (not auto-expanded) unless explicitly configured

### Implementation for User Story 3

- [ ] T013 [US3] Document configuration format in quickstart.md (already completed during planning)
- [ ] T014 [US3] Verify state injection logic only processes folders in autoExpandFolders array (no implicit expansion)
- [ ] T015 [US3] Test adding new folder to vault and verify it stays collapsed on lower tiers

**Checkpoint**: All user stories should now be independently functional - selective auto-expansion working correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, testing, and validation across all tiers

- [ ] T016 [P] Test Full tier locally - verify all folders collapsed on page load
- [ ] T017 [P] Test Trusted tier locally - verify "Tea Resources" and "紙片 (Shihen)" auto-expanded on page load
- [ ] T018 [P] Test Shachu tier locally - verify "Tea Resources" and "紙片 (Shihen)" auto-expanded on page load
- [ ] T019 [P] Test Public tier locally - verify "Tea Resources" and "紙片 (Shihen)" auto-expanded on page load
- [ ] T020 Test state persistence - manually collapse auto-expanded folder, refresh, verify it stays collapsed (saved state wins)
- [ ] T021 Test state reset - clear localStorage, refresh, verify auto-expansion reapplies
- [ ] T022 Test edge case - nested folder without parent (verify parent must be in config)
- [ ] T023 Test edge case - folder doesn't exist (verify graceful handling, no errors)
- [ ] T024 Verify click count reduction - Shihen files accessible in 1 click on lower tiers vs 3 clicks on Full tier
- [ ] T025 Update ARCHITECTURE.md with smart navigation defaults section in docs-custom/ARCHITECTURE.md
- [ ] T026 Verify no performance degradation - check page load times across tiers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after User Story 1 - Verifies Full tier behavior is preserved
- **User Story 3 (P3)**: Can start after User Story 1 - Verifies explicit configuration works correctly

### Within Each User Story

- Foundational tasks (T004-T005) MUST complete before any user story implementation
- User Story 1 tasks (T006-T009) can run sequentially or with T006-T007 together, then T008-T009 in parallel
- User Story 2 tasks (T010-T012) are sequential validation tasks
- User Story 3 tasks (T013-T015) are sequential validation tasks

### Parallel Opportunities

- **Phase 1 Setup**: T001, T002, T003 can all run in parallel (read-only review tasks)
- **Phase 2 Foundational**: T004 and T005 are sequential (T005 depends on T004)
- **Phase 3 User Story 1**: T006-T007 must be sequential, but T008 and T009 can run in parallel (different Explorer instances in layout)
- **Phase 6 Polish**: T016, T017, T018, T019 can run in parallel (independent tier tests)

---

## Parallel Example: Phase 1 (Setup Review)

```bash
# Launch all setup review tasks together:
Task: "Review Explorer component current implementation in quartz/components/Explorer.tsx"
Task: "Review Explorer inline script current implementation in quartz/components/scripts/explorer.inline.ts"
Task: "Review current Explorer configuration in quartz.layout.ts"
```

## Parallel Example: Phase 6 (Tier Testing)

```bash
# Launch all tier tests together (in separate terminals):
Task: "Test Full tier locally - verify all folders collapsed on page load"
Task: "Test Trusted tier locally - verify Tea Resources and Shihen auto-expanded on page load"
Task: "Test Shachu tier locally - verify Tea Resources and Shihen auto-expanded on page load"
Task: "Test Public tier locally - verify Tea Resources and Shihen auto-expanded on page load"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (review current implementation)
2. Complete Phase 2: Foundational (add option and data attribute)
3. Complete Phase 3: User Story 1 (implement auto-expansion for lower tiers)
4. **STOP and VALIDATE**: Test User Story 1 independently across all tiers
5. Deploy/demo if ready (can ship with just US1 complete)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Verify Full tier unchanged
4. Add User Story 3 → Test independently → Verify explicit configuration works
5. Complete Polish phase → Final validation and documentation

### Sequential Strategy (Single Developer)

1. Complete Phase 1 (Setup) - ~15 minutes
2. Complete Phase 2 (Foundational) - ~20 minutes
3. Complete Phase 3 (User Story 1) - ~30 minutes
4. Complete Phase 4 (User Story 2) - ~15 minutes
5. Complete Phase 5 (User Story 3) - ~15 minutes
6. Complete Phase 6 (Polish) - ~30 minutes
7. **Total estimated time**: ~2 hours for complete implementation and testing

---

## Testing Commands

### Local Testing

```bash
# Full tier - no auto-expansion
npx quartz build --publish-mode full --serve

# Trusted tier - auto-expand Tea Resources + Shihen
npx quartz build --publish-mode trusted --serve

# Shachu tier - auto-expand Tea Resources + Shihen
npx quartz build --publish-mode shachu --serve

# Public tier - auto-expand Tea Resources + Shihen
npx quartz build --publish-mode public --serve
```

### Verification Checklist (from quickstart.md)

#### Full Tier
- [ ] All folders start collapsed
- [ ] "Tea Resources" is collapsed
- [ ] "紙片 (Shihen)" is not visible (inside collapsed parent)
- [ ] Click count to Shihen file: **3 clicks**

#### Lower Tiers (Trusted, Shachu, Public)
- [ ] "Tea Resources" is expanded on page load
- [ ] "紙片 (Shihen)" is expanded on page load (visible inside Tea Resources)
- [ ] All Shihen files immediately visible
- [ ] Other folders remain collapsed (Bibliography, Temae Reference)
- [ ] Click count to Shihen file: **1 click**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
- Configuration approach leverages existing Explorer folder state management
- No performance impact expected (state injection before DOM creation)
- User preferences always win (saved state overrides auto-expand config)
