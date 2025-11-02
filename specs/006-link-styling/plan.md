# Implementation Plan: Link Styling Refinements

**Branch**: `006-link-styling` | **Date**: 2025-11-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-link-styling/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refine link styling to reduce visual noise while maintaining clear distinction between link types. Primary changes: (1) Update dead link color to darker burnt orange and remove background highlighting, (2) Create three visual options for internal link backgrounds to allow user selection. This is a pure styling change affecting SCSS files with no logic modifications required.

## Technical Context

**Language/Version**: SCSS (Sass), compiled via Quartz build system (TypeScript/Node.js)
**Primary Dependencies**: Quartz v4 framework, Sass compiler (inherited from Quartz)
**Storage**: N/A (styling only, no data persistence)
**Testing**: Visual testing via local build (`npx quartz build --serve`), browser preview across Chrome/Firefox/Safari
**Target Platform**: Web browsers (Chrome, Firefox, Safari), responsive design (desktop/tablet/mobile)
**Project Type**: Static site generator styling (Quartz-based)
**Performance Goals**: No performance impact (CSS-only changes), instant visual rendering
**Constraints**: Must maintain WCAG AA color contrast standards, must not break existing link functionality
**Scale/Scope**: 2 SCSS files to modify ([quartz/styles/custom.scss](../../quartz/styles/custom.scss), [quartz/styles/base.scss](../../quartz/styles/base.scss)), ~20-30 lines of CSS affected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Relevant Constitutional Principles

**✓ Principle V: Documentation as Living System**
- Status: COMPLIANT
- Action: ARCHITECTURE.md will be updated after implementation to document the CSS changes and styling patterns

**✓ Principle III: Hierarchical Access Control**
- Status: COMPLIANT
- Requirement: Dead link styling already respects tier system (visible only on full tier)
- Impact: Changes maintain existing tier-based visibility behavior

**✓ Security: Information Disclosure Prevention**
- Status: COMPLIANT
- Requirement: Dead links must not reveal filtered content on lower tiers
- Impact: Existing behavior preserved - dead links appear as plain text on non-full tiers

**✓ Development Standards: Testing Requirements**
- Status: COMPLIANT
- Action: Visual testing across all four publish modes to ensure styling works correctly on each tier

**✓ Maintenance Practices: Task Tracking**
- Status: COMPLIANT
- Action: Using TodoWrite tool to track planning progress

### Gate Evaluation

**PASS** - All constitutional requirements satisfied:
- No changes to access control logic
- No security implications (styling only)
- Documentation commitment in place
- Testing plan defined
- No new complexity introduced

## Project Structure

### Documentation (this feature)

```text
specs/006-link-styling/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

**Note**: data-model.md and contracts/ are not applicable for this feature (styling only, no data or API contracts).

### Source Code (repository root)

```text
quartz/
└── styles/
    ├── custom.scss          # Dead link styling (.dead-link class) - PRIMARY FILE
    ├── base.scss            # Internal link styling (.internal) and broken links (.internal.broken)
    └── variables.scss       # CSS custom properties (--highlight, --lightgray) - REFERENCE ONLY
```

**Structure Decision**: This is a styling-only feature targeting existing SCSS files in the Quartz framework. No new files or directories needed. Changes are confined to CSS selectors and properties within two existing stylesheets.

**Affected Components**:
- Dead link styling in [custom.scss:6-27](../../quartz/styles/custom.scss#L6-L27)
- Internal link styling in [base.scss:86-128](../../quartz/styles/base.scss#L86-L128)
- Broken link styling in [base.scss:94-116](../../quartz/styles/base.scss#L94-L116)

## Complexity Tracking

**N/A** - No constitutional violations. This is a straightforward CSS modification with no architectural implications.

---

## Phase 0: Research Outcomes

**Status**: ✅ Complete

### Research Questions Resolved

1. **Dual CSS classes investigation** → Style both `.dead-link` and `.internal.broken` consistently
2. **Burnt orange color selection** → #cc5500 (WCAG AA compliant, 5.1:1 contrast)
3. **Internal link background options** → Three variants: none, current, bottom-border
4. **SCSS build system verification** → All needed features confirmed working
5. **Testing strategy** → Local builds with visual comparison workflow
6. **Edge case handling** → Background removal solves most edge cases

**Key Decisions**:
- Color: #cc5500 (darker burnt orange, accessible)
- Testing: Local `npx quartz build --publish-mode [MODE] --serve`
- Options: Create commented CSS variants for user evaluation

**Documentation**: See [research.md](research.md) for detailed rationale and alternatives considered.

---

## Phase 1: Design Artifacts

**Status**: ✅ Complete

### Artifacts Generated

✅ **quickstart.md**: Testing workflow and option evaluation guide
❌ **data-model.md**: Not applicable (styling only, no data entities)
❌ **contracts/**: Not applicable (no API contracts for CSS changes)
✅ **CLAUDE.md**: Agent context updated with SCSS/Quartz framework info

### Design Summary

**CSS Modifications Required**:

1. **Dead Link Color** ([custom.scss](../../quartz/styles/custom.scss)):
   ```scss
   // Before: color: #d97706;
   // After:  color: #cc5500;
   ```

2. **Dead Link Background** ([custom.scss](../../quartz/styles/custom.scss)):
   ```scss
   // Before: background-color: var(--lightgray);
   // After:  background-color: transparent;
   ```

3. **Broken Link Color** ([base.scss](../../quartz/styles/base.scss)):
   ```scss
   // Before: color: var(--secondary); opacity: 0.5;
   // After:  color: #cc5500; opacity: 1.0;
   ```

4. **Internal Link Background Options** ([base.scss](../../quartz/styles/base.scss)):
   - Create three commented CSS blocks
   - User selects final option during implementation
   - Remove unused variants post-selection

### Implementation Constraints

- ✓ Must not modify TypeScript/JavaScript logic
- ✓ Must preserve tier-based visibility (`body[data-publish-mode="full"]`)
- ✓ Must maintain accessibility (WCAG AA contrast)
- ✓ Must not affect external links, tag links, or image links

---

## Post-Design Constitution Check

**Status**: ✅ PASS

Re-evaluation after Phase 1 design:

**✓ Principle V: Documentation as Living System**
- Action confirmed: ARCHITECTURE.md update planned post-implementation
- CLAUDE.md already updated with framework context

**✓ Principle III: Hierarchical Access Control**
- Design verified: No changes to tier-based logic
- Selectors preserved: `body[data-publish-mode="full"]` remains intact

**✓ Security: Information Disclosure Prevention**
- Design verified: Dead link behavior on non-full tiers unchanged
- No new information leakage vectors introduced

**✓ Development Standards: Testing Requirements**
- Testing workflow defined in quickstart.md
- Multi-tier testing (full vs public) planned

**No new constitutional concerns identified** - design remains compliant.

---

## Implementation Readiness

**Status**: ✅ Ready for `/speckit.tasks`

### Checklist

- [x] Technical unknowns resolved (research.md)
- [x] Design decisions documented (plan.md)
- [x] Testing workflow defined (quickstart.md)
- [x] Agent context updated (CLAUDE.md)
- [x] Constitution compliance verified
- [x] File paths identified (custom.scss, base.scss)
- [x] Color values selected (#cc5500)
- [x] Accessibility validated (WCAG AA)

### Next Phase

Run `/speckit.tasks` to generate actionable task breakdown (tasks.md).

**Estimated effort**: 1-2 hours (CSS changes + testing + option selection)
**Complexity**: Low (styling only, no logic changes)
**Risk**: Minimal (easily reversible, no breaking changes)
