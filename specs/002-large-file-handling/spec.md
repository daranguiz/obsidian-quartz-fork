# Feature Specification: Large File Handling via CDN

**Feature Branch**: `002-large-file-handling`
**Created**: 2025-10-29
**Status**: Draft
**Input**: User description: "Let's work on the Large File Handling problem"

## Clarifications

### Session 2025-10-29

- Q: CDN upload retry behavior - how many retries and what delay strategy? → A: Exponential backoff with 3 retries (1s, 2s, 4s delays)
- Q: Concurrent build handling - how to handle multiple builds uploading the same large file simultaneously? → A: Last write wins with file hash verification - concurrent builds allowed, idempotent uploads
- Q: CDN file retention policy - immediate or delayed deletion for orphaned files? → A: Immediate deletion on orphan detection - clean and cost-effective
- Q: Build performance scalability target - how should performance scale with large file count? → A: Linear scaling up to 50 large files, parallel uploads maintain 30% limit beyond that

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Large Files Without 404 Errors (Priority: P1)

When an authorized user visits a published note containing links to large files (over 20MB), they should be able to click on those links and successfully download or view the files instead of encountering 404 errors.

**Why this priority**: This is the core problem - users currently cannot access large files at all. Solving this eliminates a critical gap in content accessibility and is the minimum viable solution.

**Independent Test**: Can be fully tested by creating a note with a link to a large file (>20MB), publishing it, and verifying an authorized user can click the link and successfully download the file. Delivers immediate value by making previously inaccessible content available.

**Acceptance Scenarios**:

1. **Given** a note contains a link to a file over 20MB in the vault, **When** the note is built and published, **Then** the large file is accessible via a working CDN URL for authorized users
2. **Given** an authorized user clicks a link to a large file on the published site, **When** the request is made, **Then** the file downloads successfully without 404 errors
3. **Given** multiple large files with the same name exist in different folders, **When** the build process runs, **Then** all large files are uploaded to the CDN without collisions (full paths preserved)

---

### User Story 2 - Automatic Link Rewriting for Seamless Experience (Priority: P3)

Content creators should be able to link to large files using normal markdown syntax without worrying about file sizes, and the system should automatically handle uploading to CDN and rewriting links during the build process.

**Why this priority**: This provides a seamless authoring experience. Content creators don't need to manually manage which files go where - the system handles it automatically. While important for user experience, it builds on the core P1 functionality and is less critical than the P2 security requirement.

**Independent Test**: Can be tested by creating a note with standard markdown links to various file sizes, building the site, and verifying that large file links are automatically rewritten to absolute CDN URLs while small file links remain unchanged. Delivers convenience and reduces manual work.

**Acceptance Scenarios**:

1. **Given** a note with markdown links to files of various sizes, **When** the build process runs, **Then** only links to files over 20MB are rewritten to point to the CDN as absolute URLs
2. **Given** a file is exactly 20MB, **When** the build determines file handling, **Then** the file is treated as a regular file (not uploaded to CDN)
3. **Given** a large file is referenced in multiple notes, **When** the build process runs, **Then** the file is uploaded once (verified by hash) and all references point to the same CDN URL
4. **Given** a file grows from 15MB to 25MB between builds, **When** the next build runs, **Then** the file is automatically detected, uploaded to CDN, and its links are rewritten

---

### User Story 3 - Zero Trust Access Control for CDN Files (Priority: P2)

When building for different publish modes (full, trusted, shachu, public), large files uploaded to the CDN MUST enforce the same Cloudflare Zero Trust access controls as the notes they're linked from. A user who cannot access a restricted note should not be able to access its large file attachments by guessing or finding the CDN URL.

**Why this priority**: This is a critical security requirement, not an optional enhancement. Without proper access control, large files would create a security hole where restricted content could be accessed by unauthorized users. This must be solved before the feature can be used in production.

**Independent Test**: Can be tested by creating a large file in a trusted-only note, building for trusted mode, then attempting to access the CDN file URL both as an authenticated trusted user (should succeed) and as an unauthenticated user or public-tier-only user (should be denied by Cloudflare Zero Trust). Delivers security compliance and prevents data leakage.

**Acceptance Scenarios**:

1. **Given** a large file is linked from a note marked as `[[Trusted]]`, **When** an unauthenticated user tries to access the CDN URL directly, **Then** Cloudflare Zero Trust blocks access and requires Google authentication
2. **Given** a large file is linked from a note marked as `[[Trusted]]`, **When** a user authenticated for the public tier tries to access the CDN URL, **Then** Cloudflare Zero Trust denies access
3. **Given** a large file is linked from a note marked as `[[Trusted]]`, **When** a user authenticated for the trusted tier accesses the CDN URL, **Then** the file downloads successfully
4. **Given** a large file is linked from a `[[Public]]` note, **When** any user (authenticated or not) accesses the CDN URL, **Then** the file downloads without authentication
5. **Given** the same large file is referenced in both a `[[Public]]` note and a `[[Trusted]]` note, **When** building for public mode, **Then** the file is publicly accessible (inherits the most permissive access level from published notes)

---

### Edge Cases

