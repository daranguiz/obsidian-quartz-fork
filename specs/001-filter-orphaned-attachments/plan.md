# Implementation Plan: Filter Orphaned Attachments

**Branch**: `001-filter-orphaned-attachments` | **Date**: 2025-10-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-filter-orphaned-attachments/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement an attachment filtering system to prevent private attachments (images, PDFs, media files) from being accessible on lower-trust publishing tiers when their source pages are filtered out. The system will scan all published pages to identify attachment references, maintain a whitelist of referenced attachments, and ensure only referenced attachments are copied to the output during the asset emission phase. This addresses a critical security issue where private media files can currently be accessed via direct URL even when their containing pages are filtered.

## Technical Context

**Language/Version**: TypeScript 5.9.2 with ESNext target, Node.js >=22
**Primary Dependencies**:
- Quartz 4.5.2 (SSG framework)
- unified/remark/rehype ecosystem (markdown/HTML processing)
- vfile 6.0.3 (virtual file system)
- gray-matter 4.0.3 (frontmatter parsing)
- globby 15.0.0 (file globbing)

**Storage**: File-based content management; in-memory attachment whitelist during build
**Testing**: tsx test runner (Node.js test runner), manual integration testing across publish modes
**Target Platform**: Node.js build system running on Cloudflare Pages (Linux)
**Project Type**: Single project (static site generator with plugin architecture)
**Performance Goals**:
- Build time impact <2x current builds for typical vaults (hundreds to thousands of pages)
- Memory efficient for large vaults (10k+ pages, 5k+ attachments)
- Attachment reference scanning must be O(n) relative to published pages

**Constraints**:
- Must integrate with existing Quartz plugin architecture (filter/emitter phases)
- Must execute after filter plugins but before/during asset emission
- Must handle hierarchical publishing tiers (Public → Shachu → Trusted → Full)
- Must support symlinks, URL-encoded filenames, relative paths
- Must gracefully handle missing attachment files (warn but continue)
- Must support partial/incremental rebuilds for `--serve` mode

**Scale/Scope**:
- Support vaults with 10k+ markdown pages
- Support 5k+ attachment files across various formats
- Handle complex directory structures with nested attachment folders
- Process multiple link formats (wikilinks, markdown links, image embeds)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle III: Hierarchical Access Control
**Status**: ✅ PASS
**Analysis**: The feature explicitly enforces hierarchical attachment filtering based on the same tier system (Full > Trusted > Shachu > Public). Attachments referenced by Public pages appear in all tiers (FR-011), and the whitelist is built from published pages that already passed filter plugins.

### Principle VI: Defense in Depth
**Status**: ✅ PASS
**Analysis**: This feature adds a new security layer at the asset emission phase. Currently only markdown content is filtered (filter plugins); this extends filtering to attachments, preventing private media exposure even if a user guesses/knows the direct URL. Multiple enforcement points maintained.

### Security Requirements: Content Isolation
**Status**: ✅ PASS (addresses current violation)
**Analysis**: This feature specifically addresses the documented security issue that "Attachments and media files (MUST be filtered based on references)" in the constitution. Currently private attachments ARE accessible on lower tiers via direct URL - this is the critical security gap being fixed.

### Security Requirements: Information Disclosure Prevention
**Status**: ✅ PASS
**Analysis**: By removing unreferenced attachments from output, the system prevents inferring existence of filtered content through direct file access. Build logs will indicate filtering decisions (FR-014) but won't expose private content paths (logs are in private repo per constitution).

### Development Standards: Plugin Architecture
**Status**: ✅ PASS
**Analysis**: Feature follows Quartz plugin patterns. Will implement as either:
1. Filter plugin (returns shouldPublish for each attachment file), OR
2. Emitter plugin modification (Assets emitter checks whitelist before copying)
Plugin execution order documented; runs after content filters, during/before asset emission.

### Development Standards: Testing Requirements
**Status**: ✅ PASS
**Analysis**: Feature spec includes comprehensive test scenarios across all four publish modes (spec.md User Stories 1-3). Acceptance scenarios verify content appears on expected tiers and is filtered from expected tiers. Local testing command documented: `npx quartz build --publish-mode [MODE] --serve`

### Maintenance Practices: Documentation Standards
**Status**: ✅ PASS (commitment)
**Analysis**: Feature will update ARCHITECTURE.md per Principle V. Changes affect plugin architecture and security model. CLAUDE.md already references this as the pattern to follow. Will document attachment filtering logic, plugin integration point, and performance characteristics.

### Governance: Complexity Justification
**Status**: ✅ PASS
**Analysis**: Complexity is justified by documented HIGH-priority security requirement in FUTURE_TASKS.md. Not speculative - this is a known security gap that defeats the purpose of tiered publishing. Feature is scoped to solve the specific problem without over-engineering.

### Summary (Pre-Design)
**Overall Status**: ✅ ALL GATES PASSED

No constitutional violations. Feature aligns with:
- Core security model (Principle III, VI)
- Fills documented security gap (constitution line 93-96)
- Follows plugin architecture standards
- Maintains defense-in-depth approach
- Will be properly documented

**Proceed to Phase 0 Research.**

---

## Constitution Check (Post-Design Re-evaluation)

*Re-evaluated after Phase 0 Research and Phase 1 Design completed.*

### Principle III: Hierarchical Access Control ✅ PASS
**Re-evaluation**: Design confirmed hierarchical filtering approach. The AttachmentWhitelist plugin builds the whitelist from published pages AFTER PublishMode filter, ensuring attachments follow the same tier hierarchy. Research confirms the plugin execution order (RemoveDrafts → IndexSwapper → PublishMode → AttachmentWhitelist) enforces this correctly.

