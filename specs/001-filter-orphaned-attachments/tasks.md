# Implementation Tasks: Filter Orphaned Attachments

**Feature**: 001-filter-orphaned-attachments
**Branch**: `001-filter-orphaned-attachments`
**Generated**: 2025-10-27

## Overview

This document breaks down the implementation of the attachment filtering feature into executable tasks organized by user story. Each phase represents a complete, independently testable increment.

**Total Tasks**: 31
**Estimated Implementation Time**: 8-12 hours
**MVP Scope**: Phase 3 (User Story 1) - Critical security fix

---

## Implementation Strategy

### Incremental Delivery Approach

1. **MVP First** (Phase 1-3): Deliver User Story 1 (P1) - Prevent Private Attachment Exposure
   - This is the critical security fix
   - Can be deployed independently
   - Delivers immediate value

2. **Incremental Enhancements** (Phase 4-5): Add US2 and US3
   - US2 ensures all link formats work (likely already covered by US1 implementation)
   - US3 adds robustness for edge cases

3. **Polish** (Phase 6): Documentation and refinements

### Parallel Execution Opportunities

Tasks marked with `[P]` can be executed in parallel with other `[P]` tasks in the same phase, as they operate on different files with no shared dependencies.

---

## Phase 1: Setup & Prerequisites

**Goal**: Set up project structure and verify build environment

**Duration**: 15-30 minutes

### Tasks

- [x] T001 Verify Node.js version (>=22) and npm version (>=10.9.2)
- [x] T002 Run `npm install` to ensure all dependencies are installed
- [x] T003 Run `npx tsc --noEmit` to verify TypeScript compilation works
- [x] T004 Run `npx quartz build --serve` to verify existing build works
- [ ] T005 Create test fixtures directory at `content/test-attachment-filtering/`

**Completion Criteria**:
- ✅ Build environment verified
- ✅ Dependencies installed
- ✅ TypeScript compiles without errors
- ✅ Existing Quartz build succeeds

---

## Phase 2: Foundational Infrastructure

**Goal**: Create core utilities and type extensions that all user stories depend on

**Duration**: 2-3 hours

**Blocking**: These tasks MUST complete before any user story implementation

### Tasks

- [x] T006 [P] Create `quartz/util/attachments.ts` with `isAbsolutePath()` function
- [x] T007 [P] Implement `isValidAttachmentReference()` helper in `quartz/util/attachments.ts`
- [x] T008 [P] Implement `extractAttachments()` function in `quartz/util/attachments.ts` (scans HTML AST for img, video, audio, iframe, a elements)
- [x] T009 [P] Implement `shouldCopyAttachment()` function in `quartz/util/attachments.ts` (checks whitelist before copying)
- [x] T010 [P] Add `AttachmentWhitelist` interface to `quartz/util/ctx.ts` (paths Set, stats, optional references Map)
- [x] T011 [P] Add `BuildState` interface to `quartz/util/ctx.ts` (contains attachmentWhitelist field)
- [x] T012 [P] Extend `BuildCtx` interface in `quartz/util/ctx.ts` with optional `state?: BuildState` field
- [x] T013 Run `npx tsc --noEmit` to verify all type definitions compile

**Completion Criteria**:
- ✅ All utility functions implemented in `quartz/util/attachments.ts`
- ✅ BuildCtx extended with state field
- ✅ TypeScript compilation passes
- ✅ Functions follow contracts in `specs/001-filter-orphaned-attachments/contracts/plugin-api.md`

**Independent Test**:
```bash
# Create a simple test file to verify utilities work
cat > test-utils.ts << 'EOF'
import { isAbsolutePath, extractAttachments } from "./quartz/util/attachments"

console.log("Unix absolute:", isAbsolutePath("/var/files/doc.pdf")) // true
console.log("Windows absolute:", isAbsolutePath("C:\\files\\doc.pdf")) // true
console.log("Relative:", isAbsolutePath("./images/photo.jpg")) // false
EOF

npx tsx test-utils.ts
rm test-utils.ts
```