**File Handling** (Resolved):
- ✅ **20MB cutoff chosen** to provide buffer below Cloudflare's 25MB limit
- ✅ **Files growing beyond 20MB**: Links rewritten and uploaded to CDN automatically on next build
- ✅ **Orphaned large files**: If a large file is deleted from vault and has no more references, it must be removed from CDN
- ✅ **Duplicate filenames in different folders**: Treated as different files, paths preserved to prevent collisions
- ✅ **CDN upload failure**: Build fails with clear error, retry mechanism implemented
- ✅ **Excluded directories**: Only process files from static site generator output, automatically excludes `.git`, `node_modules`, etc.
- ✅ **Relative vs absolute paths**: CDN URLs will be absolute; system must handle both relative and absolute source links correctly
- ✅ **Various file formats**: PDFs, archives, and all other file types supported (not just images/videos)

**Access Control & Security** (Resolved):
- ✅ **Publish mode changes**: Access controls updated to reflect current publish mode on each build - no stale access
- ✅ **Multiple notes with different access levels**: File accessible from permitted trust levels, blocked from unpermitted levels - enforce based on all references
- ✅ **Direct CDN URL sharing**: CRITICAL REQUIREMENT - CDN URLs MUST be protected by Cloudflare Zero Trust even when accessed directly
- ✅ **Session expiration**: When Cloudflare Zero Trust session expires, CDN access stops working immediately
- ✅ **Zero Trust config changes**: New policy takes effect immediately, allowing/denying users per updated policy
- ✅ **URL guessing/enumeration**: URLs can be human-readable and guessable AS LONG AS Cloudflare Zero Trust protects all access
- ✅ **Cross-tier access**: Handled by maintaining access level per file based on all published references
- ✅ **Same file, different build modes**: Access controlled per build mode based on which notes reference it in that mode

**Concurrency & Scale** (Resolved):
- ✅ **Concurrent builds**: Multiple builds for different publish modes can run simultaneously; last write wins with file hash verification ensures idempotent uploads

## Requirements *(mandatory)*

### Functional Requirements

