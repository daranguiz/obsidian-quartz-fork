# Future Tasks & Improvements

This document tracks planned enhancements and known issues that need to be addressed in the future.

**Organization**:
- User-specified tasks are listed first (unsorted)
- AI-generated ideas are listed below, sorted by priority

---

## User-Specified Tasks

These are tasks explicitly requested by Dario and take priority over AI-generated suggestions.

### Fix build times 

4x builds, 4x clones, that's all bad. 

### MOC-Based Navigation View

**Goal**: Add an alternative navigation view in the Explorer sidebar that shows all MOC (Map of Content) files instead of the folder tree.

**Context**: The vault is organized around MOCs - main "topic" files that everything links to. A navigation view that surfaces these MOCs would make it easier to navigate by conceptual topic rather than folder structure.

**Possible Approaches**:

1. **Tab/Toggle in Explorer**:
   - Add view switcher to Explorer component
   - "Folder View" (current tree structure)
   - "MOC View" (flat list of MOC files)
   - User can toggle between views

2. **Separate Component**:
   - Create dedicated MOC navigation component
   - Lives in sidebar separately from Explorer
   - Shows list of files with `note_type: "[[MOC]]"` frontmatter

3. **Smart Detection**:
   - Automatically detect MOCs by analyzing backlinks
   - Files with high incoming link counts are likely MOCs
   - Dynamic view based on graph structure

**Implementation Considerations**:
- How to identify MOCs? (frontmatter field vs. backlink count vs. manual tag)
- Should MOCs be grouped/categorized? (by topic, by tag, flat list)
- Should MOC view show hierarchy? (MOCs linking to other MOCs)
- Does this work across all tiers or only Full?

**User Story**: As a vault browser, I want to navigate by conceptual topics (MOCs) rather than folder structure, so I can explore content organized around ideas rather than files.

**Priority**: P2 - Nice to have, explore after core navigation improvements are stable

### Posthumous Vault Access Expansion

**Goal**: When Dario passes away, significantly expand access to the vault (Level 0 - Full) tier to a larger group of people.

**Current State**:
- Level 0 - Full (vault.dario.ca) is highly restricted via Cloudflare Zero Trust
- Access is limited to Dario's personal Google account
- Other tiers have wider but still controlled access

**Challenges**:
- How to trigger the access expansion (automatic vs. manual by executor)
- How to define "significantly larger group" (friends, family, tea community, etc.)
- How to manage the transition (immediate vs. gradual)
- How to preserve privacy while honoring the desire to share knowledge

**Possible Approaches**:

1. **Dead Man's Switch + Pre-configured Access List**:
   - Set up a dead man's switch service (requires periodic check-ins)
   - Pre-configure Cloudflare Zero Trust with a larger email list (disabled)
   - Switch automatically enables the expanded access list
   - Pros: Automatic, no executor action needed
   - Cons: Risk of false triggers, requires maintenance

2. **Executor-Triggered with Documentation**:
   - Document clear instructions for executor/trusted person
   - Provide pre-written Cloudflare access policy with expanded list
   - Executor manually updates access policy when the time comes
   - Pros: Human oversight, no false triggers
   - Cons: Requires trusted executor with technical ability

3. **Tiered Transition Approach**:
   - Phase 1: Promote all Level 0 content to Level 1 (Trusted)
   - Phase 2: Expand Level 1 access list to larger group
   - Phase 3: Eventually make some/all content Level 3 (Public)
   - Pros: Gradual, allows for selective sharing
   - Cons: More complex to execute

4. **Archive + Public Donation**:
   - Export full vault content
   - Donate to Internet Archive, university library, or tea organization
   - Make publicly accessible as a knowledge resource
   - Pros: Permanent preservation, widest access
   - Cons: Loss of access control, privacy concerns

**Questions to Consider**:
- Who should have access? (List of names/emails, or criteria like "tea community members")
- Should any content remain private even posthumously?
- Should there be a waiting period before expansion?
- What about content that mentions other living people?
- Should the vault be read-only or allow community contributions?

**Priority**: LOW (but important to document and plan)


### Migrate Dataview usage to native Obsidian Bases 

I use Dataview queries heavily in my vault, both using the Dataview query syntax as well as dataviewjs. Obsidian has a new Core Plugin called Bases that handles most of my dataview uses, except natively and much faster than dataview. 

Bases is still under development, so I'm not sure I want to make sweeping changes yet. But I'm definitely interested in migrating everything over to Bases at some point.

---

## AI-Generated Suggestions

These are enhancement ideas generated during documentation work. They are organized by priority.

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

---

## Completed Tasks

*As tasks are completed, move them here with completion date*

### ✅ Inline Tag Display
**Completed**: 2025-11-02
**Feature**: 005-inline-tag-display

**Problem Solved**: Tags were not rendering correctly in content - they appeared as non-clickable plain text without the # symbol. Additionally, tags appeared in a duplicate section at the top of each page, which was undesired.

**Solution**:
- Fixed dead link detection bug in `contentPage.tsx` that was converting tag links from `<a>` to `<span>` elements
- Tag page URLs aren't in `allSlugs` because they're generated dynamically by TagPage emitter
- Added check to skip dead link conversion for elements with `tag-link` class
- Removed `Component.TagList()` from page layout to eliminate top-of-page tags section
- Tags now appear inline at their exact markdown position styled as regular links with # symbol visible
- All tag navigation and indexing functionality preserved

