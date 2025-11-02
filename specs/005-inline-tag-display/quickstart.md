# Quickstart: Inline Tag Display Implementation

**Feature**: 005-inline-tag-display
**Audience**: Developers implementing this feature
**Prerequisites**: Familiarity with Quartz v4 architecture, React/TypeScript basics

## Overview

This guide provides step-by-step instructions for implementing inline tag display. The implementation involves two changes:
1. **Fix a bug**: Dead link detection is incorrectly converting tag links to non-functional spans
2. **Remove TagList**: Remove the TagList component from the page layout

**Estimated time**: 1-2 hours (including testing across all publish modes)

## Before You Begin

### Verify Current Behavior

1. **Build the site locally**:
   ```bash
   cd /Users/dario/git/obsidian-quartz-fork
   npx quartz build --publish-mode full --serve
   ```

2. **Open in browser** (typically http://localhost:8080)

3. **Navigate to a page with tags**, for example:
   - https://trusted.dario.ca/Tea-Resources/紙片-(Shihen)/Number-of-sweets-for-higher-temae

4. **Observe current behavior**:
   - [ ] Tags appear in a section at the top of the page (below title/metadata) styled as pill-shaped badges
   - [ ] Inline tags in content appear as plain text (NOT clickable)
   - [ ] Inline tags are missing the # symbol
   - [ ] Clicking top tags navigates to tag page (works)
   - [ ] Clicking inline tags does nothing (broken)

5. **Take screenshots** for before/after comparison

### Prepare Test Content

Create a test markdown file in `content/` folder for validation:

```markdown
---
title: Tag Display Test
tags:
  - frontmatter-tag
  - test
---

# Tag Display Test

This page has a frontmatter tag above, and inline tags here: #inline-tag #test/hierarchical

Tags in different contexts:

- List item with #list-tag
- > Blockquote with #quote-tag

## Header with #header-tag

Regular paragraph with multiple tags: #first #second #third/nested

Only the inline tags (after the #) should appear in content.
```

Save as `content/tag-test.md` for testing.

## Implementation Steps

### Step 1: Fix Dead Link Detection Bug

**File**: [quartz/plugins/emitters/contentPage.tsx](../../quartz/plugins/emitters/contentPage.tsx)

**Problem**: Lines 55-72 convert tag links from `<a>` to `<span>` because tag page URLs aren't in the `allSlugs` array (they're generated dynamically).

1. Open the file in your editor

2. Locate the dead link detection logic (around line 55-72)

3. Find the section that looks like:
```typescript
if (!allSlugs.includes(href as RelativeURL)) {
  if (elem.properties.className === undefined) {
    elem.properties.className = "dead-link"
  } else if (Array.isArray(elem.properties.className)) {
    // ... more checks ...
    elem.properties.className.push("dead-link")
  }
  // ... more code ...
  elem.tagName = "span"  // <-- Line 71: This is the problem!
}
```

4. **Add check to skip tag-link class** before the dead link logic:

**After the `if (!allSlugs.includes(href as RelativeURL)) {` line, add**:

```typescript
if (!allSlugs.includes(href as RelativeURL)) {
  // Skip dead link conversion for tag links (they're generated dynamically)
  const isTagLink =
    (Array.isArray(elem.properties.className) &&
      elem.properties.className.includes("tag-link")) ||
    (typeof elem.properties.className === "string" &&
      elem.properties.className.includes("tag-link"))

  if (isTagLink) {
    return  // Skip dead link conversion for tag links
  }

  // Rest of existing dead link logic remains unchanged
  if (elem.properties.className === undefined) {
    elem.properties.className = "dead-link"
  }
  // ... etc
}
```

**Save the file.**

### Step 2: Remove TagList from Layout

**File**: [quartz.layout.ts](../../quartz.layout.ts)

1. Open the file in your editor

2. Find the `defaultContentPageLayout` configuration (around line 28)

3. Locate the `beforeBody` array (around line 30)

4. Find the line with `Component.TagList()` - should be around line 35

5. **Delete or comment out the line**:

**Before**:
```typescript
beforeBody: [
  Component.Breadcrumbs(),
  Component.ArticleTitle(),
  Component.ContentMeta(),
  Component.FrontmatterProperties(),
  Component.TagList(),  // <-- Remove this
],
```

**After**:
```typescript
beforeBody: [
  Component.Breadcrumbs(),
  Component.ArticleTitle(),
  Component.ContentMeta(),
  Component.FrontmatterProperties(),
  // Component.TagList() removed - tags now only appear inline
],
```

**Save the file.**

### Step 3: Verify CSS (No Changes Needed)

The CSS is already correct - it just wasn't working because tags were being rendered as `<span>` instead of `<a>`.

