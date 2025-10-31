# Tasks: Large File Handling via CDN

**Input**: Design documents from `/specs/002-large-file-handling/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in specification - manual testing across four publish modes will be performed

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure (Quartz TypeScript project):
- **Core plugins**: `quartz/plugins/transformers/`, `quartz/plugins/emitters/`
- **Utilities**: `quartz/util/`
- **Configuration**: `quartz/cfg.ts`, `quartz.config.ts`
- **Documentation**: `docs-custom/`
- **Environment**: `.env.example`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and R2/Zero Trust infrastructure setup

- [ ] T001 Install AWS S3 SDK dependency in package.json (`@aws-sdk/client-s3`)
- [ ] T002 Create .env.example file documenting R2 environment variables (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CDN_DOMAIN_*, R2_BUCKET_*)
- [ ] T003 [P] Create TypeScript type definitions for R2 configuration in quartz/cfg.ts
- [ ] T004 [P] Create directory structure: quartz/util/ (if not exists), .quartz-cache/ (for CDN mappings)
- [ ] T005 Follow quickstart.md to set up 4 R2 buckets in Cloudflare dashboard (vault-files-full, vault-files-trusted, vault-files-shachu, vault-files-public)
- [ ] T006 Follow quickstart.md to configure custom domains (cdn-full.dario.ca, cdn-trusted.dario.ca, cdn-shachu.dario.ca, cdn-public.dario.ca)
- [ ] T007 Follow quickstart.md to create Cloudflare Access policies for Full, Trusted, and Shachu tiers
- [ ] T008 Follow quickstart.md to configure environment variables in all four Cloudflare Pages projects
- [ ] T009 Follow quickstart.md to generate R2 API tokens and add to Cloudflare Pages environment variables

**Checkpoint**: Infrastructure ready - R2 buckets, Zero Trust policies, environment variables configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and data structures that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 [P] Create hash utility module in quartz/util/hash.ts with computeFileHash function (SHA-256 streaming)
- [ ] T011 [P] Create CDN utility module in quartz/util/cdn.ts with R2Client wrapper class
- [ ] T012 [US1] Implement R2Client.uploadFile method in quartz/util/cdn.ts with exponential backoff retry (1s, 2s, 4s delays, 3 attempts)
- [ ] T013 [P] [US1] Implement R2Client.deleteFile method in quartz/util/cdn.ts
- [ ] T014 [P] [US1] Implement R2Client.listFiles method in quartz/util/cdn.ts for orphan detection
- [ ] T015 [US1] Create AccessLevel enum and bucket/domain mapping constants in quartz/util/cdn.ts
- [ ] T016 [US1] Implement generateR2Key function in quartz/util/cdn.ts (preserves directory structure + hash prefix)
- [ ] T017 [P] [US1] Create CDN mapping cache loader/saver functions in quartz/util/cdn.ts (reads/writes .quartz-cache/cdn-mappings.json)
- [ ] T018 [US1] Create TypeScript interfaces for LargeFile, FileReference, CDNMapping, UploadStatus per data-model.md in quartz/util/cdn.ts
- [ ] T019 [US1] Implement resolveAccessLevel function in quartz/util/cdn.ts (determines least restrictive access level from multiple note publish modes)

**Checkpoint**: Foundation ready - all utility functions and data structures exist, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Access Large Files Without 404 Errors (Priority: P1) 🎯 MVP

**Goal**: Detect files >20MB, upload to appropriate R2 bucket based on access level, make them accessible via CDN URLs

**Independent Test**: Create a note with link to 25MB+ file, build site, verify authorized user can download file from CDN URL

### Implementation for User Story 1

- [ ] T020 [P] [US1] Create transformer plugin skeleton in quartz/plugins/transformers/largefile.ts (export LargeFileDetector class extending QuartzTransformerPlugin)
- [ ] T021 [P] [US1] Create emitter plugin skeleton in quartz/plugins/emitters/cdnUploader.ts (export CDNUploader class extending QuartzEmitterPlugin)
- [ ] T022 [US1] Implement file reference detection in largefile.ts transformer (scan markdown AST for links, resolve paths, check file sizes)
- [ ] T023 [US1] Implement FileReference entity creation in largefile.ts for files >20MB
- [ ] T024 [US1] Implement LargeFile entity aggregation in largefile.ts (group FileReferences by resolved path, collect referencing notes)
- [ ] T025 [US1] Implement access level resolution in largefile.ts using resolveAccessLevel utility (determines bucket per file based on note publish modes)
- [ ] T026 [US1] Implement file hash computation in largefile.ts using computeFileHash utility
- [ ] T027 [US1] Implement CDN mapping cache check in largefile.ts (skip upload if hash exists in cache with status = Skipped)
- [ ] T028 [US1] Pass LargeFile entities from transformer to emitter via plugin context/shared state
- [ ] T029 [US1] Implement upload orchestration in cdnUploader.ts emitter (load CDN mapping cache, filter files with status = Pending)
- [ ] T030 [US1] Implement sequential upload logic in cdnUploader.ts for ≤50 files (calls R2Client.uploadFile for each)
- [ ] T031 [US1] Implement parallel upload logic in cdnUploader.ts for >50 files (batches of 10 concurrent uploads using Promise.all)
- [ ] T032 [US1] Implement CDN mapping cache updates in cdnUploader.ts after successful uploads
- [ ] T033 [US1] Implement build failure handling in cdnUploader.ts if upload fails after retries (throw error with file path and attempt count)
- [ ] T034 [US1] Implement build logging in cdnUploader.ts (log uploaded files, access levels, skipped files)
- [ ] T035 [US1] Export new plugins in quartz/plugins/index.ts
- [ ] T036 [US1] Add LargeFileDetector transformer to plugin chain in quartz.config.ts (after PublishMode filter)
- [ ] T037 [US1] Add CDNUploader emitter to plugin chain in quartz.config.ts
- [ ] T038 [US1] Test with 25MB test file in content/test-public.md, build with --publish-mode public, verify file uploaded to vault-files-public bucket
- [ ] T039 [US1] Test CDN URL accessibility: visit https://cdn-public.dario.ca/[path] in browser, verify file downloads
- [ ] T040 [US1] Test with duplicate filenames in different folders (e.g., docs/paper.pdf and research/paper.pdf), verify no collisions

**Checkpoint**: At this point, large files are detected, uploaded to R2, and accessible via CDN. Files ≤20MB remain unchanged. User Story 1 is fully functional but links still point to local paths (will be fixed in US3).

---

## Phase 4: User Story 3 - Zero Trust Access Control for CDN Files (Priority: P2)

**Goal**: Ensure CDN files enforce same Cloudflare Zero Trust access controls as notes they're linked from

**Why before US2**: Security is more critical than UX polish; US2 (link rewriting) builds on this foundation

**Independent Test**: Create large file in trusted-only note, build for trusted mode, attempt access as unauthenticated user (should be blocked) and as trusted user (should succeed)

### Implementation for User Story 3

- [ ] T041 [US3] Verify in largefile.ts that access level resolution correctly maps publish modes to AccessLevel enum (Public > Shachu > Trusted > Full hierarchy)
- [ ] T042 [US3] Verify in cdnUploader.ts that files upload to correct bucket based on accessLevel (vault-files-full, vault-files-trusted, vault-files-shachu, vault-files-public)
- [ ] T043 [US3] Test multi-reference scenario: Create file referenced by both public and trusted notes, verify uploaded to vault-files-public (least restrictive)
- [ ] T044 [US3] Test Full-tier file: Create file in note with no publish field, build for full mode, verify uploaded to vault-files-full bucket
- [ ] T045 [US3] Test Trusted-tier authentication: Build with trusted file, attempt direct CDN URL access as unauthenticated user, verify Cloudflare Access blocks and requires Google auth
- [ ] T046 [US3] Test Trusted-tier authentication: Same file, authenticate as trusted user, verify download succeeds
- [ ] T047 [US3] Test Public-tier accessibility: Build with public file, access CDN URL without authentication, verify download succeeds
- [ ] T048 [US3] Test Shachu-tier authentication: Build with shachu file, verify shachu member can access, public-tier user cannot
- [ ] T049 [US3] Test session expiration: Access restricted file while authenticated, logout/clear session, attempt access again, verify blocked
- [ ] T050 [US3] Document Zero Trust policy verification process in docs-custom/ARCHITECTURE.md

**Checkpoint**: At this point, all CDN files enforce proper tier-based authentication via Cloudflare Zero Trust. No security holes for direct URL access.

---

## Phase 5: User Story 2 - Automatic Link Rewriting for Seamless Experience (Priority: P3)

**Goal**: Automatically rewrite markdown links to large files to point to CDN URLs during build

**Independent Test**: Create note with links to various file sizes, build site, verify >20MB links point to CDN URLs, ≤20MB links unchanged

### Implementation for User Story 2

- [ ] T051 [P] [US2] Implement CDN URL generation in largefile.ts (construct full https://cdn-[tier].dario.ca/[path] URL from LargeFile entity)
- [ ] T052 [US2] Store generated CDN URLs in LargeFile entities in largefile.ts transformer
- [ ] T053 [US2] Implement link rewriting logic in largefile.ts transformer (replace original link href with CDN URL for files with requiresRewriting = true)
- [ ] T054 [US2] Preserve alt text and link text during rewriting in largefile.ts
- [ ] T055 [US2] Handle markdown links [text](path) rewriting in largefile.ts
- [ ] T056 [US2] Handle wiki links ![[file]] rewriting in largefile.ts
- [ ] T057 [US2] Handle image embeds ![alt](path) rewriting in largefile.ts
- [ ] T058 [US2] Ensure files ≤20MB are not rewritten (links remain unchanged) in largefile.ts
- [ ] T059 [US2] Test link rewriting: Create note with mix of file sizes (10MB, 20MB exactly, 25MB), verify only >20MB links rewritten
- [ ] T060 [US2] Test relative path handling: Use ../docs/file.pdf link, verify resolved and rewritten correctly
- [ ] T061 [US2] Test absolute path handling: Use /docs/file.pdf link, verify resolved and rewritten correctly
- [ ] T062 [US2] Test deduplication: Create file referenced in multiple notes, verify single upload and all links point to same CDN URL
- [ ] T063 [US2] Test file growth: Create 15MB file, build, verify regular link; grow to 25MB, rebuild, verify CDN link

**Checkpoint**: All user stories implemented and independently testable. Large files accessible, secure, and seamlessly integrated.

---

## Phase 6: Orphan Cleanup & Polish

**Purpose**: Handle edge cases, remove orphaned files, update documentation

- [ ] T064 [P] Implement orphan detection in cdnUploader.ts emitter (compare CDN mapping cache referencedBy arrays with current LargeFile entities)
- [ ] T065 Implement orphan deletion in cdnUploader.ts (call R2Client.deleteFile for orphaned files, remove from cache)
- [ ] T066 [P] Test orphan cleanup: Upload file, delete referencing note, rebuild, verify file removed from R2
- [ ] T067 [P] Test orphan cleanup: Upload file referenced by 2 notes, delete 1 note, rebuild, verify file still exists (still referenced)
- [ ] T068 [P] Add comprehensive build logging to cdnUploader.ts (files uploaded, skipped, orphaned, access levels, errors)
- [ ] T069 [P] Test error handling: Simulate R2 upload failure (invalid credentials), verify build fails with clear error message
- [ ] T070 [P] Test retry logic: Simulate transient network error, verify exponential backoff retries (1s, 2s, 4s)
- [ ] T071 [P] Test concurrent builds: Run two builds for different publish modes simultaneously, verify idempotent uploads (no conflicts)
- [ ] T072 [P] Performance test: Create 60 large files, build, verify parallel uploads maintain <30% build time increase
- [ ] T073 Update docs-custom/ARCHITECTURE.md with CDN handling section (architecture, plugins, data flow, Zero Trust integration)
- [ ] T074 Update docs-custom/FUTURE_TASKS.md, move "Large File Handling" from pending to completed section
- [ ] T075 [P] Create test fixtures in tests/large-files/ (test-public.md, test-trusted.md, large-test-file.pdf >20MB)
- [ ] T076 [P] Document troubleshooting steps in docs-custom/ARCHITECTURE.md (R2 upload failures, Access policy issues, CDN URL issues)
- [ ] T077 Final validation: Build all four publish modes (full, trusted, shachu, public), verify files in correct buckets with correct access controls

**Checkpoint**: Feature complete, documented, and production-ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
  - Some tasks must be sequential (e.g., T005-T009 follow quickstart.md steps in order)
- **Foundational (Phase 2)**: Depends on Setup (Phase 1, tasks T001-T004 completed) - BLOCKS all user stories
  - Many tasks can run in parallel (marked [P])
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
  - Critical path: T020-T021 (plugin skeletons) → T022-T028 (transformer logic) → T029-T034 (emitter logic) → T035-T037 (plugin registration) → T038-T040 (testing)
- **User Story 3 (Phase 4)**: Depends on User Story 1 (Phase 3) completion - builds on upload infrastructure
- **User Story 2 (Phase 5)**: Depends on User Story 1 and 3 (Phases 3-4) completion - requires CDN URLs to exist before rewriting
- **Orphan Cleanup (Phase 6)**: Depends on all user stories (Phases 3-5) - polish tasks can run after core functionality works

### User Story Dependencies

- **User Story 1 (P1)**: Independent MVP - can be completed and validated standalone
  - Delivers: Large files uploaded to CDN and accessible
  - Missing: Links still point to local paths (manual URL construction needed)
- **User Story 3 (P2)**: Depends on US1 - adds security layer
  - Delivers: Zero Trust authentication enforced on CDN files
  - Independent test: Can validate access control without link rewriting
- **User Story 2 (P3)**: Depends on US1 and US3 - adds UX polish
  - Delivers: Automatic link rewriting for seamless experience
  - Completes the feature: Users don't need to know about CDN

### Within Each User Story

- Plugin skeletons before implementation (T020-T021 before T022+)
- Transformer logic before emitter logic (T022-T028 before T029-T034)
- Utility functions before plugin implementation (Phase 2 before Phase 3)
- Core functionality before testing (implementation before T038-T040)
- Each user story complete before moving to next priority

### Parallel Opportunities

- **Setup Phase**: T003, T004 can run in parallel
- **Foundational Phase**: T010, T011, T013, T014, T017 can run in parallel (different files)
- **User Story 1**: T020 and T021 can run in parallel (plugin skeletons in different files)
- **User Story 2**: T051, T052 partially parallel with T053-T057 (different concerns)
- **Orphan Cleanup**: T064, T066, T067, T068, T069, T070, T071, T072, T075, T076 can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch utility modules together:
Task: "Create hash utility module in quartz/util/hash.ts" (T010)
Task: "Create CDN utility module in quartz/util/cdn.ts" (T011)

# After T012 completes, launch CRUD operations together:
Task: "Implement R2Client.deleteFile in quartz/util/cdn.ts" (T013)
Task: "Implement R2Client.listFiles in quartz/util/cdn.ts" (T014)
Task: "Create CDN mapping cache functions in quartz/util/cdn.ts" (T017)
```

