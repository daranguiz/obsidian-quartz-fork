# Research: Inline Tag Display Implementation

**Feature**: 005-inline-tag-display
**Date**: 2025-11-02
**Research Phase**: Phase 0 - Design Decisions & Technical Investigation

## Overview

This document captures the research findings and design decisions for changing tag display from a top-of-page section to inline rendering within content.

## Current Implementation Analysis

### CRITICAL BUG DISCOVERED

**Inline tags are currently broken**. They appear as non-clickable plain text without the # symbol.

**Root cause** ([quartz/plugins/emitters/contentPage.tsx](../../../quartz/plugins/emitters/contentPage.tsx:55-72)):
- Dead link detection logic checks if link href exists in `allSlugs` array
- Tag page URLs (e.g., `/tags/test-tag`) are NOT in `allSlugs` because they're generated dynamically by TagPage emitter
- Links that don't match `allSlugs` are marked as dead links
- **Line 71**: Dead links have their `tagName` changed from `"a"` to `"span"`
- This converts `<a class="tag-link" href="/tags/test-tag">` to `<span class="tag-link" href="/tags/test-tag">` (invalid HTML)
- Spans with href attributes don't navigate (not clickable)
- CSS `a.tag-link::before` doesn't match `span.tag-link`, so # symbol doesn't appear

### Tag Processing Pipeline

**Discovery**: Tags in Quartz are processed through a multi-stage pipeline:

1. **Parsing Stage** ([quartz/plugins/transformers/ofm.ts](../../../quartz/plugins/transformers/ofm.ts:336-365))
   - Regex pattern matches inline `#tag` and `#tag/subtag` syntax (line 140-142)
   - Filters out date-like patterns (e.g., `#2024/01/15`)
   - Converts matched tags to MDAST link nodes with class `internal tag-link`
   - Automatically adds inline tags to frontmatter tags array
   - **This part works correctly** - creates proper link nodes

2. **Frontmatter Processing** ([quartz/plugins/transformers/frontmatter.ts](../../../quartz/plugins/transformers/frontmatter.ts:86-87))
   - Normalizes all tags using `slugTag()` function
   - Merges inline tags with YAML frontmatter tags
   - Deduplicates the combined tag array
   - Result stored in `fileData.frontmatter.tags`

3. **Display Stage** ([quartz/components/TagList.tsx](../../../quartz/components/TagList.tsx))
   - Renders tags from `fileData.frontmatter.tags` array
   - Creates pill-styled badges in a flexbox layout
   - Each tag is a clickable link to `/tags/{tag}` page
   - Included in page layout via `quartz.layout.ts` beforeBody section

4. **Tag Page Generation** ([quartz/plugins/emitters/tagPage.tsx](../../../quartz/plugins/emitters/tagPage.tsx))
   - Creates individual listing pages for each tag
   - Supports hierarchical tags (creates pages for parent segments)
   - Generates tag index page at `/tags/index`

### CSS Styling Investigation

**Discovery**: Tag styling is split across multiple files:

- **Inline tag links** ([quartz/styles/base.scss](../../../quartz/styles/base.scss:123-127)):
  - Class: `a.internal.tag-link`
  - Hash symbol added via `::before { content: "#"; }` pseudo-element
  - No pill styling at this level - inherits default link styling

- **TagList component tags** ([quartz/components/TagList.tsx](../../../quartz/components/TagList.tsx:27-54)):
  - Inline CSS defines pill appearance
  - `border-radius: 8px` for rounded corners
  - `background-color: var(--highlight)` for semi-transparent background
  - `padding: 0.2rem 0.4rem` for spacing
  - This styling only applies to tags rendered by TagList component

- **List page tags** ([quartz/components/styles/listPage.scss](../../../quartz/components/styles/listPage.scss)):
  - Grid layout for tag display on folder/tag index pages
  - Hidden on mobile devices

**Key Finding**: Inline tags in markdown content are already rendered as regular links with the hash symbol. The pill styling only appears on tags rendered by the TagList component at the top of pages. This means removing TagList automatically removes the pills without requiring CSS changes.

## Design Decisions

### Decision 1: Fix Dead Link Detection for Tag Pages

**Decision**: Modify contentPage.tsx to exclude tag-link class from dead link conversion