---

## Phase 3: User Story 1 - Prevent Private Attachment Exposure (P1) 🎯 MVP

**Goal**: Implement core attachment filtering to prevent private attachments from being accessible on public tiers

**Priority**: P1 (Critical Security Fix)

**Duration**: 3-4 hours

**User Story**:
> As a vault owner with sensitive attachments, I need the build system to automatically exclude attachments from filtered pages so that private images, PDFs, and other media files don't become publicly accessible when their source pages are filtered out.

### Acceptance Scenarios

1. ✅ Page with `publish: "[[Trusted]]"` + image → Public tier EXCLUDES image
2. ✅ Two pages reference same attachment, one filtered → Attachment INCLUDED (at least one published page)
3. ✅ Page with `publish: "[[Public]]"` + image → ALL tiers INCLUDE image
4. ✅ Orphaned attachment (no references) → Attachment EXCLUDED from all tiers

### Tasks

- [x] T014 [US1] Create `quartz/plugins/filters/attachmentWhitelist.ts` file with plugin skeleton
- [x] T015 [US1] Implement `Options` interface in `attachmentWhitelist.ts` (verbose, trackReferences fields)
- [x] T016 [US1] Implement `AttachmentWhitelist` plugin's `shouldPublish()` method (initialize whitelist, extract attachments, update stats, return true)
- [x] T017 [US1] Add whitelist initialization logic in `shouldPublish()` (check ctx.state, create if missing)
- [x] T018 [US1] Add attachment extraction and whitelist population in `shouldPublish()` (call extractAttachments, add to Set)
- [x] T019 [US1] Add statistics tracking in `shouldPublish()` (totalReferences, uniqueAttachments, pagesScanned)
- [x] T020 [US1] Export `AttachmentWhitelist` in `quartz/plugins/filters/index.ts`
- [x] T021 [US1] Modify `quartz/plugins/emitters/assets.ts` to import `shouldCopyAttachment` utility
- [x] T022 [US1] Update `emit()` method in `assets.ts` to check whitelist before copying (add filtering loop)
- [x] T023 [US1] Add statistics logging in `assets.ts` (copied count, filtered count, summary)
- [x] T024 [US1] Update `partialEmit()` method in `assets.ts` for watch mode whitelist checking
- [x] T025 [US1] Add `Plugin.AttachmentWhitelist({ verbose: false })` to filter chain in `quartz.config.ts` (AFTER PublishMode)
- [x] T026 [US1] Run `npx tsc --noEmit` to verify implementation compiles

**Completion Criteria**:
- ✅ AttachmentWhitelist filter plugin complete and exported
- ✅ Assets emitter modified to check whitelist
- ✅ Plugin configured in quartz.config.ts
- ✅ TypeScript compilation passes
- ✅ All four acceptance scenarios pass (verified manually)

**Independent Test** (Manual):
```bash
# Setup test fixtures
mkdir -p content/test-attachment-filtering/attachments

# Create test pages
cat > content/test-attachment-filtering/test-public.md << 'EOF'
---
title: Public Test Page
publish: "[[Public]]"
---
![Public Image](attachments/public.png)
EOF

cat > content/test-attachment-filtering/test-trusted.md << 'EOF'
---
title: Trusted Test Page
publish: "[[Trusted]]"
---
![Trusted Image](attachments/trusted.png)
EOF

cat > content/test-attachment-filtering/test-private.md << 'EOF'
---
title: Private Test Page
---
![Private Image](attachments/private.png)
EOF

# Create dummy attachment files
touch content/test-attachment-filtering/attachments/{public,trusted,private,orphan}.png

# Test 1: Public tier should ONLY have public.png
npx quartz build --publish-mode public
ls public/attachments/ | grep -E '^public\.png$' && echo "✅ Public attachment found" || echo "❌ FAIL"
ls public/attachments/ | grep -E '^(trusted|private|orphan)\.png$' && echo "❌ FAIL: Private attachments exposed" || echo "✅ Private attachments filtered"

# Test 2: Full tier should have public, trusted, private (NOT orphan)
npx quartz build --publish-mode full
ls public/attachments/ | grep -E '^(public|trusted|private)\.png$' | wc -l | grep 3 && echo "✅ Referenced attachments found" || echo "❌ FAIL"
ls public/attachments/ | grep -E '^orphan\.png$' && echo "❌ FAIL: Orphan not filtered" || echo "✅ Orphan filtered"

# Cleanup
rm -rf content/test-attachment-filtering
```