---

## Parallel Example: User Story 1

```bash
# Launch plugin skeletons together:
Task: "Create transformer plugin skeleton in quartz/plugins/transformers/largefile.ts" (T020)
Task: "Create emitter plugin skeleton in quartz/plugins/emitters/cdnUploader.ts" (T021)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T009) - R2 infrastructure ready
2. Complete Phase 2: Foundational (T010-T019) - CRITICAL utilities exist
3. Complete Phase 3: User Story 1 (T020-T040) - Core file handling works
4. **STOP and VALIDATE**:
   - Create 25MB test file
   - Build with `npx quartz build --publish-mode public`
   - Verify file uploaded to `vault-files-public` bucket
   - Manually construct CDN URL and verify download works
   - Test with authenticated tier (trusted), verify Zero Trust blocks unauthenticated access
5. **MVP DELIVERED**: Large files no longer cause 404 errors

### Incremental Delivery

1. **MVP (US1)**: Core functionality - files uploaded and accessible
   - Value: Eliminates 404 errors for large files
   - Limitation: Users must manually construct CDN URLs
2. **Add US3**: Security layer - Zero Trust enforced
   - Value: No security holes, tier boundaries maintained
   - Limitation: Still requires manual URL construction
3. **Add US2**: UX polish - automatic link rewriting
   - Value: Seamless experience, users unaware of CDN
   - Complete: Feature fully functional and polished
4. **Polish Phase**: Orphan cleanup, documentation, edge cases
   - Value: Production-ready, maintainable, documented

### Parallel Team Strategy

With multiple developers (after Foundational Phase completion):

1. **Team completes Setup (Phase 1) + Foundational (Phase 2) together**
2. **Once Phase 2 is done, split work**:
   - **Developer A**: User Story 1 (T020-T040) - Core file handling
   - **Developer B**: User Story 3 prep (review Zero Trust setup, verify quickstart.md steps)
   - **Developer C**: User Story 2 prep (study link rewriting logic, prepare test cases)
3. **Sequential completion**:
   - A completes US1 → B validates and completes US3 → C validates and completes US2
4. **Parallel polish**:
   - All developers work on Phase 6 tasks in parallel

---

## Testing Checklist (Manual Validation)

### Per User Story

**User Story 1** (T038-T040):
- [ ] 25MB file uploads to correct bucket based on note's publish mode
- [ ] Duplicate filenames in different folders don't collide
- [ ] Files ≤20MB remain unchanged in build output
- [ ] CDN URL manually constructed: `https://cdn-public.dario.ca/[path]` downloads file

