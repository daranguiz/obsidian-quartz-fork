# Implementation Plan: Large File Handling via CDN

**Branch**: `002-large-file-handling` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-large-file-handling/spec.md`

## Summary

Implement CDN-based handling for files over 20MB to bypass Cloudflare Pages' 25MB file size limit. The system will automatically detect large files during build, upload them to Cloudflare R2 (CDN storage), rewrite markdown links to point to CDN URLs, and enforce Cloudflare Zero Trust access controls on all CDN requests. This eliminates 404 errors for large files while maintaining the existing four-tier security model (Full, Trusted, Shachu, Public).

**Key Requirements**:
- Detect and upload files >20MB to CDN during build
- Rewrite links automatically to absolute CDN URLs
- Route ALL CDN requests through Cloudflare Zero Trust for tier-appropriate authentication
- Remove orphaned files from CDN immediately
- Support concurrent builds with idempotent uploads (file hash verification)
- Maintain <30% build time increase with parallel uploads for >50 files

## Technical Context

**Language/Version**: TypeScript (Node.js) - Quartz build system is TypeScript-based
**Primary Dependencies**: Quartz framework, Cloudflare R2 SDK (@cloudflare/workers-types), Node.js fs/crypto for file operations
**Storage**: Cloudflare R2 (S3-compatible object storage) for large files
**Testing**: Local build testing with `npx quartz build --publish-mode [MODE]`, manual verification across tiers
**Target Platform**: Node.js build environment (Cloudflare Pages build workers)
**Project Type**: Build-time plugin system integrated into existing Quartz static site generator
**Performance Goals**: Build time increase ≤30% with linear scaling to 50 files, parallel uploads beyond 50
**Constraints**:
  - Must integrate with existing Quartz plugin architecture (filters, transformers, emitters)
  - Must support Cloudflare Zero Trust access control on CDN URLs
  - Must work within Cloudflare Pages build environment (10-minute timeout, limited memory)
  - Exponential backoff retry (3 attempts: 1s, 2s, 4s delays) on upload failures
**Scale/Scope**:
  - Expected: 5-20 large files per build in typical usage
  - Design target: 50+ files with parallel processing
  - Four concurrent builds (one per publish mode) supported

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Single Source of Truth ✅
**Status**: PASS
**Check**: Large files remain in vault (obsidian-vault-backup), CDN is distribution mechanism only
**Compliance**: Files uploaded to CDN are copies; vault remains authoritative source

### Principle II: Clean Separation of Concerns ✅
**Status**: PASS
**Check**: Build logic in obsidian-quartz-fork, content in vault, CDN is external storage
**Compliance**: No CDN artifacts pollute vault; CDN mapping tracked in build process only

### Principle III: Hierarchical Access Control ✅
**Status**: PASS - CRITICAL VALIDATION REQUIRED
**Check**: CDN files must enforce same tier hierarchy as notes (Full > Trusted > Shachu > Public)
**Compliance**: FR-020 to FR-031 specify Zero Trust integration; must verify Cloudflare R2 can route through Zero Trust
**Risk**: If R2 cannot route through Zero Trust, alternative architecture required (see research phase)

### Principle IV: Frontmatter-Driven Publishing ✅
**Status**: PASS
**Check**: CDN access level derived from note's `publish` frontmatter field
**Compliance**: FR-007, FR-026 specify access level determined by linking note's publish mode

### Principle V: Documentation as Living System ✅
**Status**: PASS
**Check**: Must update ARCHITECTURE.md after implementation
**Compliance**: Standard practice; add section on CDN handling and Zero Trust integration

### Principle VI: Defense in Depth ✅
**Status**: PASS - REQUIRES VERIFICATION
**Check**: CDN access must be enforced at multiple layers
**Compliance**:
  - Build-time: Only upload files from published notes (FR-007)
  - CDN-level: Cloudflare Zero Trust on all requests (FR-020, FR-021)
  - URL stability: Consistent URLs prevent enumeration but Zero Trust is primary defense (FR-031)
**Risk**: Must verify Zero Trust can protect R2 URLs; if not, consider signed URLs or custom domain with Zero Trust proxy

### Principle VII: Automated Deployment ✅
**Status**: PASS
**Check**: CDN upload integrated into existing build process; no manual intervention
**Compliance**: Plugin-based approach runs automatically during `npx quartz build`

### Security Requirement: Content Isolation ✅
**Status**: PASS - CRITICAL
**Check**: Private files must not be accessible on lower-trust tiers via direct CDN URL
**Compliance**: FR-027 explicitly prevents unauthorized access even with direct URLs; SC-012, SC-013 validate this

### Security Requirement: Authentication Standards ✅
**Status**: PASS
**Check**: Restricted tiers use Cloudflare Zero Trust; public tier remains open
**Compliance**: FR-022 to FR-025 map each tier to Zero Trust requirements

### Security Requirement: Information Disclosure Prevention ✅
**Status**: PASS
**Check**: Orphaned links to filtered large files must not reveal existence
**Compliance**: Large files filtered same as notes (FR-007); if note filtered, file not uploaded

### Development Standard: Plugin Architecture ✅
**Status**: PASS
**Check**: Must follow Quartz plugin patterns
**Compliance**: Implementation will use:
  - **Transformer plugin**: Detect large file references, rewrite links, track references
  - **Emitter plugin**: Upload to CDN after content processing, remove orphans
  - **Plugin order**: After PublishMode filter (so only published notes' files are uploaded)

### Development Standard: Testing Requirements ✅
**Status**: PASS
**Check**: Test across all four publish modes
**Compliance**: Test plan must verify:
  - Public files accessible without auth
  - Trusted files require auth for trusted users
  - Unauthenticated users blocked from trusted files
  - Shachu/Full tier files properly restricted

### Development Standard: Configuration Management ✅
**Status**: PASS
**Check**: R2 credentials from environment variables, not hardcoded
**Compliance**: FR-012 specifies environment variables; Cloudflare Pages supports R2 bindings

### Development Standard: File Size Handling ✅
**Status**: PASS - THIS IS THE SOLUTION
**Check**: Must handle files exceeding 25MB limit
**Compliance**: This feature implements the long-term CDN migration solution

**GATE RESULT**: ✅ PASS - Proceed to Phase 0 Research

**CRITICAL VALIDATION REQUIRED**:
1. Verify Cloudflare R2 can route requests through Cloudflare Zero Trust
2. If not, research alternative: custom domain + Zero Trust Access policy + R2 backend
3. Validate file hash approach prevents concurrent build conflicts

## Project Structure

### Documentation (this feature)

```text
specs/002-large-file-handling/
├── spec.md              # Feature specification (completed)
├── checklists/
│   └── requirements.md  # Spec validation checklist (completed)
├── plan.md              # This file (in progress)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (to be created)
│   └── cdn-mapping.json # CDN mapping file schema
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
quartz/
├── plugins/
│   ├── transformers/
│   │   └── largefile.ts         # NEW: Detect large files, rewrite links, track references
│   ├── emitters/
│   │   └── cdnUploader.ts       # NEW: Upload to R2, manage mappings, remove orphans
│   └── index.ts                 # UPDATE: Export new plugins
├── util/
│   ├── cdn.ts                   # NEW: R2 client wrapper, retry logic, access level mapping
│   └── hash.ts                  # NEW: File hashing for deduplication
└── cfg.ts                       # UPDATE: Add R2 config type definitions

