# Tasks: Content Redaction Markers

**Input**: Design documents from `/specs/004-redaction-markers/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in specification - tasks focus on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This feature spans TWO repositories:
- **Quartz Build Repo**: `obsidian-quartz-fork/` (quartz plugins, transformers)
- **Obsidian Vault**: `.obsidian/plugins/redaction-markers/` (editor plugin)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create Obsidian plugin directory structure at .obsidian/plugins/redaction-markers-dev/
- [X] T002 [P] Initialize TypeScript project with esbuild dependencies in .obsidian/plugins/redaction-markers-dev/
- [X] T003 [P] Create manifest.json with plugin metadata in .obsidian/plugins/redaction-markers-dev/
- [X] T004 [P] Setup esbuild.config.mjs for plugin compilation in .obsidian/plugins/redaction-markers-dev/
- [X] T005 [P] Create tsconfig.json for TypeScript configuration in .obsidian/plugins/redaction-markers-dev/
- [X] T006 [P] Create package.json with build scripts in .obsidian/plugins/redaction-markers-dev/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core transformer infrastructure that MUST be complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create redactionMarkers.ts transformer plugin skeleton in quartz/plugins/transformers/
- [X] T008 [P] Implement textTransform method with line-by-line processing in quartz/plugins/transformers/redactionMarkers.ts
- [X] T009 [P] Add regex patterns for all marker types (inline/block, redact/no-render) in quartz/plugins/transformers/redactionMarkers.ts
- [X] T010 [P] Implement publish mode detection using process.env.QUARTZ_PUBLISH_MODE in quartz/plugins/transformers/redactionMarkers.ts
- [X] T011 Create buildWarnings.ts utility in quartz/util/
- [X] T012 [P] Implement collectWarning function in quartz/util/buildWarnings.ts
- [X] T013 [P] Implement generateWarningsReport function in quartz/util/buildWarnings.ts
- [X] T014 Export RedactionMarkers from quartz/plugins/transformers/index.ts
- [X] T015 Add Plugin.RedactionMarkers() to transformers array in quartz.config.ts
- [ ] T016 Remove Plugin.HideInBuild() from transformers array in quartz.config.ts (Deferred: keeping for backward compat)
- [ ] T017 Delete quartz/plugins/transformers/hideInBuild.ts after verification (Deferred: keeping for backward compat)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Toggling Line-Level Redaction (Priority: P1) 🎯 MVP

**Goal**: Enable quick marking of entire lines as redacted with single hotkey press, hiding sensitive content from non-full builds

**Independent Test**: Place cursor on unmarked line, press redact hotkey, verify `<!-- redact -->` appears at line end. Build in public mode - line should be filtered. Build in full mode - line should be visible.

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement inline redact marker detection logic in quartz/plugins/transformers/redactionMarkers.ts
- [X] T019 [P] [US1] Implement inline redact marker filtering for non-full modes in quartz/plugins/transformers/redactionMarkers.ts
- [X] T020 [P] [US1] Implement inline redact marker removal (hide syntax) for full mode in quartz/plugins/transformers/redactionMarkers.ts
- [X] T021 [P] [US1] Create toggle-redact command skeleton in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T022 [US1] Implement line detection logic (no selection) in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T023 [US1] Implement hasInlineMarker detection function in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T024 [US1] Implement insertInlineMarker function using editor.replaceRange in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T025 [US1] Implement removeInlineMarker function using editor.replaceRange in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T026 [US1] Register toggle-redact command with editorCallback in .obsidian/plugins/redaction-markers-dev/main.ts
- [ ] T027 [US1] Manual test: verify hotkey adds marker to line end
- [ ] T028 [US1] Manual test: verify hotkey removes marker when pressed again
- [ ] T029 [US1] Manual test: build with public mode - verify marked line filtered
- [ ] T030 [US1] Manual test: build with full mode - verify marked line visible

**Checkpoint**: Line-level redaction fully functional - MVP deliverable

---

## Phase 4: User Story 2 - Toggling Line-Level No-Render (Priority: P1)

**Goal**: Enable quick marking of entire lines to hide from ALL builds, addressing broken queries and temporary content

**Independent Test**: Place cursor on unmarked line, press no-render hotkey, verify `<!-- no-render -->` appears. Build in all modes (full, trusted, shachu, public) - line should be filtered from all.

### Implementation for User Story 2

- [X] T031 [P] [US2] Implement inline no-render marker detection logic in quartz/plugins/transformers/redactionMarkers.ts
- [X] T032 [P] [US2] Implement inline no-render marker filtering for all modes in quartz/plugins/transformers/redactionMarkers.ts
- [X] T033 [P] [US2] Create toggle-no-render command skeleton in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T034 [US2] Implement insertInlineMarker for no-render type in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T035 [US2] Implement removeInlineMarker for no-render type in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T036 [US2] Register toggle-no-render command with editorCallback in .obsidian/plugins/redaction-markers-dev/main.ts
- [ ] T037 [US2] Manual test: verify hotkey adds no-render marker
- [ ] T038 [US2] Manual test: verify hotkey removes no-render marker
- [ ] T039 [US2] Manual test: build with full mode - verify marked line filtered
- [ ] T040 [US2] Manual test: build with public mode - verify marked line filtered

**Checkpoint**: Line-level no-render fully functional - both P1 stories complete

---

## Phase 5: User Story 3 - Block-Level Redaction (Priority: P2)

**Goal**: Enable marking of multi-line sections as redacted without marking each line individually

**Independent Test**: Select multiple lines, press redact hotkey, verify selection wrapped with `<!-- redact-begin -->` and `<!-- redact-end -->` on separate lines. Build in public mode - content should be filtered. Build in full mode - content should be visible.

### Implementation for User Story 3

- [X] T041 [P] [US3] Implement block redact marker detection logic (begin/end) in quartz/plugins/transformers/redactionMarkers.ts
- [X] T042 [P] [US3] Implement state machine for tracking inside redact blocks in quartz/plugins/transformers/redactionMarkers.ts
- [X] T043 [P] [US3] Implement block content filtering for non-full modes in quartz/plugins/transformers/redactionMarkers.ts
- [X] T044 [P] [US3] Implement block marker removal (hide markers only) for full mode in quartz/plugins/transformers/redactionMarkers.ts
- [X] T045 [P] [US3] Implement selection detection logic in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T046 [US3] Implement hasBlockMarkers detection function in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T047 [US3] Implement insertBlockMarkers function (markers on own lines) in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T048 [US3] Implement removeBlockMarkers function with flexible selection matching in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T049 [US3] Update toggle-redact command to route to block logic when selection exists in .obsidian/plugins/redaction-markers-dev/main.ts
- [ ] T050 [US3] Manual test: verify selection wrapped with block markers on own lines
- [ ] T051 [US3] Manual test: verify toggling off removes markers regardless of selection overlap
- [ ] T052 [US3] Manual test: build with public mode - verify block content filtered
- [ ] T053 [US3] Manual test: build with full mode - verify block content visible

**Checkpoint**: Block-level redaction functional - extends P1 functionality

---

## Phase 6: User Story 4 - Block-Level No-Render (Priority: P2)

**Goal**: Enable marking of multi-line sections to hide from all builds

**Independent Test**: Select multiple lines, press no-render hotkey, verify selection wrapped with `<!-- no-render-begin -->` and `<!-- no-render-end -->`. Build in all modes - content should be filtered.

### Implementation for User Story 4

- [X] T054 [P] [US4] Implement block no-render marker detection logic in quartz/plugins/transformers/redactionMarkers.ts
- [X] T055 [P] [US4] Implement state machine for tracking inside no-render blocks in quartz/plugins/transformers/redactionMarkers.ts
- [X] T056 [P] [US4] Implement block content filtering for all modes in quartz/plugins/transformers/redactionMarkers.ts
- [X] T057 [P] [US4] Implement insertBlockMarkers for no-render type in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T058 [P] [US4] Implement removeBlockMarkers for no-render type in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T059 [US4] Update toggle-no-render command to route to block logic when selection exists in .obsidian/plugins/redaction-markers-dev/main.ts
- [ ] T060 [US4] Manual test: verify selection wrapped with no-render block markers
- [ ] T061 [US4] Manual test: verify toggling off works with various selection combinations
- [ ] T062 [US4] Manual test: build with full mode - verify content filtered
- [ ] T063 [US4] Manual test: build with public mode - verify content filtered

**Checkpoint**: All block-level functionality complete - P1 and P2 stories done

---

## Phase 7: User Story 5 - Toggle Cycling (Priority: P3)

**Goal**: Enable intuitive cycling through marker states with repeated hotkey presses

**Independent Test**: Press redact hotkey on unmarked line twice, verify it cycles: none → redact → none. Same for no-render and block forms.

### Implementation for User Story 5

- [X] T064 [P] [US5] Verify toggle-off behavior works for inline redact markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T065 [P] [US5] Verify toggle-off behavior works for inline no-render markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T066 [P] [US5] Verify toggle-off behavior works for block redact markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T067 [P] [US5] Verify toggle-off behavior works for block no-render markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [ ] T068 [US5] Manual test: cycle line-level redact marker (none → marker → none)
- [ ] T069 [US5] Manual test: cycle line-level no-render marker (none → marker → none)
- [ ] T070 [US5] Manual test: cycle block-level redact markers (none → markers → none)
- [ ] T071 [US5] Manual test: cycle block-level no-render markers (none → markers → none)

**Checkpoint**: All core user stories (P1, P2, P3) complete

---

## Phase 8: Keyword Tripwire & Advanced Features

**Goal**: Implement "Juuden" keyword tripwire and edge case handling

- [X] T072 [P] Implement case-insensitive Juuden keyword detection in quartz/plugins/transformers/redactionMarkers.ts
- [X] T073 [P] Implement Juuden filtering for non-full modes (acts like redact) in quartz/plugins/transformers/redactionMarkers.ts
- [X] T074 [P] Implement Juuden preservation for full mode in quartz/plugins/transformers/redactionMarkers.ts
- [X] T075 [P] Implement topic-based filtering configuration flag in quartz/plugins/transformers/redactionMarkers.ts
- [X] T076 [P] Implement precedence rules (no-render > explicit redact > Juuden) in quartz/plugins/transformers/redactionMarkers.ts
- [X] T077 Implement nested marker handling logic in quartz/plugins/transformers/redactionMarkers.ts
- [X] T078 Implement malformed marker detection (unclosed blocks) in quartz/plugins/transformers/redactionMarkers.ts
- [X] T079 Integrate buildWarnings collection on malformed markers in quartz/plugins/transformers/redactionMarkers.ts
- [X] T080 Implement warning report generation at build completion in quartz/util/buildWarnings.ts
- [ ] T081 Manual test: verify lines with "Juuden" filtered in public mode
- [ ] T082 Manual test: verify lines with "Juuden" visible in full mode
- [ ] T083 Manual test: verify case-insensitive matching (juuden, JUUDEN, JuUdEn)
- [ ] T084 Manual test: verify malformed markers skip file and generate warning
- [ ] T085 Manual test: verify build-warnings.html created with error details

**Checkpoint**: All filtering logic complete and robust

---

## Phase 9: Visual Styling (Live Preview Enhancement)

**Goal**: Replace HTML comment markers with atomic widgets in Obsidian Live Preview for edit-safety

- [X] T086 [P] Create RedactMarkerWidget class extending WidgetType in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T087 [P] Implement toDOM method for RedactMarkerWidget in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T088 [P] Implement eq method for widget comparison in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T089 [P] Create BlockMarkerWidget class for block markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T090 Create ViewPlugin for marker widget replacement in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T091 Implement buildDecorations method to scan for HTML comments in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T092 Implement Decoration.replace() for inline markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T093 Implement Decoration.replace() for block markers in .obsidian/plugins/redaction-markers-dev/main.ts
- [X] T094 [P] Create CSS styles for .redaction-widget in .obsidian/plugins/redaction-markers-dev/styles.css
- [X] T095 [P] Create CSS styles for .redact-widget (orange/amber theme) in .obsidian/plugins/redaction-markers-dev/styles.css
- [X] T096 [P] Create CSS styles for .no-render-widget (red theme) in .obsidian/plugins/redaction-markers-dev/styles.css
- [X] T097 [P] Add dark theme variants for widget styles in .obsidian/plugins/redaction-markers-dev/styles.css
- [X] T098 Register editor extension (markerWidgetPlugin) in plugin onload in .obsidian/plugins/redaction-markers-dev/main.ts
- [ ] T099 Manual test: verify HTML comments replaced with widgets in Live Preview
- [ ] T100 Manual test: verify widgets are non-editable (contentEditable=false)
- [ ] T101 Manual test: verify widgets act as atomic units (cannot cursor into them)
- [ ] T102 Manual test: verify deleting widget removes underlying HTML comment
- [ ] T103 Manual test: verify widgets styled correctly (redact orange, no-render red)
- [ ] T104 Manual test: verify widgets work in both light and dark themes

**Checkpoint**: Visual enhancement complete - markers edit-safe and less intrusive

---

## Phase 10: Build & Deployment

**Goal**: Package plugin for deployment and finalize build integration

- [X] T105 Run npm run build to compile plugin to main.js in .obsidian/plugins/redaction-markers-dev/
- [X] T106 Copy main.js, manifest.json, styles.css to .obsidian/plugins/redaction-markers/
- [ ] T107 Test plugin loads correctly in Obsidian (Settings → Community Plugins)
- [ ] T108 Verify commands appear in command palette (Ctrl+P / Cmd+P)
- [ ] T109 Configure recommended hotkeys (Cmd+Shift+R for redact, Cmd+Shift+N for no-render)
- [ ] T110 Test full workflow: mark content in Obsidian → build in all 4 modes → verify filtering

**Checkpoint**: Plugin deployable and functional

---

## Phase 11: Documentation & Polish

**Purpose**: Update documentation and final integration

- [ ] T111 [P] Update ARCHITECTURE.md with Content Redaction Markers section in docs-custom/
- [ ] T112 [P] Document redactionMarkers transformer logic in docs-custom/ARCHITECTURE.md
- [ ] T113 [P] Document Juuden keyword tripwire in docs-custom/ARCHITECTURE.md
- [ ] T114 [P] Document build warnings system in docs-custom/ARCHITECTURE.md
- [ ] T115 [P] Note hideInBuild removal and migration path in docs-custom/ARCHITECTURE.md
- [ ] T116 [P] Update CLAUDE.md Quick Reference with redactionMarkers location in docs-custom/
- [ ] T117 [P] Update CLAUDE.md Quick Reference with plugin location in docs-custom/
- [ ] T118 [P] Update CLAUDE.md Quick Reference with build-warnings.html location in docs-custom/
- [ ] T119 Create migration.md guide for hideInBuild → redaction markers in specs/004-redaction-markers/
- [ ] T120 Run all edge case tests from spec.md Edge Cases section
- [ ] T121 Run all acceptance scenarios from spec.md User Stories
- [ ] T122 Validate quickstart.md test scenarios work correctly
- [ ] T123 Verify no regressions in existing publish mode functionality

**Checkpoint**: Documentation complete, all tests passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User Story 1 (Phase 3): Can start after Foundational - No dependencies on other stories
  - User Story 2 (Phase 4): Can start after Foundational - Independent of US1 (different marker type)
  - User Story 3 (Phase 5): Can start after Foundational - Extends US1 (block form of redact)
  - User Story 4 (Phase 6): Can start after Foundational - Extends US2 (block form of no-render)
  - User Story 5 (Phase 7): Validation phase - verifies US1-4 toggle behavior
- **Advanced Features (Phase 8)**: Can start after Foundational - Independent of user stories
- **Visual Styling (Phase 9)**: Can start after Phase 3-4 (needs basic markers working)
- **Build & Deployment (Phase 10)**: Depends on all core implementation (Phases 3-9)
- **Documentation (Phase 11)**: Depends on all implementation being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only - fully independent
- **User Story 2 (P1)**: Foundational only - fully independent
- **User Story 3 (P2)**: Foundational + conceptually extends US1 but independently testable
- **User Story 4 (P2)**: Foundational + conceptually extends US2 but independently testable
- **User Story 5 (P3)**: Foundational + validates US1-4 but doesn't add new implementation

### Within Each User Story

- Transformer logic before editor plugin integration
- Detection logic before insertion/removal logic
- Command registration after all helper functions complete
- Manual tests after implementation complete

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks (T001-T006) can run in parallel

**Phase 2 (Foundational)**:
- Transformer tasks (T007-T010) can run in parallel
- Utility tasks (T011-T013) can run in parallel
- Export/config tasks (T014-T016) sequential (after transformer complete)

**Phase 3-4 (US1 & US2 P1 Stories)**:
- US1 and US2 can be developed in parallel by different developers
- Within each story, transformer tasks can run in parallel with editor tasks
- T018-T020 parallel (US1 transformer logic)
- T021-T026 sequential (US1 editor integration)
- T031-T032 parallel (US2 transformer logic)
- T033-T036 sequential (US2 editor integration)

**Phase 5-6 (US3 & US4 P2 Stories)**:
- US3 and US4 can be developed in parallel
- T041-T044 parallel (US3 transformer logic)
- T045-T049 sequential (US3 editor integration)
- T054-T056 parallel (US4 transformer logic)
- T057-T059 sequential (US4 editor integration)

**Phase 7 (US5 Validation)**:
- T064-T067 all parallel (verification tasks, no implementation)

**Phase 8 (Advanced Features)**:
- T072-T076 all parallel (different feature areas)
- T077-T080 sequential (precedence → nesting → malformed detection → warnings)

**Phase 9 (Visual Styling)**:
- T086-T089 parallel (widget class implementations)
- T094-T097 parallel (CSS styling)
- T090-T093 sequential (ViewPlugin integration)

**Phase 11 (Documentation)**:
- T111-T118 all parallel (different documentation files)

---

## Parallel Example: User Story 1

```bash
# Launch transformer logic in parallel:
Task: "T018 [P] [US1] Implement inline redact marker detection logic"
Task: "T019 [P] [US1] Implement inline redact marker filtering for non-full modes"
Task: "T020 [P] [US1] Implement inline redact marker removal for full mode"