**User Story 3** (T041-T050):
- [ ] Public file accessible without authentication
- [ ] Trusted file blocks unauthenticated users (Cloudflare Access page)
- [ ] Trusted file accessible to authenticated trusted users
- [ ] Shachu file accessible to shachu members only
- [ ] Full file accessible to vault owner only
- [ ] Multi-tier file (public + trusted notes) uploads to public bucket
- [ ] Session expiration blocks previously accessible files

**User Story 2** (T059-T063):
- [ ] Links to files >20MB rewritten to CDN URLs
- [ ] Links to files ≤20MB unchanged
- [ ] File exactly 20MB not uploaded (treated as regular file)
- [ ] Relative paths (../docs/file.pdf) resolved and rewritten
- [ ] Absolute paths (/docs/file.pdf) resolved and rewritten
- [ ] Duplicate references point to same CDN URL
- [ ] File growth (15MB → 25MB) detected on next build

**Orphan Cleanup** (T066-T067):
- [ ] Deleted file (no references) removed from CDN
- [ ] File with remaining references not deleted

**Performance** (T072):
- [ ] 60 large files build with <30% time increase
- [ ] Parallel uploads for >50 files

**Error Handling** (T069-T070):
- [ ] Build fails with clear error on upload failure
- [ ] Exponential backoff retries (1s, 2s, 4s) on transient errors
- [ ] Error message indicates failed file and attempt count