---

## Phase 4: User Story 2 - Support Multiple Link Formats (P2)

**Goal**: Ensure all common markdown link formats are correctly detected and filtered

**Priority**: P2

**Duration**: 1-2 hours

**User Story**:
> As a vault owner who uses various markdown linking conventions, I need the system to recognize and track attachment references in all common markdown link formats so that attachments are filtered correctly regardless of how they're referenced.

### Acceptance Scenarios

1. ✅ Obsidian wikilink `![[attachment.pdf]]` detected
2. ✅ Markdown image `![Image](./images/photo.jpg)` detected
3. ✅ Markdown link `[Download PDF](../files/document.pdf)` detected
4. ✅ Multiple references to same attachment deduplicated

### Tasks

- [ ] T027 [US2] Verify `extractAttachments()` handles wikilink format (already implemented via CrawlLinks transformer - test only)
- [ ] T028 [US2] Verify `extractAttachments()` handles markdown image format (test img elements - likely already works)
- [ ] T029 [US2] Verify `extractAttachments()` handles markdown link format (test a elements with href - likely already works)
- [ ] T030 [US2] Verify deduplication works (Set automatically deduplicates - test only)

**Note**: These tasks are primarily verification, as the foundational `extractAttachments()` function (T008) scans all `img`, `video`, `audio`, `iframe`, and `a` elements from the HTML AST. By the time content reaches the filter plugin, wikilinks have been converted to standard HTML elements by the ObsidianFlavoredMarkdown transformer. These tasks confirm the implementation already handles all formats.

**Completion Criteria**:
- ✅ All four link formats correctly detected
- ✅ Deduplication confirmed working
- ✅ No false positives or false negatives

**Independent Test** (Manual):
```bash
# Create test page with multiple link formats
mkdir -p content/test-formats/files

cat > content/test-formats/multi-format.md << 'EOF'
---
title: Multi-Format Test
publish: "[[Public]]"
---

# Testing Multiple Link Formats

Wikilink: ![[files/wikilink.pdf]]

Markdown image: ![Photo](./files/markdown.jpg)

Markdown link: [Download](files/regular.pdf)

Multiple refs to same file:
![[files/shared.png]]
![Shared](files/shared.png)
[Link to shared](files/shared.png)
EOF

# Create dummy files
touch content/test-formats/files/{wikilink.pdf,markdown.jpg,regular.pdf,shared.png}

# Build public tier
npx quartz build --publish-mode public

# Verify all formats detected
ls public/files/ | grep -E '^(wikilink\.pdf|markdown\.jpg|regular\.pdf|shared\.png)$' | wc -l | grep 4 && echo "✅ All formats detected" || echo "❌ FAIL"

# Verify shared.png only copied once (not 3 times)
find public/files/ -name "shared.png" | wc -l | grep 1 && echo "✅ Deduplication works" || echo "❌ FAIL"

# Cleanup
rm -rf content/test-formats
```

---

## Phase 5: User Story 3 - Handle Complex Attachment Scenarios (P3)

**Goal**: Add robustness for edge cases: subdirectories, multiple file types, symlinks, missing files

**Priority**: P3

**Duration**: 2-3 hours

