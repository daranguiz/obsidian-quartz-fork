# Feature Specification: Link Styling Refinements

**Feature Branch**: `006-link-styling`
**Created**: 2025-11-02
**Status**: Draft
**Input**: User description: "let's work on this future task

### Dead link styling

The current styling is a little loud. What if I keep the orange, but remove the background grey highlight? Maybe change the orange to be a little darker, more of a burnt orange?

 And actually, I think I would like to explore removing the background grey highlight on all links as part of this spec. Give me options when you do tests so i can pick"

## User Scenarios & Testing

### User Story 1 - Dead Link Visual Refinement (Priority: P1)

As a reader viewing the full-tier site, I want dead links to be visually distinguishable but not overly prominent, so that they provide helpful information without disrupting my reading experience.

**Why this priority**: Dead links are the most noticeable current issue mentioned in the request. Improving their styling directly addresses the "too loud" feedback and is independently valuable regardless of other link styling changes.

**Independent Test**: Can be fully tested by viewing pages with dead links on the full tier and verifying the new color scheme (darker burnt orange without background) is applied and provides clear distinction without being distracting.

**Acceptance Scenarios**:

1. **Given** a page with dead links on the full tier, **When** viewing the page, **Then** dead links display in a darker burnt orange color without grey background highlighting
2. **Given** a page with dead links on non-full tiers, **When** viewing the page, **Then** dead links appear as plain text without special styling (existing behavior maintained)
3. **Given** dead links with the new styling, **When** comparing to working internal links, **Then** dead links remain clearly distinguishable

---

### User Story 2 - Internal Link Background Options (Priority: P2)

As a site owner, I want to evaluate different background styling options for all internal links, so that I can choose the visual treatment that best balances readability and aesthetics for my knowledge base.

**Why this priority**: This is an exploratory requirement that depends on seeing visual options. It's lower priority than the dead link fix because it requires user decision-making rather than direct implementation.

**Independent Test**: Can be tested by building the site with multiple background styling variants (with background, without background, partial background) and reviewing them in a browser to make an informed styling choice.

**Acceptance Scenarios**:

1. **Given** internal links in content, **When** viewing Option A (no background), **Then** links display with colored text only
2. **Given** internal links in content, **When** viewing Option B (current background), **Then** links display with grey background highlight (current behavior)
3. **Given** internal links in content, **When** viewing Option C (alternative background treatment), **Then** links display with a subtle or modified background treatment
4. **Given** all three options, **When** comparing side-by-side, **Then** the user can clearly distinguish visual differences and make an informed choice

---

### Edge Cases

- What happens when dead links appear in headings or other styled contexts (bold, italic, etc.)?
- How do dead links appear when they're very long (wrapping text)?
- What happens to link styling in different color themes (light vs dark mode, if applicable)?
- How do dead links interact with tag links (which have special # prefix styling)?
- What happens when links contain images or other embedded content?

## Requirements

### Functional Requirements

- **FR-001**: System MUST update dead link color from current orange (#d97706) to a darker burnt orange shade
- **FR-002**: System MUST remove the grey background highlight from dead links while maintaining padding and border-radius settings
- **FR-003**: System MUST preserve the existing behavior where dead links only show special styling on the full tier (appearing as plain text on other tiers)
- **FR-004**: System MUST provide at least three distinct visual options for internal link background styling:
  - Option A: No background (remove background-color from .internal links)
  - Option B: Current behavior (maintain existing background-color: var(--highlight))
  - Option C: Alternative treatment (e.g., reduced opacity, different color, underline instead, or bottom border)
- **FR-005**: System MUST allow easy switching between internal link styling options for testing and comparison
- **FR-006**: Dead links MUST remain visually distinguishable from working internal links across all styling options
- **FR-007**: Link styling changes MUST NOT affect external links, tag links with # prefix, or links containing images

### Key Entities

- **Dead Links**: Internal wiki-style links that point to pages that don't exist, rendered with class `.dead-link` in [custom.scss:6-16](quartz/styles/custom.scss#L6-L16)
- **Internal Links**: Working wiki-style links rendered with class `.internal` in [base.scss:86-128](quartz/styles/base.scss#L86-L128)
- **Broken Links**: Alternative dead link class (`.broken`) used within internal links in [base.scss:94-116](quartz/styles/base.scss#L94-L116)
- **Styling Variables**: CSS custom properties like `var(--highlight)` and `var(--lightgray)` used for background colors

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dead links display with a darker burnt orange color (suggested range: #c45500 to #b85000) instead of the current #d97706
- **SC-002**: Dead links render without any background color on the full tier
- **SC-003**: At least three distinct visual options for internal link backgrounds are created and can be previewed
- **SC-004**: Reader can distinguish dead links from working links within 1 second of viewing a page
- **SC-005**: Link styling refinements apply consistently across all page types (content pages, index, tag pages)
- **SC-006**: Visual changes render correctly across major browsers (Chrome, Firefox, Safari)

## Assumptions

- The current dead link detection mechanism (`.dead-link` class assignment) works correctly and doesn't need modification
- The distinction between "dead links" (`.dead-link`) and "broken links" (`.broken` within `.internal`) represents different use cases and both may need styling updates
- Color scheme changes should maintain sufficient contrast for accessibility (WCAG AA standards)
- The user will make the final decision on internal link background styling after viewing rendered options
- Testing will be done locally using `npx quartz build --serve` before deploying to production

## Out of Scope

- Modifying the logic that determines which links are dead/broken
- Adding new link types or categories beyond dead/internal/external
- Implementing automatic link checking or repair functionality
- Changing hover states or interactive behaviors of links
- Modifying external link styling
- Creating a persistent theme switcher (options are for evaluation only, not runtime switching)
- Implementing dark mode specific styling (unless currently exists)

## Dependencies

- SCSS build system (existing Quartz toolchain)
- CSS custom property system (variables defined in [variables.scss](quartz/styles/variables.scss))
- Existing link classification logic that assigns `.dead-link` and `.broken` classes

## Notes

- Current implementation has two different dead link styling approaches:
  1. `.dead-link` class in [custom.scss](quartz/styles/custom.scss#L6-L16) with orange color and grey background
  2. `.internal.broken` selector in [base.scss](quartz/styles/base.scss#L94-L116) with reduced opacity
- Investigation needed to understand why both exist and whether they should be consolidated or styled consistently
- The user specifically wants to "explore" options for internal link backgrounds, suggesting this is a decision point requiring visual feedback rather than a firm requirement
- Burnt orange color suggestions (not final): #c45500, #cc5500, #b85000, #d2691e (the last being CSS "chocolate")
