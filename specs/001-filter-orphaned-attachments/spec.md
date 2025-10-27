# Feature Specification: Filter Orphaned Attachments

**Feature Branch**: `001-filter-orphaned-attachments`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "Orphaned Attachments Not Removed When Source Pages Are Filtered"

## Clarifications

### Session 2025-10-27

- Q: What should the build system do when a published page references an attachment file that doesn't exist in the content folder? → A: Skip the missing attachment, log a warning, continue build
- Q: Should the build system follow symbolic links to include the actual file they point to, or skip symbolic links? → A: Resolve and follow symlinks to the actual file
- Q: What should the build system do when it encounters an absolute path reference to an attachment? → A: Skip absolute path references with warning log

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prevent Private Attachment Exposure (Priority: P1)

As a vault owner with sensitive attachments, I need the build system to automatically exclude attachments from filtered pages so that private images, PDFs, and other media files don't become publicly accessible when their source pages are filtered out.

**Why this priority**: This is a critical security issue (HIGH priority in FUTURE_TASKS.md). Currently, private attachments can be accessed via direct URL even when their containing pages are filtered, defeating the purpose of the tiered publishing system.

**Independent Test**: Can be fully tested by creating a test page with `publish: "[[Trusted]]"` containing an image, building the Public tier, and verifying the image is not accessible in the Public build output.

**Acceptance Scenarios**:

1. **Given** a page with `publish: "[[Trusted]]"` contains an image reference `![Private Image](private.png)`, **When** building the Public tier, **Then** `private.png` should not be copied to the public output directory
2. **Given** two pages reference the same attachment and one page is filtered out, **When** building any tier, **Then** the attachment should be included because at least one published page still references it
3. **Given** a page with `publish: "[[Public]]"` contains an image reference, **When** building any tier (Full, Trusted, Shachu, Public), **Then** the image should be included in all tier builds (hierarchical inheritance)
4. **Given** an attachment file exists in the content folder but no published page references it, **When** building any tier, **Then** the attachment should not be included in the output

---

### User Story 2 - Support Multiple Link Formats (Priority: P2)

As a vault owner who uses various markdown linking conventions, I need the system to recognize and track attachment references in all common markdown link formats so that attachments are filtered correctly regardless of how they're referenced.

**Why this priority**: Obsidian supports multiple link syntaxes (`![[file]]`, `![](file)`, `[link](file)`), and the system must handle all of them to prevent false positives (included attachments that should be filtered) or false negatives (filtered attachments that should be included).

**Independent Test**: Can be tested by creating pages with different link formats (wikilinks, markdown links, with/without image syntax) and verifying all referenced attachments are included while unreferenced ones are excluded.

**Acceptance Scenarios**:

1. **Given** a published page contains `![[attachment.pdf]]` (Obsidian wikilink), **When** building the site, **Then** `attachment.pdf` should be included
2. **Given** a published page contains `![Image](./images/photo.jpg)` (markdown image link), **When** building the site, **Then** `photo.jpg` should be included
3. **Given** a published page contains `[Download PDF](../files/document.pdf)` (markdown link), **When** building the site, **Then** `document.pdf` should be included
4. **Given** a published page contains multiple references to the same attachment using different formats, **When** building the site, **Then** the attachment should be included once (deduplication)

---

### User Story 3 - Handle Complex Attachment Scenarios (Priority: P3)

As a vault owner with organized media files, I need the system to correctly handle attachments in subdirectories, multiple file types, and shared attachments so that the filtering logic works correctly across all organizational structures.

**Why this priority**: Real vaults have complex structures with attachments in various folders, multiple pages sharing attachments, and diverse file types. The system must handle these real-world scenarios correctly.

**Independent Test**: Can be tested by setting up a vault with attachments in subdirectories (e.g., `images/`, `files/`, `media/`), shared attachments referenced by multiple pages at different publish levels, and various file types (PNG, JPG, PDF, MP4, etc.).

**Acceptance Scenarios**:

1. **Given** attachments are organized in subdirectories like `content/images/`, `content/files/`, **When** a published page references them with relative paths, **Then** the directory structure should be preserved in the output
2. **Given** an attachment is referenced by 3 pages: one Public, one Trusted, one Full-only, **When** building the Trusted tier, **Then** the attachment should be included (at least one published page references it)
3. **Given** the same attachment scenario, **When** building the Public tier, **Then** the attachment should be included (the Public page still references it)
4. **Given** various file types (images: PNG, JPG, GIF; documents: PDF, DOCX; media: MP4, MP3), **When** filtering attachments, **Then** all file types should be handled correctly based on references

