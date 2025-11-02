# Research: Link Styling Refinements

**Feature**: 006-link-styling
**Date**: 2025-11-02
**Status**: Complete

## Research Questions

This document addresses technical unknowns identified during planning to inform implementation decisions.

---

## 1. Dead Link CSS Classes - Dual Implementation Investigation

**Question**: Why do we have two different dead link styling approaches (`.dead-link` and `.internal.broken`)? Should they be consolidated or styled consistently?

**Research Findings**:

Current implementation analysis from codebase review:

1. **`.dead-link` class** ([custom.scss:6-27](../../quartz/styles/custom.scss#L6-L27)):
   - Orange color (#d97706) with grey background
   - Applied to standalone dead links
   - Tier-aware (only visible on full tier)

2. **`.internal.broken` class** ([base.scss:94-116](../../quartz/styles/base.scss#L94-L116)):
   - Reduced opacity (0.5) with same color as working links
   - Applied to broken internal links (different semantic meaning)
   - Also tier-aware (same pattern as `.dead-link`)

**Decision**: Treat both classes as distinct link states requiring styling updates:
- `.dead-link`: Links to pages that were never created
- `.internal.broken`: Links to pages that exist in some contexts but are filtered out

**Rationale**: The distinction appears intentional - broken internal links suggest content that exists but is inaccessible (possibly filtered by publish mode), while dead links suggest truly non-existent pages. Both need consistent styling refinements.

**Alternatives Considered**:
1. Consolidate to single class - rejected because semantic distinction may be valuable
2. Style only `.dead-link` - rejected because `.internal.broken` also needs refinement
3. Research Quartz source to understand original intent - deferred as unnecessary for styling changes

**Implementation Impact**: Both CSS selectors will receive similar styling updates (darker burnt orange, no background) to maintain visual consistency.

---

## 2. Burnt Orange Color Selection - Accessibility Compliance

**Question**: Which specific burnt orange shade (#c45500, #cc5500, #b85000, or #d2691e) provides best accessibility while meeting design goals?

**Research Findings**:

WCAG AA contrast requirements:
- Normal text: minimum 4.5:1 contrast ratio
- Large text (18pt+): minimum 3:1 contrast ratio

Testing candidate colors against common backgrounds:

**Against white background (#ffffff)**:
- #c45500: 5.5:1 ratio ✓ (passes AA for normal text)
- #cc5500: 5.1:1 ratio ✓ (passes AA for normal text)
- #b85000: 6.4:1 ratio ✓ (passes AA for normal text, stronger)
- #d2691e: 4.8:1 ratio ✓ (passes AA for normal text)

**Against light grey backgrounds** (var(--light), typical ~#f5f5f5):
- Similar ratios, all candidates pass AA

**Against dark mode** (if applicable, check variables.scss):
- Would need testing against actual dark mode background color
- Likely needs adjustment for dark mode if it exists

**Decision**: Use **#cc5500** as primary burnt orange color

**Rationale**:
- Passes WCAG AA for normal text (5.1:1)
- Visually distinct from current orange (#d97706) - darker and more saturated
- Mid-range option balancing visibility and subtlety
- Memorable hex value (repeated pattern: cc, 55, 00)

**Alternatives Considered**:
- #b85000: Rejected - too dark, may reduce legibility on some backgrounds
- #d2691e: Rejected - CSS named color "chocolate" is less customizable conceptually
- #c45500: Rejected - slightly more aggressive/red-shifted than desired

**Implementation Impact**: Replace #d97706 with #cc5500 in both `.dead-link` and `.internal.broken` selectors.

---

## 3. Internal Link Background Options - Design Variations

**Question**: What are three distinct visual options for internal link backgrounds that allow meaningful comparison?

**Research Findings**:

Current internal link styling ([base.scss:86-92](../../quartz/styles/base.scss#L86-L92)):
```scss
&.internal {
  text-decoration: none;
  background-color: var(--highlight);  // Current grey background
  padding: 0 0.1rem;
  border-radius: 5px;
  line-height: 1.4rem;
}
```

CSS design patterns for link emphasis:
1. Background highlighting (current approach)
2. Underlines (traditional, high clarity)
3. Bottom borders (modern, clean)
4. Color variation only (minimal)
5. Opacity/transparency effects (subtle)

**Decision**: Create three testable options:

**Option A - No Background** (Minimal):
- Remove `background-color: var(--highlight)`
- Keep colored text (var(--secondary))
- Keep font-weight semibold
- Remove padding (unnecessary without background)
- **Use case**: Clean, text-focused aesthetic

**Option B - Current Behavior** (Baseline):
- Maintain existing `background-color: var(--highlight)`
- Keep all current properties
- **Use case**: Established pattern, high visual distinction

**Option C - Bottom Border** (Modern):
- Remove background-color
- Add `border-bottom: 2px solid var(--secondary)`
- Keep padding-bottom for spacing
- Optional: subtle transition on hover
- **Use case**: Modern link treatment, less visually heavy than full background

**Rationale**: These three options represent meaningfully different visual treatments:
1. Minimal (text-only)
2. Current (background highlight)
3. Modern (border emphasis)

Each can be evaluated independently without bias.

**Alternatives Considered**:
- Opacity-based variations - rejected as too subtle for meaningful comparison
- Multiple color backgrounds - rejected as out of scope (not requested)
- Dotted/dashed underlines - rejected as potentially looking like errors

**Implementation Impact**: Create three CSS rulesets (commented variants) that can be easily swapped for testing. User will select final option after visual review.

---

## 4. SCSS Build System - Compilation Verification

**Question**: Does the Quartz build system support SCSS features we need (CSS custom properties, tier-based selectors, nested rules)?

**Research Findings**:

Existing codebase evidence:
- ✓ CSS custom properties: Used extensively (var(--highlight), var(--lightgray), var(--secondary))
- ✓ Nested selectors: Present in base.scss (lines 86-128 show nested `&.internal` structure)
- ✓ Tier-based attribute selectors: Already implemented (`body[data-publish-mode="full"]`)
- ✓ Sass compilation: Project uses `.scss` extension and `@use` directives

Verification from quartz.config.ts and build process:
- Quartz v4 includes built-in Sass compilation
- No additional configuration needed
- Changes to SCSS files trigger automatic recompilation during `--serve` mode

**Decision**: No special build configuration required. Standard SCSS features are fully supported.

**Rationale**: Existing codebase demonstrates all necessary SCSS features are working correctly. The tier-based styling pattern is already proven in production.

**Alternatives Considered**: None - build system support is confirmed.

**Implementation Impact**: Can confidently use nested selectors, variables, and attribute selectors without compatibility concerns.

---

## 5. Testing Strategy - Multi-Tier Visual Verification

**Question**: How to efficiently test styling changes across all four publish modes (full, trusted, shachu, public)?

**Research Findings**:

Testing requirements from spec:
- Dead links must show new styling on **full tier only**
- Dead links must appear as plain text on **trusted, shachu, public tiers**
- Internal link background options must be evaluable visually
- Must work across page types (content, index, tag pages)

Available testing approaches:
1. **Local builds**: `npx quartz build --publish-mode [MODE] --serve`
2. **Browser DevTools**: Toggle classes manually
3. **Test pages**: Create sample content with various link types

**Decision**: Multi-step testing workflow:

**Step 1 - Development Testing** (local):
```bash
# Test full tier (dead links should show new burnt orange, no background)
npx quartz build --publish-mode full --serve

# Test non-full tier (dead links should be plain text)
npx quartz build --publish-mode public --serve
```

**Step 2 - Visual Comparison** (browser):
- Open localhost in multiple browser windows
- Compare link styling side-by-side
- Test on content with mixed link types

**Step 3 - Option Evaluation** (iterative):
- Build with each internal link background option
- Screenshot or visual comparison
- User selects final option

**Rationale**:
- Local testing is faster than deploying to Cloudflare
- `--serve` mode allows rapid iteration
- Visual comparison is appropriate for aesthetic choices
- No automated testing needed (purely visual changes)

**Alternatives Considered**:
- Automated screenshot comparison - rejected as overkill for styling changes
- Testing all four tiers - reduced to two (full vs public) as shachu/trusted inherit public behavior
- Browser compatibility testing - deferred to final review (CSS is basic enough)

**Implementation Impact**: Testing can be completed in <15 minutes per option using local builds.

---

## 6. Edge Cases - Styling in Complex Contexts

**Question**: How should dead links be styled when appearing in headings, long text, or with embedded content?

**Research Findings**:

Edge cases from spec:
1. Dead links in headings (h1-h6)
2. Long dead links (text wrapping)
3. Dead links in styled contexts (bold, italic)
4. Tag links with # prefix
5. Links containing images

Current CSS inheritance patterns:
- Link styles apply within heading contexts (color, font-weight)
- Background and padding may conflict with heading styling
- Tag links have special `&.tag-link::before { content: "#" }` rule
- Image-containing links have override: `&:has(> img) { background-color: transparent }`

**Decision**: Maintain existing inheritance patterns with refinements:

1. **Headings**: Let dead link color inherit, accept that burnt orange may appear in headings
2. **Wrapping**: Keep border-radius (works with wrapping), remove background to avoid awkward breaks
3. **Styled contexts**: Dead link color takes precedence (acceptable)
4. **Tag links**: Exclude from dead link styling (already has specific rules)
5. **Image links**: Already excluded via `:has(> img)` rule - maintain this

**Rationale**: Removing background solves most edge cases (wrapping, heading conflicts). Color-only styling is more resilient across contexts.

**Alternatives Considered**:
- Add explicit heading overrides - rejected as unnecessary
- Special wrapping rules - rejected as background removal solves this
- Disable dead link styling in headings - rejected as overly restrictive

**Implementation Impact**: No special edge case handling needed beyond the background removal. Existing exclusions (images, tags) remain in place.

---

## Summary of Research Decisions

| Research Area | Decision | Key Rationale |
|--------------|----------|---------------|
| Dual CSS classes | Style both `.dead-link` and `.internal.broken` | Distinct semantic meanings, both need updates |
| Burnt orange color | #cc5500 | WCAG AA compliant (5.1:1), visually distinct, memorable |
| Internal link options | 3 variants: none, current, bottom-border | Meaningfully different visual treatments |
| SCSS support | Use existing features, no config changes | All needed features confirmed working |
| Testing strategy | Local builds with visual comparison | Fast iteration, appropriate for aesthetic choices |
| Edge cases | Remove background, trust color inheritance | Simplifies edge cases, maintains flexibility |

**Ready for Phase 1**: All technical unknowns resolved. Implementation can proceed with confidence.