**Rationale**:
- The ofm.ts transformer correctly creates link nodes for inline tags
- The contentPage.tsx emitter incorrectly converts these to spans because tag page URLs aren't in `allSlugs`
- Tag pages are generated dynamically by TagPage emitter, so their slugs won't exist in `allFiles`
- Solution: Skip dead link conversion for elements with `tag-link` class

**Alternatives Considered**:
- Add tag page slugs to `allSlugs` array
  - **Rejected**: Would require significant refactoring of emitter order and data flow
- Generate tag pages before content pages
  - **Rejected**: Breaking change to plugin architecture
- Remove dead link detection entirely
  - **Rejected**: Useful feature for finding broken internal links
- Check for tag-link class before converting to span
  - **Selected**: Surgical fix, minimal code change, preserves all other functionality

**Implementation**: Add condition in contentPage.tsx line 55-72 to skip tag-link elements

### Decision 2: Remove TagList from Layout

**Decision**: Remove `Component.TagList()` from `quartz.layout.ts` beforeBody section

**Rationale**:
- Directly addresses requirement FR-003 (no top-of-page tags section)
- Simple, surgical change with no side effects
- TagList component can remain in codebase for potential future use
- No impact on tag indexing or page generation

**Alternatives Considered**:
- Add configuration option to conditionally show/hide TagList
  - **Rejected**: Over-engineering - requirement is clear that top tags should not appear
- Delete TagList component entirely
  - **Rejected**: Keep component for potential future use, just remove from layout
- Move TagList to different location (sidebar, footer)
  - **Rejected**: Out of scope - requirement is to show tags inline only

**Implementation**: Single line removal from quartz.layout.ts

### Decision 3: CSS Styling Approach

**Decision**: CSS is already correct, will work once dead link bug is fixed

**Rationale**:
- base.scss already has `a.tag-link::before { content: "#"; }` to add hash symbol
- Inline tag links will inherit default link styling (blue color, underline on hover)
- Pill styling is scoped to TagList component and won't affect inline tags
- Once tags are rendered as `<a>` instead of `<span>`, existing CSS will work correctly

**Alternatives Considered**:
- Add `span.tag-link::before` rule as fallback
  - **Rejected**: Spans shouldn't have hrefs; fix the HTML generation instead
- Modify CSS to style both `a` and `span` elements
  - **Rejected**: Treats symptom not cause; invalid HTML should be fixed
- Add special styling to make tags visually distinct from regular links
  - **Rejected**: Contradicts user requirement for tags to look like regular links

**No CSS changes required**: Existing CSS is correct, HTML generation is the problem

### Decision 4: Frontmatter Tag Handling

**Decision**: Keep frontmatter tag processing unchanged

**Rationale**:
- Frontmatter tags contribute to tag indexing (needed for tag pages)
- User expectation: frontmatter tags don't display visually (only inline tags do)
- Removing TagList component automatically stops displaying frontmatter tags
- Tag page emitter still needs frontmatter tags to build `/tags/{tag}` pages

**Alternatives Considered**:
- Stop parsing frontmatter tags entirely
  - **Rejected**: Would break tag pages for content with only frontmatter tags
- Add visual indicator that frontmatter tags exist but aren't shown
  - **Rejected**: Out of scope - spec doesn't request this
- Display frontmatter tags in different style/location
  - **Rejected**: Contradicts requirement to remove top tags section

**Impact**: None on implementation - existing behavior is correct

### Decision 5: Tag Page Generation

**Decision**: No changes to TagPage emitter or tag listing pages

**Rationale**:
- Tag navigation functionality must be preserved per FR-004
- TagPage emitter operates independently of how tags are displayed
- Tag listing pages use different layout (defaultListPageLayout)
- Scope explicitly excludes "Changes to tag listing/index pages"

**Alternatives Considered**:
- Update tag page layout to show inline tags
  - **Rejected**: Tag pages don't contain inline content, they list other pages
- Modify tag page styling
  - **Rejected**: Out of scope - only content page tag display is changing
- Remove hierarchical tag page generation
  - **Rejected**: Would break existing tag navigation

**Verification**: Tag pages should continue working identically after changes

### Decision 6: Testing Strategy