**User Story**:
> As a vault owner with organized media files, I need the system to correctly handle attachments in subdirectories, multiple file types, and shared attachments so that the filtering logic works correctly across all organizational structures.

### Acceptance Scenarios

1. ✅ Subdirectories (`content/images/`, `content/files/`) preserve structure in output
2. ✅ Attachment referenced by 3 pages (Public, Trusted, Full) → Trusted tier includes it
3. ✅ Same scenario → Public tier includes it
4. ✅ Various file types (PNG, PDF, MP4) handled correctly

### Tasks

- [ ] T031 [P] [US3] Add symlink resolution in `assets.ts` `copyFile()` function (use fs.promises.lstat + fs.promises.realpath)
- [ ] T032 [P] [US3] Add missing file handling in `assets.ts` `copyFile()` (wrap in try-catch, log warning on ENOENT)
- [ ] T033 [P] [US3] Add URL decoding in `extractAttachments()` for encoded filenames (already uses decodeURIComponent - verify only)
- [ ] T034 [US3] Test subdirectory handling with fixtures (create nested folder structure)
- [ ] T035 [US3] Test shared attachment across tiers (page on each tier referencing same file)
- [ ] T036 [US3] Test multiple file types (PNG, JPG, PDF, MP4, MP3)

**Completion Criteria**:
- ✅ Symlinks resolved and copied correctly
- ✅ Missing files logged as warnings, build continues
- ✅ URL-encoded filenames handled
- ✅ Subdirectory structure preserved
- ✅ Shared attachments work correctly across tiers
- ✅ All file types handled

**Independent Test** (Manual):
```bash
# Create complex structure
mkdir -p content/test-complex/{images/nested,docs,media}

# Test 1: Subdirectories
cat > content/test-complex/subdir-test.md << 'EOF'
---
title: Subdirectory Test
publish: "[[Public]]"
---
![Nested](images/nested/deep.png)
[Doc](docs/file.pdf)
EOF

touch content/test-complex/images/nested/deep.png
touch content/test-complex/docs/file.pdf

npx quartz build --publish-mode public
test -f public/images/nested/deep.png && echo "✅ Subdirectory structure preserved" || echo "❌ FAIL"

# Test 2: Symlink resolution
ln -s "$(pwd)/content/test-complex/docs/file.pdf" content/test-complex/linked.pdf

cat > content/test-complex/symlink-test.md << 'EOF'
---
title: Symlink Test
publish: "[[Public]]"
---
[Linked](linked.pdf)
EOF

npx quartz build --publish-mode public
test -f public/linked.pdf && echo "✅ Symlink resolved" || echo "❌ FAIL"

# Test 3: Missing file handling
cat > content/test-complex/missing-test.md << 'EOF'
---
title: Missing File Test
publish: "[[Public]]"
---
![Missing](does-not-exist.png)
EOF

npx quartz build --publish-mode public 2>&1 | grep "Referenced attachment not found: does-not-exist.png" && echo "✅ Missing file warning logged" || echo "❌ FAIL"

# Test 4: Multiple file types
touch content/test-complex/{media/video.mp4,media/audio.mp3,images/photo.jpg}

cat > content/test-complex/filetypes-test.md << 'EOF'
---
title: File Types Test
publish: "[[Public]]"
---
![Image](images/photo.jpg)
[Video](media/video.mp4)
[Audio](media/audio.mp3)
EOF

npx quartz build --publish-mode public
ls public/media/ | grep -E '^(video\.mp4|audio\.mp3)$' | wc -l | grep 2 && echo "✅ Media files handled" || echo "❌ FAIL"
ls public/images/ | grep "photo.jpg" && echo "✅ Image files handled" || echo "❌ FAIL"

# Cleanup
rm -rf content/test-complex
```

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Documentation, logging refinements, and final verification

**Duration**: 1-2 hours

### Tasks