---

### Edge Cases

- What happens when an attachment path contains spaces, special characters, or non-ASCII characters?
- What happens when an attachment is referenced with an absolute path vs. relative path? → The system skips absolute path references and logs a warning; only relative paths are supported for portability
- What happens when an attachment is referenced but the file doesn't actually exist in the content folder? → The system skips the missing attachment, logs a warning message, and continues the build successfully
- What happens when a page references the same attachment multiple times?
- What happens when attachment filenames have URL-encoded characters (e.g., `%20` for space)?
- How does the system handle symbolic links or shortcuts to attachment files? → The system resolves and follows symbolic links to include the actual file they point to
- What happens when building large vaults (10,000+ pages, 5,000+ attachments) - performance implications?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scan all published pages to identify attachment references before emitting assets
- **FR-002**: System MUST recognize attachment references in Obsidian wikilink format: `![[filename]]` and `[[filename]]`
- **FR-003**: System MUST recognize attachment references in markdown image format: `![alt](path/to/file)`
- **FR-004**: System MUST recognize attachment references in markdown link format: `[text](path/to/file)`
- **FR-005**: System MUST maintain a whitelist of referenced attachments during the build process
- **FR-006**: System MUST exclude attachments from the output if they are not referenced by any published page
- **FR-007**: System MUST include attachments in the output if they are referenced by at least one published page
- **FR-008**: System MUST handle attachments in subdirectories and preserve directory structure in output
- **FR-009**: System MUST support all common attachment file types (images: PNG, JPG, GIF, SVG; documents: PDF, DOCX, TXT; media: MP4, MP3, WAV; archives: ZIP)
- **FR-010**: System MUST handle relative paths (e.g., `../images/file.png`) and normalize them correctly
- **FR-011**: System MUST apply hierarchical inheritance rules: attachments referenced by Public pages appear in all tiers
- **FR-012**: System MUST deduplicate attachment references (same attachment referenced multiple times should only be tracked once)
- **FR-013**: System MUST handle URL-encoded filenames and decode them correctly for matching
- **FR-014**: System MUST log filtering decisions at appropriate verbosity level for debugging
- **FR-015**: System MUST integrate with existing Quartz plugin architecture (filter or emitter plugin)
- **FR-016**: System MUST skip missing attachment files (referenced but not found in content folder), log a warning, and continue build without failure
- **FR-017**: System MUST resolve and follow symbolic links to include the actual file content they point to
- **FR-018**: System MUST skip absolute path references to attachments and log a warning; only relative paths are supported for portability

### Key Entities

- **Published Page**: A markdown file that passed all filter plugins (RemoveDrafts, IndexSwapper, PublishMode) and is being included in the current build
- **Attachment Reference**: A link or embed in markdown content pointing to a non-markdown file (image, PDF, video, etc.)
- **Attachment Whitelist**: A collection of attachment file paths that are referenced by at least one published page for the current build tier
- **Filtered Attachment**: An attachment file that exists in the content folder but is not referenced by any published page in the current tier

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Private attachments are never accessible via direct URL on public tiers (0% exposure rate)
- **SC-002**: All attachments referenced by published pages are included in the build (100% inclusion rate)
- **SC-003**: Attachments not referenced by any published page are excluded from the build (100% exclusion rate)
- **SC-004**: Build process completes successfully with attachment filtering in under 2x the time of current builds (performance acceptable for typical vaults)
- **SC-005**: All common markdown link formats are correctly parsed and tracked (tested across at least 4 different formats)
- **SC-006**: Hierarchical inheritance works correctly: Public attachments appear in all tiers, Trusted attachments in Full+Trusted, etc. (100% hierarchy compliance)
- **SC-007**: Build logs clearly indicate how many attachments were filtered vs. included for audit purposes
- **SC-008**: Zero false positives (needed attachments excluded) or false negatives (unneeded attachments included) in test scenarios

### Assumptions

- The build system has access to the list of published pages before asset emission
- Attachment references in markdown are static (not generated dynamically by client-side JavaScript)
- Obsidian attachment folder structure is preserved in the content repository
- Large files (>25MB) are already handled by existing deletion logic and don't need special treatment here
- The existing Quartz plugin architecture supports the required hooks for attachment filtering
