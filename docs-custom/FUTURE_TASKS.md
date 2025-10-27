# Future Tasks & Improvements

This document tracks planned enhancements and known issues that need to be addressed in the future.

**Organization**:
- User-specified tasks are listed first (unsorted)
- AI-generated ideas are listed below, sorted by priority

---

## User-Specified Tasks

These are tasks explicitly requested by Dario and take priority over AI-generated suggestions.


### Large File Handling (CDN Migration)

**Problem**: Cloudflare Pages has a 25MB file size limit. Currently, the build process deletes files over 25MB, causing them to return 404 errors.

**Current Workaround**:
```bash
find public -type f -size +25M -delete
```

**Proposed Solution**:
- Set up a CDN (Cloudflare R2, AWS S3, or similar) for large files
- Add a Quartz transformer plugin to:
  - Detect links to large files during build
  - Upload large files to CDN
  - Rewrite links to point to CDN URLs
- Update `.gitignore` or build process to handle large files appropriately

**Benefits**:
- All content accessible (no 404s)
- Better performance for large media files
- Offload bandwidth from Cloudflare Pages


---

## AI-Generated Suggestions

These are enhancement ideas generated during documentation work. They are organized by priority.

### High Priority

#### Add Public Site Deploy Hook to GitHub Actions

**Current State**: The GitHub Actions workflow in the vault repository triggers deploys for 3 of 4 sites:
- ✅ vault.dario.ca (Full)
- ✅ notes-private.dario.ca (Trusted)
- ✅ shachu.dario.ca (Shachu)
- ❌ notes.dario.ca (Public) - **Missing**

**Fix Required**: Add a fourth step to `.github/workflows/deploy-to-pages.yaml`:

```yaml
- name: Call Cloudflare Pages deploy hook (notes.dario.ca)
  env:
    CF_PAGES_PUBLIC_HOOK_URL: ${{ secrets.CF_PAGES_PUBLIC_HOOK_URL }}
  run: |
    if [ -z "$CF_PAGES_PUBLIC_HOOK_URL" ]; then
      echo "Missing CF_PAGES_PUBLIC_HOOK_URL secret"; exit 1
    fi
    echo "Triggering notes.dario.ca build..."
    curl -sS -X POST "$CF_PAGES_PUBLIC_HOOK_URL"
```

**Also Required**:
- Add `CF_PAGES_PUBLIC_HOOK_URL` secret to vault repository settings
- Get deploy hook URL from Cloudflare Pages project for notes.dario.ca

### Medium Priority

#### Build Optimization and Caching

**Problem**: All four sites rebuild completely on every content change, even if changes only affect one tier

**Current Build Time**: ~2-5 minutes for all four sites (in parallel)

**Optimization Ideas**:
- Implement incremental builds (only rebuild changed files)
- Cache unchanged content between builds
- Smart deploy hooks (only trigger affected tiers)
- Use Cloudflare's Incremental Static Regeneration (ISR) if available

**Challenges**:
- Quartz may not support incremental builds natively
- Determining which tiers are affected by a content change requires parsing frontmatter
- Complexity vs. benefit tradeoff (current build time is acceptable)

#### Analytics Per Tier

**Goal**: Track usage and engagement separately for each tier

**Metrics to Track**:
- Page views per tier
- Most popular content at each access level
- User engagement patterns
- Traffic sources

**Implementation**:
- Configure Plausible Analytics with different site IDs per tier
- Or use a single analytics instance with custom properties for tier identification
- Set up dashboards to compare tier performance

**Use Cases**:
- Understand which content resonates at different access levels
- Validate that the tiered approach is valuable
- Identify content that should be promoted to more public tiers

#### Automated Testing

**Goal**: Catch issues before deployment

**Test Ideas**:
- **Frontmatter validation**: Check that all `publish` fields use valid values
- **Link checking**: Verify no broken internal links within each tier
- **Tier content verification**: Ensure hierarchical publishing works correctly
- **Build smoke tests**: Test that all four modes build successfully
- **Index file presence**: Verify tier-specific index files exist

**Implementation**:
- GitHub Actions workflow that runs on PRs
- Custom scripts to validate frontmatter and links
- Test builds in CI before deploying

**Benefits**:
- Catch errors before they go live
- Validate content structure
- Ensure system integrity

### Low Priority

#### Content Migration Scripts

**Goal**: Tools to help manage content visibility across tiers

**Utilities to Build**:
- **Promote script**: Automatically promote content from one tier to another
  - Example: `promote-to-public.sh "My Note.md"` adds `publish: "[[Public]]"`
- **Audit script**: List all content by tier
  - Show what's published where
  - Identify orphaned content (not published anywhere)
- **Bulk update**: Change publish field for multiple files matching criteria

**Use Cases**:
- Easily promote content as it matures
- Audit what's visible where
- Clean up frontmatter inconsistencies

### Ideas / Future Exploration

#### Per-Tier Content Transformation

**Concept**: Automatically modify content based on the tier

**Examples**:
- Redact sensitive information on lower tiers
- Replace personal names with placeholders
- Remove certain sections (e.g., "Personal Notes" callouts)
- Apply different content filters or transformations