- [x] T037 [P] Add comprehensive logging to `AttachmentWhitelist` plugin (summary on completion with stats)
- [ ] T038 [P] Add verbose logging option testing (enable verbose: true, verify detailed logs)
- [x] T039 [P] Update `docs-custom/ARCHITECTURE.md` with "Attachment Filtering" section (copy template from quickstart.md)
- [x] T040 [P] Update `docs-custom/CLAUDE.md` custom features table with AttachmentWhitelist entry
- [x] T041 [P] Update `docs-custom/FUTURE_TASKS.md` to move "Orphaned Attachments" task to Completed section
- [ ] T042 Run full build across all 4 publish modes to verify no regressions
- [ ] T043 Verify build time increase is <2x baseline (performance requirement SC-004)
- [ ] T044 Run final `npx tsc --noEmit` to ensure no type errors
- [ ] T045 Clean up any test fixtures from manual testing

**Completion Criteria**:
- ✅ Logging provides clear audit trail
- ✅ Documentation updated
- ✅ All publish modes build successfully
- ✅ Performance targets met
- ✅ No TypeScript errors

**Final Verification**:
```bash
# Measure baseline build time (without feature)
time npx quartz build --publish-mode full

# Enable feature and measure again
# (Feature is already enabled from previous phases)

# Build all tiers
for mode in full trusted shachu public; do
  echo "Building $mode tier..."
  npx quartz build --publish-mode $mode || echo "❌ FAIL: $mode tier build failed"
done

# Verify logs
npx quartz build --publish-mode public 2>&1 | grep -E '\[AttachmentWhitelist\]|\[Assets\]' && echo "✅ Logging works" || echo "❌ FAIL"

echo "✅ All tasks complete!"
```

---

## Task Summary

### By Phase

| Phase | Tasks | Duration | Blocking |
|-------|-------|----------|----------|
| Phase 1: Setup | T001-T005 (5 tasks) | 15-30 min | No |
| Phase 2: Foundational | T006-T013 (8 tasks) | 2-3 hours | **YES** - Required for all user stories |
| Phase 3: US1 (MVP) 🎯 | T014-T026 (13 tasks) | 3-4 hours | No (depends on Phase 2) |
| Phase 4: US2 | T027-T030 (4 tasks) | 1-2 hours | No (mostly verification) |
| Phase 5: US3 | T031-T036 (6 tasks) | 2-3 hours | No (edge cases) |
| Phase 6: Polish | T037-T045 (9 tasks) | 1-2 hours | No |
| **TOTAL** | **45 tasks** | **8-12 hours** | |

### By User Story

| User Story | Priority | Tasks | Status |
|-----------|----------|-------|--------|
| US1: Prevent Private Attachment Exposure | P1 | T014-T026 (13) | 🎯 **MVP** |
| US2: Support Multiple Link Formats | P2 | T027-T030 (4) | Enhancement |
| US3: Handle Complex Scenarios | P3 | T031-T036 (6) | Edge cases |

### Parallel Execution Opportunities

**Phase 2 (Foundational)**: Tasks T006-T012 can all run in parallel (7 parallel threads)
- T006: `isAbsolutePath()` in attachments.ts
- T007: `isValidAttachmentReference()` in attachments.ts
- T008: `extractAttachments()` in attachments.ts
- T009: `shouldCopyAttachment()` in attachments.ts
- T010: `AttachmentWhitelist` interface in ctx.ts
- T011: `BuildState` interface in ctx.ts
- T012: Extend `BuildCtx` in ctx.ts

**Phase 6 (Polish)**: Tasks T037-T041 can run in parallel (5 parallel threads)
- T037: Logging in AttachmentWhitelist
- T038: Verbose logging testing
- T039: Update ARCHITECTURE.md
- T040: Update CLAUDE.md
- T041: Update FUTURE_TASKS.md

---

## Dependencies