### Principle VI: Defense in Depth ✅ PASS
**Re-evaluation**: Design adds attachment filtering at the asset emission layer, complementing existing content filtering at the plugin layer. The hybrid approach (filter plugin builds whitelist + emitter checks whitelist) provides separation of concerns and maintains defense-in-depth.

### Security Requirements: Content Isolation ✅ PASS
**Re-evaluation**: Design ensures private attachments are filtered from output directories. The shouldCopyAttachment utility (contracts/plugin-api.md) enforces whitelist checks before any file copying. Missing files are handled gracefully (warning + skip), absolute paths are rejected, and external URLs are ignored.

### Security Requirements: Information Disclosure Prevention ✅ PASS
**Re-evaluation**: Design includes comprehensive validation to prevent information leakage:
- Absolute paths logged but skipped (no copying)
- Missing attachments logged with generic warnings (no sensitive path exposure)
- Orphaned attachments simply not copied (no broken link styling to reveal existence)
- Build logs sanitized for public repos

### Development Standards: Plugin Architecture ✅ PASS
**Re-evaluation**: Implementation follows Quartz plugin patterns exactly:
- Filter plugin signature matches existing filters (RemoveDrafts, PublishMode)
- Uses BuildCtx for state communication (existing pattern)
- Emitter modification is minimal and backward-compatible
- Plugin is opt-in via configuration (quartz.config.ts)

### Development Standards: Testing Requirements ✅ PASS
**Re-evaluation**: Testing strategy defined in quickstart.md covers:
- Manual testing across all 4 publish modes
- Unit tests for extractAttachments and shouldCopyAttachment utilities
- Integration tests for all acceptance scenarios (spec.md)
- Security verification (direct URL access to private attachments)
- Performance verification (<2x build time)

### Maintenance Practices: Documentation Standards ✅ PASS
**Re-evaluation**: Documentation deliverables complete:
- research.md: Technical decisions and rationale (30+ pages)
- data-model.md: Data structures and flow (20+ pages)
- contracts/plugin-api.md: API specifications (40+ pages)
- quickstart.md: Implementation guide (30+ pages)
- ARCHITECTURE.md update template provided
All documents include "what" and "why" explanations.

### Governance: Complexity Justification ✅ PASS
**Re-evaluation**: Design complexity is appropriate:
- Hybrid approach (filter + emitter) is simplest solution given constraints
- No speculative features added beyond requirements
- Performance overhead minimal (~1-2 seconds, well within SC-004)
- Memory overhead negligible (<10 MB even for large vaults)
- Alternative approaches evaluated and rejected with rationale (research.md)

### Final Assessment
**Overall Status**: ✅ ALL GATES PASSED (POST-DESIGN)

Design phase has strengthened constitutional alignment:
- Implementation approach is well-researched and justified
- All technical unknowns resolved (research.md Decision sections)
- API contracts are complete and type-safe (TypeScript)
- Testing strategy is comprehensive and actionable
- Documentation is thorough and follows project standards
- Backward compatibility maintained (opt-in behavior)

**No constitutional concerns. Ready to proceed to Phase 2 (/speckit.tasks).**

## Project Structure

### Documentation (this feature)

```text
specs/001-filter-orphaned-attachments/
├── spec.md              # Feature specification (already exists)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - attachment parsing research
├── data-model.md        # Phase 1 output - attachment whitelist structure
├── quickstart.md        # Phase 1 output - testing & integration guide
├── contracts/           # Phase 1 output - API contracts for plugin
│   └── plugin-api.md    # AttachmentFilter plugin interface
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```text
quartz/
├── plugins/
│   ├── filters/
│   │   ├── draft.ts                    # Existing - filters drafts
│   │   ├── indexSwapper.ts             # Existing - swaps index files
│   │   ├── publishMode.ts              # Existing - filters by tier
│   │   └── [NEW] attachmentFilter.ts   # NEW - filters orphaned attachments
│   ├── emitters/
│   │   ├── assets.ts                   # MODIFY - integrate whitelist check
│   │   └── helpers.ts                  # Existing - helper functions
│   └── transformers/
│       └── links.ts                    # Existing - may provide attachment extraction logic
├── util/
│   ├── path.ts                         # Existing - path utilities
│   └── [NEW] attachments.ts            # NEW - attachment reference extraction utilities
└── cfg.ts                              # Existing - configuration types

quartz.config.ts                        # MODIFY - add AttachmentFilter to filter chain

tests/
└── [NEW] attachment-filtering/         # NEW - integration tests
    ├── fixtures/                       # Test markdown files with attachments
    ├── attachment-filter.test.ts       # Unit tests for filter logic
    └── integration.test.ts             # End-to-end tests across tiers
```

**Structure Decision**: Single project (Quartz SSG plugin architecture)

This feature integrates with Quartz's existing plugin system. The implementation requires:
1. **New Filter Plugin** (`attachmentFilter.ts`) - Runs after PublishMode to build attachment whitelist
2. **Modified Assets Emitter** (`assets.ts`) - Checks whitelist before copying files
3. **New Utility Module** (`attachments.ts`) - Extracts attachment references from markdown/HTML AST
4. **Integration Tests** - Verify filtering across all four publish modes

The filter plugin approach follows Quartz conventions (see `publishMode.ts`, `draft.ts`) and integrates cleanly with the existing filter chain. Plugin order critical: RemoveDrafts → IndexSwapper → PublishMode → **AttachmentFilter** → Emitters.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations - this section is not applicable for this feature.
