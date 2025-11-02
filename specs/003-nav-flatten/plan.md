# Implementation Plan: Smart Navigation Defaults

**Branch**: `003-nav-flatten` | **Date**: 2025-10-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-nav-flatten/spec.md`

## Summary

Implement smart default folder expansion for Explorer component on lower trust tiers (Public, Shachu, Trusted) to reduce clicks needed to access frequently used Shihen files from 3 to 1. "Tea Resources" and "紙片 (Shihen)" folders will auto-expand on page load for lower tiers only, while Full tier preserves the default collapsed state.

**Technical Approach**: Leverage Explorer component's client-side folder state initialization. Pass tier-specific auto-expand configuration via data attribute, then set initial folder states based on configuration before user interaction. No tree structure modification - purely default state management using Explorer's existing mechanisms.

## Technical Context

**Language/Version**: TypeScript (Node.js runtime), client-side JavaScript in inline script
**Primary Dependencies**: Quartz v4 framework, Explorer component with existing folder state management
**Storage**: localStorage (Explorer's existing saved state mechanism - already implemented)
**Testing**: Manual testing across all four publish modes with visual verification
**Target Platform**: Static site generator (Quartz) running in Cloudflare Pages, client-side execution in browser
**Project Type**: Single project (Quartz component configuration modification)
**Performance Goals**: No measurable impact (configuration sets initial state only, happens once on page load)
**Constraints**: Must work with Explorer's existing saved state; must not interfere with manual folder collapse/expand; must respect user preferences
**Scale/Scope**: 2 folders auto-expand (Tea Resources, Shihen) on 3 tiers (Public, Shachu, Trusted); Full tier unchanged

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle II: Clean Separation of Concerns ✅
**Check**: Build system modifications must not affect vault structure
**Compliance**: PASS - Auto-expansion is purely default UI state, no changes to vault folder structure or file paths

### Principle III: Hierarchical Access Control ✅
**Check**: Feature must not interfere with tier-based content filtering
**Compliance**: PASS - Folder expansion is independent of content filtering; operates on presentation layer only

### Principle IV: Frontmatter-Driven Publishing ✅
**Check**: Must not rely on file location for visibility decisions
**Compliance**: PASS - Auto-expansion is presentation-only; content visibility still controlled by frontmatter `publish` field

### Principle V: Documentation as Living System ✅
**Check**: ARCHITECTURE.md must be updated after implementation
**Compliance**: Will update ARCHITECTURE.md with navigation auto-expansion section

### Principle VI: Defense in Depth ✅
**Check**: Feature must not create security vulnerabilities
**Compliance**: PASS - Folder expansion has no security implications

**Gate Status**: ✅ PASSED - All constitutional principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/003-nav-flatten/
├── plan.md              # This file
├── research.md          # Phase 0: Explorer folder state mechanisms
├── data-model.md        # Phase 1: Folder state configuration model
├── quickstart.md        # Phase 1: Configuration and testing guide
└── contracts/           # (N/A - no external APIs)
```

### Source Code (repository root)

```text
quartz/
├── components/
│   ├── Explorer.tsx              # Modify - add autoExpandFolders option, pass via data attribute
│   └── scripts/
│       └── explorer.inline.ts    # Modify - read config, initialize folder states
└── quartz.layout.ts              # Modify - configure auto-expand folders per tier
```

**Structure Decision**: Minimal changes to existing Explorer component. Configuration lives in `quartz.layout.ts`, passed to component via new option, transmitted to inline script via data attribute, initialized before user interaction.

## Complexity Tracking

> **No violations - this section intentionally empty**

Feature leverages existing Explorer folder state management with minimal additions. No new complexity beyond documented requirements.

---

## Phase 0: Research & Analysis

**Objective**: Understand Explorer's folder state mechanisms to implement auto-expansion correctly

### Research Tasks

1. **Explorer Folder State API**
   - Review how `folderDefaultState` option works ("collapsed" vs "open")
   - Understand `useSavedState` localStorage persistence mechanism
   - Identify where folder collapse/expand is handled in inline script
   - Determine if we can set per-folder states (not just global default)

2. **Inline Script Initialization Flow**
   - Find where folder DOM nodes are created
   - Identify when folders get their initial collapsed/expanded state
   - Understand saved state loading from localStorage
   - Determine correct timing for applying auto-expand config

3. **Data Passing Patterns**
   - Review existing data attributes on Explorer div
   - Understand how inline script reads configuration
   - Identify pattern for passing array/list data

4. **Folder Identification**
   - Determine how folders are identified in DOM (slugs, data attributes, classes)
   - Understand folder path format for targeting specific folders
   - Check if nested folders need parent expanded first

### Expected Outcomes

- Decision on how to pass auto-expand configuration to inline script
- Understanding of when/how to apply initial folder states
- Implementation approach that respects saved state

---

## Phase 1: Design Artifacts

**Prerequisites**: Phase 0 research complete

### 1. Data Model (`data-model.md`)

Document folder state configuration structure and runtime behavior.

### 2. API Contracts (`contracts/`)

N/A - No external APIs for this feature.

### 3. Quickstart Guide (`quickstart.md`)

Configuration examples, testing commands, verification steps.

### 4. Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to add Explorer folder state management context.

---

## Next Steps

After `/speckit.plan` completes:
1. Review research.md findings
2. Run `/speckit.tasks` to generate implementation tasks
3. Implement based on tasks.md
4. Test across all four tiers
5. Update ARCHITECTURE.md