### User Story Dependencies

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundational) ← BLOCKING
  ↓
  ├─→ Phase 3 (US1) 🎯 MVP ← Can ship independently
  ├─→ Phase 4 (US2) ← Independent (mostly verification)
  └─→ Phase 5 (US3) ← Independent (edge cases)
  ↓
Phase 6 (Polish)
```

### Critical Path

1. Phase 1: Setup (5 tasks) → **30 minutes**
2. Phase 2: Foundational (8 tasks, 7 parallelizable) → **2-3 hours** ⚠️ BLOCKING
3. Phase 3: US1 (13 tasks) → **3-4 hours** 🎯 **MVP DELIVERY**
4. Phase 6: Polish (9 tasks, 5 parallelizable) → **1-2 hours**

**Minimum MVP Delivery Time**: ~6-8 hours (Phases 1, 2, 3, partial 6)

---

## Testing Strategy

### Manual Testing (Integrated into tasks)

Each user story phase includes "Independent Test" scripts that verify acceptance scenarios.

**Coverage**:
- US1: Security (private attachment filtering)
- US2: Link format detection
- US3: Edge cases (symlinks, missing files, file types, subdirectories)

### Automated Testing (Optional)

The spec does NOT explicitly request automated tests, so unit/integration test tasks are **not included**. However, if desired, add these tasks to Phase 6:

```
- [ ] T046 [P] Create tests/attachment-filtering/attachment-filter.test.ts
- [ ] T047 [P] Write unit tests for extractAttachments() function
- [ ] T048 [P] Write unit tests for shouldCopyAttachment() function
- [ ] T049 [P] Write unit tests for isAbsolutePath() function
- [ ] T050 Create tests/attachment-filtering/integration.test.ts
- [ ] T051 Write integration test for US1 scenario 1
- [ ] T052 Write integration test for US1 scenario 2
- [ ] T053 Write integration test for US1 scenario 3
- [ ] T054 Write integration test for US1 scenario 4
- [ ] T055 Run npm test to verify all tests pass
```

---

## Success Criteria Verification

### After MVP (Phase 3)

- [ ] **SC-001**: Private attachments inaccessible via direct URL on public tiers (test with curl)
- [ ] **SC-002**: All referenced attachments included (100% inclusion rate)
- [ ] **SC-003**: Unreferenced attachments excluded (100% exclusion rate)
- [ ] **SC-004**: Build time <2x baseline (measure with `time` command)
- [ ] **SC-007**: Build logs indicate filtered vs. included counts

### After All Phases

- [ ] **SC-005**: All link formats parsed correctly (wikilinks, markdown, HTML)
- [ ] **SC-006**: Hierarchical inheritance works (Public → all tiers, Trusted → Full+Trusted, etc.)
- [ ] **SC-008**: Zero false positives/negatives in test scenarios

---

## Rollback Plan

If issues arise during implementation:

1. **After Phase 2**: No user-visible changes yet. Can abandon safely.
2. **During Phase 3**: Remove AttachmentWhitelist from `quartz.config.ts` to disable feature immediately
3. **After Phase 3**: Feature is opt-in. If problems occur, comment out plugin in config to restore baseline behavior
4. **Production issue**: Revert commit(s), redeploy. All attachments will be copied (original behavior)

---

## Notes

- **Backward Compatibility**: Feature is opt-in via plugin configuration. Existing Quartz installations unaffected.
- **Performance**: Foundational implementation (T006-T013) is optimized for O(n) scanning. Additional optimization not needed unless vaults exceed 10k pages.
- **Security**: This feature addresses a HIGH priority security gap (constitution line 93-96). US1 (MVP) closes the vulnerability.
- **Testing**: Manual testing integrated into tasks. Automated tests optional (not explicitly requested in spec).
- **Documentation**: Phase 6 includes comprehensive docs updates (ARCHITECTURE.md, CLAUDE.md, FUTURE_TASKS.md).

---

**Ready to implement!** Start with Phase 1, complete the blocking Phase 2, then deliver MVP (Phase 3) for immediate security value.