.github/
└── workflows/
    └── deploy-to-pages.yaml     # UPDATE: Add R2 environment variables to build

docs-custom/
├── ARCHITECTURE.md              # UPDATE: Add CDN handling section
└── FUTURE_TASKS.md              # UPDATE: Move Large File Handling to completed

.env.example                      # NEW: Document R2 environment variables

tests/
└── large-files/                 # NEW: Test fixtures and validation scripts
    ├── test-public.md           # Test note with public large file
    ├── test-trusted.md          # Test note with trusted large file
    └── large-test-file.pdf      # 25MB+ test file
```

**Structure Decision**: Quartz plugin architecture
- **Transformer plugin** (largefile.ts): Runs during markdown processing to detect file references, check sizes, rewrite links, and build reference graph
- **Emitter plugin** (cdnUploader.ts): Runs after all content processed to upload files to R2 and clean up orphans
- **Utility modules**: Isolated CDN client logic for testability and reuse
- **Plugin order**: Must run after PublishMode filter to respect tier filtering

## Complexity Tracking

**No constitutional violations requiring justification.**

The implementation follows established Quartz patterns and integrates naturally into the existing plugin architecture. The added complexity (CDN integration, Zero Trust routing) is justified by the core requirement to support files >25MB, which is documented in FUTURE_TASKS.md as a planned enhancement.
