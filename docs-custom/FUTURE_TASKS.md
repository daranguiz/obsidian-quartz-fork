# Future Tasks & Improvements

This document tracks planned enhancements and known issues that need to be addressed in the future.

**Organization**:
- User-specified tasks are listed first (unsorted)
- AI-generated ideas are listed below, sorted by priority

---

## User-Specified Tasks

These are tasks explicitly requested by Dario and take priority over AI-generated suggestions.

### Orphaned Attachments Not Removed When Source Pages Are Filtered

**Problem**: When pages are filtered out by publish mode, their attachments (images, PDFs, etc.) are still included in the build even if no remaining pages link to them.

**Example Scenario**:
1. Page A has `publish: "[[Trusted]]"` and contains `![image](attachment.png)`
2. Page A is correctly filtered out when building Public tier
3. However, `attachment.png` is still copied to the public site
4. The attachment is accessible directly via URL even though no published page links to it

**Security Impact**:
- **HIGH** - Private attachments may be exposed on public tiers
- Attachments from filtered pages remain accessible if someone knows/guesses the URL
- This defeats the purpose of the tiered publishing system for media files

**Current Behavior**:
- Filter plugins (PublishMode, IndexSwapper) only filter markdown files
- Emitter plugins copy ALL assets from the content folder
- No mechanism to track which attachments are actually referenced by published pages

**Desired Behavior**:
- Only include attachments that are referenced by at least one published page
- If all pages linking to an attachment are filtered out, the attachment should not be emitted
- Track references during the transformer phase and filter during emit phase

**Proposed Solution**:
1. **Option A - Filter Plugin for Attachments**:
   - Create a new filter plugin that runs after PublishMode
   - Parse all published markdown files for attachment references
   - Build a whitelist of referenced attachments
   - Filter out unreferenced attachments during emit

2. **Option B - Custom Emitter Plugin**:
   - Modify or wrap the Assets emitter plugin
   - Before copying assets, scan all published pages for references
   - Only emit assets that are actually linked from published content

3. **Option C - Post-Build Cleanup**:
   - After build completes, scan HTML files for asset references
   - Delete any assets in `public/` that aren't referenced
   - Simpler but happens after the fact

**Implementation Considerations**:
- Need to handle various attachment types: images, PDFs, videos, audio
- Need to parse multiple markdown link formats: `![[file]]`, `![](file)`, `[link](file)`
- Need to handle attachments in subdirectories
- Consider Obsidian attachment folder structure
- Performance: scanning all files could be slow for large vaults

**Files to Investigate**:
- `quartz/plugins/emitters/assets.ts` - How assets are currently emitted
- `quartz/plugins/filters/*.ts` - Pattern for filtering
- `quartz/plugins/transformers/*.ts` - Where link parsing happens

**Priority**: HIGH - This is a security issue that could expose private content

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