**Decision**: Manual testing across all 4 publish modes with visual inspection

**Rationale**:
- This is primarily a visual/UX change
- Automated tests for Quartz components would require significant test infrastructure
- Manual testing can verify all edge cases efficiently
- Four publish modes multiply test surface (each mode must be verified)

**Test Coverage**:
- Inline tags in various markdown contexts (paragraphs, lists, headers, blockquotes)
- Pages with only frontmatter tags (should show no tags)
- Pages with both frontmatter and inline tags
- Hierarchical tags (e.g., `#tea/ceremony/advanced`)
- Tag link navigation and tag page generation
- All four publish modes (public, trusted, shachu, full)

**Alternatives Considered**:
- Write automated component tests
  - **Rejected**: Disproportionate effort for simple layout change
- Test only in full mode
  - **Rejected**: Constitution requires testing across all modes
- Skip edge case testing
  - **Rejected**: Edge cases documented in spec must be verified

**Test Command**: `npx quartz build --publish-mode [MODE] --serve`

## Technical Constraints

### Constraint 1: Backward Compatibility

**Requirement**: Existing tag page URLs must not break

**Analysis**:
- Tag page URLs are generated by TagPage emitter using `slugTag()` function
- URL structure: `/tags/{slugified-tag}`
- No changes to slug generation or URL structure
- Tag links in content use same URL format as TagList component tags

**Compliance**: ✅ Satisfied - no URL changes in implementation

### Constraint 2: Tag Indexing Integrity

**Requirement**: Tag indexing and search functionality must continue working

**Analysis**:
- Indexing happens in frontmatter processing (frontmatter.ts)
- Inline tags are automatically added to frontmatter.tags array
- TagPage emitter reads from frontmatter.tags to generate listing pages
- No modifications to frontmatter processing or tag page generation

**Compliance**: ✅ Satisfied - indexing pipeline unchanged

### Constraint 3: Multi-Mode Support

**Requirement**: Must work across all 4 publish modes

**Analysis**:
- Tag display is independent of publish mode filtering
- PublishMode filter operates on entire files, not tag visibility
- Layout configuration (quartz.layout.ts) applies to all modes
- CSS styling is global across all builds

**Compliance**: ✅ Satisfied - changes are mode-agnostic

### Constraint 4: Performance

**Requirement**: No build performance degradation

**Analysis**:
- Removing a component from layout reduces rendering work
- No additional transformations or processing added
- Tag parsing already happens during markdown transformation
- Expected impact: Slight performance improvement (less rendering)

**Compliance**: ✅ Satisfied - likely improvement, definitely no degradation

### Constraint 5: No Vault Changes

**Requirement**: Should not require changes to existing markdown content files

**Analysis**:
- All changes are in build system (obsidian-quartz-fork repo)
- Inline `#tag` syntax already supported and widely used
- No new frontmatter fields or tag formats required
- Existing content continues working without modification

**Compliance**: ✅ Satisfied - zero vault changes needed

## Risk Analysis

### Risk 1: Inline Tags Not Currently Rendering

**Description**: Research assumes inline tags already appear in content. If this assumption is wrong, implementation becomes more complex.

**Likelihood**: Low - code review confirms ofm.ts converts inline tags to links

**Impact**: High - would require transformer modifications

**Mitigation**:
- Build site locally before starting implementation
- Verify inline tags appear in rendered content
- If not appearing, investigate why transformer output isn't rendering

**Verification**: Visual inspection of locally built site with test content

### Risk 2: Pill Styling Affecting Inline Tags

**Description**: If pill CSS applies to all `.tag-link` elements (not just TagList tags), removing TagList won't fix the styling.

**Likelihood**: Low - TagList uses inline/scoped CSS

**Impact**: Medium - would require CSS modifications

**Mitigation**:
- Inspect rendered HTML to confirm CSS scope
- Test with TagList removed before considering CSS changes
- Add CSS reset rule if needed: `.tag-link { background: none; border-radius: 0; padding: 0; }`

**Verification**: Browser developer tools CSS inspection

### Risk 3: Breaking Tag Pages

**Description**: Removing TagList might somehow break tag page generation or navigation

**Likelihood**: Very Low - TagList is display-only component

**Impact**: High - would break site navigation