### Cross-Tier Validation

Test **all four publish modes**:

```bash
# Full tier
npx quartz build --publish-mode full --baseUrl vault.dario.ca

# Trusted tier
npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca

# Shachu tier
npx quartz build --publish-mode shachu --baseUrl notes-shachu.dario.ca

# Public tier
npx quartz build --publish-mode public --baseUrl notes.dario.ca
```

Verify for each:
- [ ] Files from that tier and above uploaded to correct bucket
- [ ] Files from lower tiers not uploaded
- [ ] Access controls enforced per tier
- [ ] Build logs show correct access levels

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** maps task to specific user story for traceability
- **Each user story** independently completable and testable
- **Commit frequently** after each task or logical group
- **Stop at checkpoints** to validate story independently before proceeding
- **Manual testing focus**: No unit tests requested, validation via build and browser testing
- **Quickstart.md is critical**: Infrastructure setup (Phase 1, T005-T009) depends on following those steps exactly
- **Build-time only**: All entities exist during build, CDN mapping cache is only persisted artifact
- **Avoid**: vague tasks, same-file conflicts, cross-story dependencies that break independence

---

## Task Count Summary

- **Setup (Phase 1)**: 9 tasks (T001-T009)
- **Foundational (Phase 2)**: 10 tasks (T010-T019)
- **User Story 1 (Phase 3)**: 21 tasks (T020-T040) - MVP
- **User Story 3 (Phase 4)**: 10 tasks (T041-T050) - Security
- **User Story 2 (Phase 5)**: 13 tasks (T051-T063) - UX Polish
- **Orphan Cleanup & Polish (Phase 6)**: 14 tasks (T064-T077)

**Total**: 77 tasks

**Parallel Opportunities**: 26 tasks marked [P] across all phases

**MVP Scope** (Phases 1-3): 40 tasks → Delivers core functionality (files accessible via CDN, no 404s)

**Full Feature** (Phases 1-5): 63 tasks → Complete with security and UX polish

**Production-Ready** (All Phases): 77 tasks → Includes orphan cleanup, documentation, comprehensive testing