**Challenges**:
- Complex to implement reliably
- May be better handled manually via careful content organization
- Risk of unintended information disclosure

#### Alternative Access Control

**Current**: Cloudflare Zero Trust (Google Auth)

**Alternatives to Consider**:
- Password protection for certain tiers
- Magic link authentication
- Integration with other auth providers
- Hybrid approach (some tiers public, some protected differently)

#### Content Scheduling

**Goal**: Schedule when content becomes visible on different tiers

**Example**:
- Draft written today
- Auto-publishes to Trusted tier in 1 week
- Auto-promotes to Public tier in 1 month

**Implementation**:
- Add `publish_date` frontmatter fields per tier
- Build-time filtering based on current date
- Scheduled rebuilds to make content go live

---

## Completed Tasks

*As tasks are completed, move them here with completion date*

### ✅ Orphaned Attachments Not Removed When Source Pages Are Filtered
**Completed**: 2025-10-27
**Branch**: `001-filter-orphaned-attachments`
**Spec**: [specs/001-filter-orphaned-attachments/](../specs/001-filter-orphaned-attachments/)

Implemented attachment filtering system to prevent private attachments from being accessible on lower-trust publishing tiers when their source pages are filtered out.

**Problem Solved**: Previously, all attachments (images, PDFs, videos) were copied to the output directory regardless of whether their source pages were published. This meant private attachments could be accessed via direct URL even when their containing pages were filtered - a HIGH priority security vulnerability.

**Implementation**:
- Created `AttachmentWhitelist` filter plugin ([attachmentWhitelist.ts](../quartz/plugins/filters/attachmentWhitelist.ts)) that runs AFTER PublishMode
- Scans published pages' HTML AST for attachment references (`<img>`, `<video>`, `<audio>`, `<iframe>`, `<a>` elements)
- Builds whitelist in `ctx.state.attachmentWhitelist` for cross-plugin communication
- Modified Assets emitter ([assets.ts](../quartz/plugins/emitters/assets.ts)) to check whitelist before copying
- Created utility module ([attachments.ts](../quartz/util/attachments.ts)) for extraction, validation, and filtering
- Extended BuildCtx types ([ctx.ts](../quartz/util/ctx.ts)) with AttachmentWhitelist and BuildState interfaces

**Behavior**:
- **Public tier**: Only attachments referenced by Public pages are included
- **Trusted/Shachu tiers**: Hierarchical inclusion (Public + tier-specific attachments)
- **Full tier**: All attachments from published pages
- **Orphaned attachments**: Filtered out (not referenced by any published page)

**Edge Cases Handled**:
- Symlinks resolved before copying
- Missing files logged as warnings (build continues)
- Absolute paths and external URLs skipped
- URL-encoded filenames decoded correctly
- All link formats supported (wikilinks, markdown, HTML)

**Performance**: ~1-2 seconds overhead for typical vaults (1,000 pages, 5,000 attachments), well within <2x build time requirement

**Security Benefit**: Closes critical security gap where private media files were accessible via direct URL on lower-trust tiers.

### ✅ Tiered Orphaned Link Styling
**Completed**: 2025-10-26

Implemented conditional styling for broken/orphaned links based on publish mode to prevent leaking information about private content on lower trust tiers.

**Behavior**:
- **Full tier**: Broken links are visually distinct (faded blue for `.internal.broken`, orange for `.dead-link`) to help identify missing/filtered content
- **Non-Full tiers** (Trusted, Shachu, Public): Broken links appear as plain text with no special styling, hiding the fact that content exists but is filtered out

**Implementation**:
- Added `data-publish-mode` attribute to body element in [renderPage.tsx:235-239](../quartz/components/renderPage.tsx#L235-L239)
- CSS conditional styling in [base.scss:93-116](../quartz/styles/base.scss#L93-L116) for `.internal.broken` links
- CSS conditional styling in [custom.scss:5-27](../quartz/styles/custom.scss#L5-L27) for `.dead-link` class

**Security Benefit**: Prevents users on lower-trust tiers from inferring the existence of private content by observing broken link styling.

### ✅ Hide Frontmatter Properties on Non-Full Tiers
**Completed**: 2025-10-26

Modified the `FrontmatterProperties` component to only display frontmatter metadata on the Full tier (vault.dario.ca). All other tiers (Trusted, Shachu, Public) now hide the frontmatter properties panel, keeping internal metadata private while still publishing the content itself.

**Implementation**: Added a check for `process.env.QUARTZ_PUBLISH_MODE` in [FrontmatterProperties.tsx](../quartz/components/FrontmatterProperties.tsx:320-324) that returns `null` when the mode is not "full".

### ✅ Index File Swapping System
**Completed**: 2025-10-26

Implemented IndexSwapper plugin to automatically swap tier-specific index files and hide unused variants from navigation.

### ✅ Multi-Tier Publishing System
**Completed**: 2025-09-29

Implemented PublishMode filter plugin for hierarchical content filtering across four tiers.

---

## Notes

- Update this file as new ideas emerge
- Move completed items to the "Completed Tasks" section
- Prioritize based on actual need vs. complexity
- Some "future tasks" may never be needed - that's okay!