**Core File Handling**:
- **FR-001**: System MUST detect all files over 20MB during the build process (20MB cutoff provides buffer below Cloudflare's 25MB limit)
- **FR-002**: System MUST upload detected large files (>20MB) to a CDN storage service
- **FR-003**: System MUST rewrite markdown links to large files to point to absolute CDN URLs
- **FR-004**: System MUST preserve the original file names and folder structure in CDN URLs to prevent filename collisions across different directories
- **FR-005**: System MUST handle various file types (images, videos, PDFs, archives, etc.) without format restrictions
- **FR-006**: System MUST avoid uploading the same large file multiple times if referenced in multiple notes (use file hash/checksum for detection)
- **FR-007**: System MUST only upload large files that are linked from notes being published in the current build mode
- **FR-008**: System MUST treat files at or under 20MB as regular files (not subject to CDN upload)
- **FR-009**: System MUST leave small files (≤20MB) unchanged in the build output
- **FR-010**: System MUST provide build logs indicating which files were uploaded to CDN and their assigned access level
- **FR-011**: System MUST fail the build if CDN upload fails after exponential backoff retry (3 attempts with 1s, 2s, 4s delays), with clear error message indicating which file failed and after how many attempts
- **FR-012**: System MUST use CDN credentials from environment variables or configuration
- **FR-013**: System MUST generate stable, consistent CDN URLs for the same file across builds to avoid broken links
- **FR-014**: System MUST handle files in subdirectories and preserve full path context in CDN URLs to support duplicate filenames in different folders
- **FR-015**: System MUST only process files from static site generator output, automatically excluding system directories (`.git`, `node_modules`, etc.)
- **FR-016**: System MUST immediately remove orphaned large files from CDN when they are deleted from vault and have no remaining references in published notes (no grace period)
- **FR-017**: System MUST handle both relative and absolute link formats in source markdown when detecting file references
- **FR-018**: System MUST detect when files grow from under 20MB to over 20MB and automatically migrate them to CDN on next build
- **FR-019**: System MUST support concurrent builds for different publish modes, using file hash verification to ensure idempotent uploads (last write wins for identical content)

**Access Control & Security**:
- **FR-020**: System MUST integrate with Cloudflare Zero Trust to enforce access controls on ALL CDN file requests, including direct URL access
- **FR-021**: System MUST configure CDN to route ALL requests through Cloudflare Zero Trust for authentication/authorization
- **FR-022**: System MUST ensure that large files from `[[Trusted]]` notes require Google authentication via Cloudflare Zero Trust
- **FR-023**: System MUST ensure that large files from `[[Shachu]]` notes require Cloudflare Zero Trust authentication for shachu members
- **FR-024**: System MUST ensure that large files from `[[Public]]` notes are accessible without authentication
- **FR-025**: System MUST ensure that large files from Full-tier notes (no publish field) require the most restrictive Cloudflare Zero Trust authentication
- **FR-026**: System MUST handle files referenced in multiple notes by applying the least restrictive access level among the linking notes that are published in the current build mode
- **FR-027**: System MUST prevent unauthorized access to large files even when CDN URLs are shared directly, guessed, or enumerated
- **FR-028**: System MUST ensure CDN access stops working immediately when a user's Cloudflare Zero Trust session expires
- **FR-029**: System MUST update CDN access controls on every build to reflect current publish modes - no stale access permissions
- **FR-030**: System MUST respect changes to Cloudflare Zero Trust policies immediately (new users allowed, old users denied per updated policy)
- **FR-031**: CDN URLs MAY be human-readable and predictable, but System MUST ensure Cloudflare Zero Trust protects every access attempt

### Key Entities

- **Large File**: Any file in the vault over 20MB that is linked from a published note
  - Attributes: original path, file size, content type, CDN URL, hash/checksum for duplicate detection, required access level, reference count
  - Relationships: Referenced by one or more notes, stored in CDN with Cloudflare Zero Trust access controls
  - Security: Access level determined by the most permissive publish mode among linking notes in current build
  - Lifecycle: Automatically migrated to CDN when crossing 20MB threshold; removed from CDN when orphaned (no references)

- **CDN Mapping**: A record of which local files map to which CDN URLs
  - Attributes: local file path (with full directory structure), CDN URL, file hash, upload timestamp, access level, Cloudflare Zero Trust configuration reference
  - Purpose: Prevent duplicate uploads, ensure consistent URLs across builds, track access control configuration, support orphan detection
  - Security: Links files to their Cloudflare Zero Trust policies; updated on every build to reflect current publish modes
  - Note: Multiple files with same name in different directories have distinct mappings

- **File Reference**: A link from a note to a large file
  - Attributes: source note, target file path (absolute or relative), link type (markdown, wikilink), source note's publish mode
  - Relationships: Links a note to a large file, determines whether file should be uploaded and what access controls to apply based on note's publish mode
  - Security: Carries publish mode information to determine file access requirements
  - Purpose: Used to track which files are still referenced (orphan detection) and calculate required access level

- **Access Level**: The authentication requirement for a large file
  - Values: Full (most restrictive), Trusted, Shachu, Public (no restriction)
  - Hierarchy: Public > Shachu > Trusted > Full (for multi-reference resolution)
  - Purpose: Determines which Cloudflare Zero Trust policy to apply to the CDN file
  - Behavior: All CDN requests routed through Cloudflare Zero Trust; respects session expiration; immediately reflects policy changes

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Accessibility & Functionality**:
- **SC-001**: Authorized users can successfully access 100% of large files (>20MB) linked from published notes without encountering 404 errors
- **SC-002**: Build process completes successfully with large files uploaded to CDN within a reasonable time increase (no more than 30% longer than current builds, with linear scaling up to 50 large files and parallel uploads maintaining this limit beyond 50 files)
- **SC-003**: Large file links are automatically rewritten to absolute CDN URLs without manual intervention by content creators
- **SC-004**: Files at or under 20MB continue to be served normally through Cloudflare Pages without changes to their URLs
- **SC-005**: The same large file referenced multiple times is uploaded to CDN only once (verified by file hash), reducing storage costs and upload time
- **SC-006**: Build logs clearly indicate which files were uploaded to CDN, their assigned access level, and any files removed due to being orphaned
- **SC-007**: CDN URLs for the same file remain stable across multiple builds, preventing broken links after rebuilds
- **SC-008**: Files with duplicate names in different folders are correctly preserved without collisions (full path maintained in CDN)
- **SC-009**: When a file grows from under 20MB to over 20MB, it is automatically detected and migrated to CDN on the next build
- **SC-010**: Orphaned large files (deleted or no longer referenced) are immediately removed from CDN during build to avoid unnecessary storage costs
- **SC-011**: Build fails cleanly with actionable error message if CDN upload fails after 3 retry attempts (exponential backoff: 1s, 2s, 4s), indicating which file failed and total attempts made

**Security & Access Control**:
- **SC-012**: 100% of unauthorized access attempts to restricted large files are blocked by Cloudflare Zero Trust, even for direct CDN URL access
- **SC-013**: Users authenticated for a lower tier cannot access large files from higher tiers, even when CDN URLs are shared directly or guessed
- **SC-014**: Large files from public notes are accessible without authentication 100% of the time
- **SC-015**: Large files from trusted notes require successful Google authentication via Cloudflare Zero Trust before download, enforced at CDN level
- **SC-016**: Unauthorized users attempting to access restricted CDN files are redirected to Cloudflare Zero Trust authentication page, never served the file
- **SC-017**: No security holes exist where restricted content can be accessed by URL guessing, enumeration, or direct CDN URL sharing
- **SC-018**: When a user's Cloudflare Zero Trust session expires, CDN access stops working immediately (no cached access)
- **SC-019**: Changes to Cloudflare Zero Trust policies take effect immediately for CDN file access (new users allowed, old users denied per policy)
- **SC-020**: Access controls are updated on every build - if a note's publish mode changes, the large file's access level reflects the change on next build
- **SC-021**: All CDN requests route through Cloudflare Zero Trust for authentication/authorization, regardless of how the URL was obtained