1. **Check base.scss** ([quartz/styles/base.scss](../../quartz/styles/base.scss)):
   - Lines 123-127 should have:
     ```scss
     a.tag-link::before {
       content: "#";
     }
     ```
   - This adds the hash symbol to tag links
   - Leave this unchanged - it will work now that bug is fixed

2. **No other CSS changes needed** - existing styles are correct

### Step 4: Build and Test Locally

#### Test in Full Mode

```bash
npx quartz build --publish-mode full --serve
```

Navigate to your test page and verify:

- [ ] No tags section appears at the top of the page ✅
- [ ] Inline tags appear in content where written (e.g., "#inline-tag") ✅
- [ ] Inline tags are NOW clickable links (was broken before) ✅
- [ ] Hash symbol (#) is NOW visible before tag name (was missing before) ✅
- [ ] Tags are styled as regular links (blue color, not pills) ✅
- [ ] Clicking a tag navigates to the tag page (`/tags/{tag}`) ✅
- [ ] Tag pages list correct content ✅
- [ ] Page layout looks clean without gaps ✅

#### Test Edge Cases

1. **Page with only frontmatter tags** (no inline tags):
   - [ ] No tags appear in content
   - [ ] No empty tags section at top
   - [ ] Tag page still lists this content

2. **Page with both frontmatter and inline tags**:
   - [ ] Only inline tags appear in content
   - [ ] Tag page includes content for both frontmatter and inline tags

3. **Tags in various contexts**:
   - [ ] Tags in lists render correctly
   - [ ] Tags in blockquotes render correctly
   - [ ] Tags in headers render correctly
   - [ ] Tags in regular paragraphs render correctly

4. **Hierarchical tags** (e.g., `#tea/ceremony/advanced`):
   - [ ] Full hierarchy visible with slashes
   - [ ] Clicking navigates to appropriate tag page
   - [ ] Parent tag pages also list this content

#### Test All Publish Modes

Repeat the above tests for each publish mode:

```bash
# Public mode
npx quartz build --publish-mode public --serve

# Trusted mode
npx quartz build --publish-mode trusted --serve

# Shachu mode
npx quartz build --publish-mode shachu --serve

# Full mode (already tested above)
npx quartz build --publish-mode full --serve
```

For each mode, verify:
- [ ] Tags display correctly inline
- [ ] No top tags section appears
- [ ] Tag navigation works
- [ ] Filtered content doesn't appear in tag pages

### Step 5: Compare Before/After

1. **Visual comparison**:
   - Before: Tags in pill badges at top of page
   - After: Tags as regular links inline in content

2. **Screenshot the test page** with inline tags visible

3. **Verify improvements**:
   - [ ] Cleaner page layout (no top section)
   - [ ] Tags in context where author intended
   - [ ] Hash symbols visible
   - [ ] Links styled consistently with other content links

### Step 6: Clean Up Test Content (Optional)

If you created test files in `content/`, remove them:

```bash
rm -f content/tag-test.md
```

The `content/` folder should remain empty or minimal (per repository conventions).

## Troubleshooting

### Issue 1: Inline Tags Still Not Clickable

**Symptoms**: After changes, inline tags still appear as plain text

**Diagnosis**: Dead link fix wasn't applied correctly

**Solution**:
1. Double-check contentPage.tsx changes
2. Ensure the `isTagLink` check comes BEFORE the rest of the dead link logic
3. Verify the early `return` statement is present
4. Rebuild: `rm -rf public && npx quartz build`

### Issue 2: Hash Symbol Still Missing

**Symptoms**: Tags are clickable but # symbol doesn't appear

**Diagnosis**: CSS selector might not be matching

**Solution**:
1. Inspect tag element in browser developer tools
2. Verify element is `<a class="tag-link">` not `<span class="tag-link">`
3. Check base.scss has `a.tag-link::before { content: "#"; }`
4. If selector is wrong, fix it to match the actual element type

### Issue 3: Tags Still Shown at Top

**Symptoms**: Tags still appear in top section after removing TagList

**Diagnosis**: Layout change wasn't saved or build wasn't refreshed

**Solution**:
1. Verify quartz.layout.ts doesn't have `Component.TagList()` line
2. Clear build cache: `rm -rf public`
3. Rebuild completely: `npx quartz build`
4. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Issue 4: Tag Navigation Broken

**Symptoms**: Clicking tags doesn't navigate to tag pages, or tag pages are 404

**Diagnosis**: TagPage emitter might be disabled

**Solution**:
1. Check [quartz.config.ts](../../quartz.config.ts)
2. Find the `emitters` section
3. Ensure `Plugin.TagPage()` is included:

```typescript
emitters: [
  // ... other emitters
  Plugin.TagPage(),  // Must be present
]
```

### Issue 5: Gap in Page Layout

**Symptoms**: Empty space remains where TagList used to be

**Diagnosis**: CSS spacing from surrounding components

**Solution**:
1. Inspect page in browser developer tools
2. Check margins on components before/after the removed TagList
3. If excessive spacing exists, adjust margins in component CSS
4. This is cosmetic and low priority - usually not an issue

### Issue 6: Tags Appear Differently Across Modes

**Symptoms**: Tag display varies between publish modes

**Diagnosis**: Unlikely - tag display should be consistent

**Solution**:
1. Verify you're testing the same page/content in each mode
2. Check that publish mode filtering isn't hiding the page entirely
3. Clear browser cache between mode tests
4. Rebuild from scratch: `rm -rf public && npx quartz build --publish-mode [MODE]`

## Verification Checklist

Before considering implementation complete:

### Functional Requirements

- [ ] FR-001: Tags render inline at exact markdown position ✅
- [ ] FR-002: Tags display as clickable links with # symbol ✅
- [ ] FR-003: No separate tags section at top of pages ✅
- [ ] FR-004: Tag click functionality navigates to tag pages ✅
- [ ] FR-005: Frontmatter tags remain indexed (but not displayed) ✅
- [ ] FR-006: Tags styled identically to regular links ✅
- [ ] FR-007: Tags work in all content contexts (lists, quotes, etc.) ✅

### Success Criteria

- [ ] SC-001: Readers see tags at intended contextual location ✅
- [ ] SC-002: Tag navigation works identically to before ✅
- [ ] SC-003: Performance within 10% of baseline (likely improved) ✅
- [ ] SC-004: No visual bugs across different contexts ✅
- [ ] SC-005: User feedback positive (to be confirmed post-deployment) ⏳

### Testing Coverage

- [ ] Inline tags in paragraphs tested ✅
- [ ] Inline tags in lists tested ✅
- [ ] Inline tags in blockquotes tested ✅
- [ ] Inline tags in headers tested ✅
- [ ] Hierarchical tags tested ✅
- [ ] Pages with only frontmatter tags tested ✅
- [ ] Pages with both frontmatter and inline tags tested ✅
- [ ] Tag navigation tested ✅
- [ ] Tag page generation verified ✅
- [ ] All four publish modes tested ✅

## Rollback Procedure

If issues arise after deployment, rollback is simple:

1. **Revert the single line change** in quartz.layout.ts:

```typescript
beforeBody: [
  Component.Breadcrumbs(),
  Component.ArticleTitle(),
  Component.ContentMeta(),
  Component.FrontmatterProperties(),
  Component.TagList(),  // <-- Re-add this line
],
```

2. **Rebuild and deploy**:

```bash
npx quartz build --publish-mode [MODE]
```

3. **Verify** tags reappear at top of pages

## Next Steps

After implementation and testing:

1. **Update ARCHITECTURE.md**:
   - Document the tag display change
   - Explain that TagList component exists but is not used in layout
   - Add to "Custom Features" section

2. **Update CLAUDE.md**:
   - Add note about tag display behavior
   - Reference this spec for details

3. **Move task in FUTURE_TASKS.md**:
   - From pending to completed

4. **Commit changes**:
   ```bash
   git add quartz.layout.ts docs-custom/ARCHITECTURE.md docs-custom/CLAUDE.md docs-custom/FUTURE_TASKS.md
   git commit -m "feat: display tags inline in content instead of at page top (005)

   - Remove TagList component from defaultContentPageLayout
   - Tags now appear only where written in markdown source
   - Styled as regular links with # symbol visible
   - All tag navigation and indexing functionality preserved

   Closes #005 - Inline Tag Display"
   ```

5. **Push to trigger deployment**:
   ```bash
   git push origin 005-inline-tag-display
   ```

6. **Monitor all four sites** after automated rebuild:
   - notes.dario.ca (Full mode)
   - notes-private.dario.ca (Trusted mode)
   - notes-shachu.dario.ca (Shachu mode)
   - notes-public.dario.ca (Public mode)

7. **Verify on live sites**:
   - Check several pages with tags
   - Confirm tag navigation works
   - Verify no visual issues

8. **Merge to main branch** (v4) after verification

## Additional Resources

- **Feature Specification**: [spec.md](spec.md)
- **Implementation Plan**: [plan.md](plan.md)
- **Research Findings**: [research.md](research.md)
- **Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- **Architecture Docs**: [docs-custom/ARCHITECTURE.md](../../docs-custom/ARCHITECTURE.md)

## Support

If you encounter issues not covered in this guide:

1. Review the [research.md](research.md) file for technical details
2. Check the [plan.md](plan.md) for design decisions
3. Inspect the referenced source files directly
4. Consult ARCHITECTURE.md for system overview

The implementation is intentionally simple - one line change with extensive testing. If it seems more complicated, you may be overthinking it!