**Implementation**:
- Bug fix: [contentPage.tsx](../quartz/plugins/emitters/contentPage.tsx) lines 56-65
- Layout change: [quartz.layout.ts](../quartz.layout.ts) line 35 (TagList removed from beforeBody)
- CSS unchanged: [base.scss](../quartz/styles/base.scss) lines 123-127 already correct

**Reference**: https://trusted.dario.ca/Tea-Resources/紙片-(Shihen)/Number-of-sweets-for-higher-temae (example page)

### ✅ Large File Handling (CDN Migration)
**Completed**: 2025-10-31

Implemented comprehensive CDN handling for files over 20MB to bypass Cloudflare Pages' 25MB file size limit.

**Problem Solved**: Large files (>25MB) were deleted during build, causing 404 errors. No proper CDN integration existed.

**Solution**:
- Created Cloudflare R2 CDN infrastructure with 4 buckets (one per tier)
- Implemented `LargeFileDetector` transformer plugin to detect files >20MB during build
- Implemented `CDNUploader` emitter plugin to upload files to appropriate R2 bucket
- Files automatically uploaded to correct tier-specific CDN:
  - `vault-files-full` → `cdn-full.dario.ca`
  - `vault-files-trusted` → `cdn-trusted.dario.ca`
  - `vault-files-shachu` → `cdn-shachu.dario.ca`
  - `vault-files-public` → `cdn-public.dario.ca`
- SHA-256 file hashing for deduplication and idempotent uploads
- Exponential backoff retry (3 attempts: 1s, 2s, 4s delays)
- Parallel uploads for >50 files (batches of 10 concurrent uploads)
- Automatic orphan detection and cleanup
- File growth detection (15MB file growing to 25MB automatically migrated)

**Security Integration**:
- Each CDN domain protected by Cloudflare Zero Trust Access policies
- Access levels map to existing tier hierarchy
- Multi-reference files uploaded to least restrictive tier
- Direct URL access blocked by Zero Trust for restricted tiers

**Implementation**:
- Transformer plugin: [largefile.ts](../quartz/plugins/transformers/largefile.ts)
- Emitter plugin: [cdnUploader.ts](../quartz/plugins/emitters/cdnUploader.ts)
- Utilities: [cdn.ts](../quartz/util/cdn.ts), [hash.ts](../quartz/util/hash.ts)
- Type definitions: [cfg.ts](../quartz/cfg.ts) - Added R2Configuration interface
- Registered in [quartz.config.ts](../quartz.config.ts)
- Infrastructure setup guide: [specs/002-large-file-handling/quickstart.md](../specs/002-large-file-handling/quickstart.md)

**Performance**: Build time increase <30% with linear scaling to 50 files, parallel uploads beyond 50.

**Benefits**:
- All content accessible (no 404s for large files)
- Better performance for large media files
- Offloaded bandwidth from Cloudflare Pages to R2 CDN
- Maintains tier-based security model
- Automatic cleanup prevents CDN bloat

### ✅ Orphaned Attachment Filtering
**Completed**: 2025-10-28

Implemented comprehensive orphaned attachment filtering to prevent private attachments from being exposed on lower-trust tiers.

**Problem Solved**: When pages were filtered out by publish mode, their attachments (images, PDFs, etc.) were still included in the build and accessible via direct URL, defeating the purpose of tiered publishing for media files.

**Solution**:
- Created `AttachmentWhitelist` filter plugin that scans all published pages and builds a whitelist of referenced attachments
- Modified `Assets` emitter to check attachments against the whitelist before copying
- Only attachments referenced by published pages are included in the build
- Handles multiple link formats: `![[file]]`, `![](file)`, `[link](file)`
- Handles path normalization issues (relative paths, basenames, slugification)

**Implementation**:
- New filter plugin: [attachmentWhitelist.ts](../quartz/plugins/filters/attachmentWhitelist.ts)
- Utility functions: [attachments.ts](../quartz/util/attachments.ts)
- Modified emitter: [assets.ts](../quartz/plugins/emitters/assets.ts)
- Registered in [quartz.config.ts](../quartz.config.ts) after PublishMode filter

**Validation**: Tested with 20+ attachments across different tiers. Successfully filters 277 orphaned attachments while copying 89 referenced ones in Shachu build.

**Security Benefit**: Prevents exposure of private attachments (like Gyo no Shin PDFs, teaching log images, etc.) on lower-trust tiers where the source pages are filtered out.

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

#### Add Public Site Deploy Hook to GitHub Actions
**Completed**: 2025-10-31


### Dead link styling

The current styling is a little loud. What if I keep the orange, but remove the background grey highlight? Maybe change the orange to be a little darker, more of a burnt orange?

### Fix link + bold styling 

Links don't correctly inherit the font weight from bold styling in dark theme. (They do in light theme).

---

## Notes

- Update this file as new ideas emerge
- Move completed items to the "Completed Tasks" section
- Prioritize based on actual need vs. complexity
- Some "future tasks" may never be needed - that's okay!