# Then sequentially build editor integration:
Task: "T021 [P] [US1] Create toggle-redact command skeleton"
Task: "T022 [US1] Implement line detection logic"
Task: "T023 [US1] Implement hasInlineMarker detection"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Line-level redaction)
4. Complete Phase 4: User Story 2 (Line-level no-render)
5. **STOP and VALIDATE**: Test both P1 stories independently
6. Deploy/demo if ready - core value delivered

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP deliverable (redact)
3. Add User Story 2 → Test independently → MVP enhanced (no-render)
4. Add User Story 3 → Test independently → Block redaction
5. Add User Story 4 → Test independently → Block no-render
6. Add Advanced Features (Phase 8) → Keyword tripwire + error handling
7. Add Visual Styling (Phase 9) → Enhanced UX
8. Each increment adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (Phases 1-2)
2. **Once Foundational is done**:
   - Developer A: User Story 1 (Phase 3) + User Story 3 (Phase 5)
   - Developer B: User Story 2 (Phase 4) + User Story 4 (Phase 6)
   - Developer C: Advanced Features (Phase 8)
   - Developer D: Visual Styling (Phase 9)
3. **Integration**: User Story 5 validation + Build & Deployment (Phases 7, 10)
4. **Documentation**: Phase 11 (can be parallelized across team)

---

## Notes

- [P] tasks = different files, no dependencies
- [US#] label maps task to specific user story for traceability
- Transformer logic (Quartz) is separate from editor logic (Obsidian plugin)
- Tests are manual as no automated test suite was requested in spec
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Malformed markers fail-safe: skip file, generate warning, continue build