**Mitigation**:
- TagList reads from frontmatter, doesn't write to it
- TagPage emitter operates independently of components
- Test tag navigation thoroughly after changes

**Verification**: Click tag links and verify tag pages load correctly

### Risk 4: Publish Mode Differences

**Description**: Tag display might work differently across publish modes due to filtering

**Likelihood**: Low - tag display is independent of publish filtering

**Impact**: Medium - would require mode-specific configuration

**Mitigation**:
- Test all four modes during implementation
- Verify tag links don't point to filtered content
- PublishMode filter already prevents this scenario

**Verification**: Test tag navigation in each publish mode

### Risk 5: Frontmatter Tags Appearing Unexpectedly

**Description**: Pages with only frontmatter tags might display tags in unexpected way

**Likelihood**: Low - frontmatter tags only indexed, not rendered inline

**Impact**: Low - cosmetic issue only

**Mitigation**:
- Test pages with only frontmatter tags (no inline tags)
- Expected behavior: no visible tags on page
- Confirm in spec that this is desired behavior

**Verification**: Create test page with only frontmatter tags, no inline tags

## Implementation Readiness

### Ready to Implement

✅ All design decisions finalized
✅ No technical unknowns remaining
✅ Implementation path is clear and simple
✅ Risk mitigation strategies defined
✅ Testing strategy documented
✅ Constitutional compliance verified

### Pre-Implementation Checklist

- [ ] Build site locally with current code
- [ ] Verify inline tags already appear in content
- [ ] Identify exact line in quartz.layout.ts to modify
- [ ] Screenshot current tag display for comparison
- [ ] Prepare test content with various tag scenarios

### Implementation Complexity

**Estimated effort**: Low (1-2 hours including testing)

**Complexity factors**:
- Single file change (quartz.layout.ts)
- No new code to write
- Straightforward testing
- Well-understood existing codebase

**Risk level**: Low - reversible change with no side effects

## References

### Key Files
- [quartz/plugins/transformers/ofm.ts](../../../quartz/plugins/transformers/ofm.ts) - Lines 336-368 (tag parsing)
- [quartz.layout.ts](../../../quartz.layout.ts) - Line 35 (TagList inclusion)
- [quartz/styles/base.scss](../../../quartz/styles/base.scss) - Lines 123-127 (tag-link styling)
- [quartz/components/TagList.tsx](../../../quartz/components/TagList.tsx) - Full file (component to remove)

### Related Documentation
- [Feature Specification](spec.md)
- [Implementation Plan](plan.md)
- [Constitution](.specify/memory/constitution.md) - Principles I-VII
- [ARCHITECTURE.md](../../../docs-custom/ARCHITECTURE.md) - Will be updated post-implementation

## Appendix: Code Snippets

### Current Tag Parsing (ofm.ts)

```typescript
// Lines 336-368: Tag detection and conversion
if (opts.parseTags) {
  const tags = new Set(
    [...(tree.children.flatMap(findAndReplace) as string[])].map((tag) =>
      slugTag(tag.slice(1)),
    ),
  )

  file.data.frontmatter.tags = [
    ...(file.data.frontmatter.tags ?? []),
    ...tags,
  ].filter((tag) => typeof tag === "string")
}

// Line 140-142: Tag regex pattern
const tagRegex = new RegExp(
  /(?<=^| )#((?:[-_\p{L}\p{Emoji}\p{M}\d])+(?:\/[-_\p{L}\p{Emoji}\p{M}\d]+)*)/gu,
)
```

### Current Layout Configuration (quartz.layout.ts)

```typescript
// Lines 30-40: beforeBody section includes TagList
beforeBody: [
  Component.Breadcrumbs(),
  Component.ArticleTitle(),
  Component.ContentMeta(),
  Component.FrontmatterProperties(),
  Component.TagList(),  // <-- THIS LINE TO BE REMOVED
],
```

### Current CSS Styling (base.scss)

```scss
// Lines 123-127: Hash symbol for tag links
a {
  &.tag-link {
    &::before {
      content: "#";
    }
  }
}
```

## Next Steps

See [plan.md](plan.md) Phase 1 for detailed implementation design and [quickstart.md](quickstart.md) for step-by-step implementation guide.
