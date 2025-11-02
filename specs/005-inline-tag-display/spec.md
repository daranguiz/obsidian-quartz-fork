# Feature Specification: Inline Tag Display

**Feature Branch**: `005-inline-tag-display`
**Created**: 2025-11-02
**Status**: Draft
**Input**: User description: "### Tags show up weirdly\n\nhttps://trusted.dario.ca/Tea-Resources/紙片-(Shihen)/Number-of-sweets-for-higher-temae\n\n- I want tags to stop appearing at the top of the page\n- Instead, I want that tag as shown currently on top of the tag (clickable link, pill styling) to appear in the text itself where I put it. It should still show the #."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Tags in Context (Priority: P1)

As a reader navigating the published site, I want to see tags displayed inline within the content where they naturally appear in the markdown source, so that the context of each tag is immediately clear and the reading flow is not interrupted by a separate tags section at the top of the page.

**Why this priority**: This is the core functionality that addresses the current usability issue. Without this, tags appear out of context at the top of pages, disrupting the reading experience and removing semantic meaning from where tags were intentionally placed in the content.

**Independent Test**: Can be fully tested by viewing any page with inline tags in the markdown source and verifying that tags appear where they were written in the content with proper styling, delivering immediate value by preserving authorial intent for tag placement.

**Acceptance Scenarios**:

1. **Given** a markdown file with a tag like `#tea/ceremony` written inline within a paragraph, **When** the page is rendered, **Then** the tag appears at that exact location in the content styled as a regular link with the # symbol visible
2. **Given** a page with multiple inline tags at different locations, **When** the page is rendered, **Then** each tag appears at its original location in the content flow styled as regular links
3. **Given** a tag is clicked, **When** the user interacts with it, **Then** they are navigated to the tag's listing page showing all content with that tag

---

### User Story 2 - Remove Top-of-Page Tags Section (Priority: P1)

As a reader, I don't want to see a separate tags section at the top of pages, so that the page layout is cleaner and tags only appear where the author intended them to be contextually relevant.

**Why this priority**: This is equally critical as it addresses the "remove" part of the requirement. Keeping the top section would result in duplicate tags and maintain the current confusing experience.

**Independent Test**: Can be fully tested by viewing any page that previously showed tags at the top and verifying that no tags section appears in the header area, delivering value by simplifying page layout.

**Acceptance Scenarios**:

1. **Given** a markdown file with tags in frontmatter and/or inline content, **When** the page is rendered, **Then** no tags section appears at the top of the page
2. **Given** a page layout that previously included a tags component, **When** the component is removed, **Then** the page header shows only the title and other metadata without a tags section
3. **Given** multiple pages across different publish modes, **When** rendered, **Then** none show a top-of-page tags section

---

### User Story 3 - Maintain Tag Functionality (Priority: P2)

As a reader, I want inline tags to retain all their existing functionality (clickability, navigation, styling), so that I can still explore related content through the tag system while benefiting from the improved inline display.

**Why this priority**: Important for maintaining system functionality, but secondary to getting the basic display right. The tag linking system is valuable for site navigation.

**Independent Test**: Can be fully tested by clicking inline tags and verifying navigation to tag pages works correctly, delivering value by maintaining the knowledge graph navigation capability.

**Acceptance Scenarios**:

1. **Given** an inline tag with clickable styling, **When** clicked, **Then** the user is navigated to that tag's dedicated page listing all content with that tag
2. **Given** an inline tag, **When** hovered, **Then** appropriate hover state styling is displayed
3. **Given** tags from frontmatter metadata, **When** the page is rendered, **Then** these tags remain indexed for tag page generation but don't appear separately in the content

---

### Edge Cases

- What happens when a tag appears multiple times in the same page (inline and in frontmatter)?
  - Tags should appear inline wherever written, frontmatter tags should not display separately
- How does the system handle tags with special characters or multi-level hierarchies like `#tea/ceremony/advanced`?
  - All tag formats should render inline with proper styling, maintaining the # symbol and hierarchy visualization
- What if a page has only frontmatter tags but no inline tags?
  - No tags should be displayed visually on the page, but they should remain in metadata for tag page generation
- What happens with tags in different contexts (headers, lists, blockquotes)?
  - Tags should display inline with appropriate styling regardless of surrounding markdown context

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render tags inline at their exact position in the markdown content when tags are written using the `#tag` or `#tag/subtag` syntax
- **FR-002**: System MUST display inline tags as clickable links styled identically to regular site links, including the # symbol as part of the visible text
- **FR-003**: System MUST NOT display a separate tags section at the top of rendered pages
- **FR-004**: System MUST preserve tag click functionality to navigate to tag listing pages
- **FR-005**: System MUST maintain tag indexing from frontmatter metadata even when tags are not displayed at the top of the page
- **FR-006**: System MUST apply the same styling to inline tags that is used for regular content links (color, hover effects, underlines, etc.)
- **FR-007**: System MUST handle tags at any location in content (paragraphs, lists, headers, blockquotes) with appropriate inline rendering

### Key Entities *(include if feature involves data)*

- **Tag**: A categorization marker written as `#tagname` or `#category/subcategory` in markdown content, represents a topic or classification
- **Tag Link**: The clickable UI element that displays the tag with styling and enables navigation to the tag's listing page
- **Tag Metadata**: Tags stored in frontmatter YAML that contribute to tag indexing but may not be rendered visually in content

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Readers see tags at their intended contextual location within content rather than at the page top
- **SC-002**: All existing tag navigation functionality (clicking to tag pages) works identically to the current implementation
- **SC-003**: Page load and rendering performance remains within 10% of current baseline
- **SC-004**: No visual bugs or layout issues occur with inline tags across different content contexts (paragraphs, lists, headers, blockquotes)
- **SC-005**: User feedback indicates improved tag context and readability compared to the top-of-page tags section

## Scope *(mandatory)*

### In Scope

- Modifying the rendering of inline tags (`#tag` syntax) in markdown content to display as regular links at their natural position
- Removing or disabling the top-of-page tags section component from page layouts
- Preserving all existing tag navigation and linking functionality
- Maintaining tag indexing from frontmatter metadata
- Ensuring consistent tag styling (matching regular links) across all publish modes (public, trusted, shachu, full)

### Out of Scope

- Changes to tag listing/index pages
- Modifications to how tags are indexed or searched
- New tag management features
- Changes to how tags are written in markdown source files
- Backlinks or tag relationship visualization features
- Tag autocomplete or suggestion features
- Analytics or metrics about tag usage

## Assumptions *(mandatory)*

- The current tag rendering system processes `#tag` syntax in markdown and converts it to HTML links
- There is currently a component or layout section that displays tags at the top of pages
- Tags should be styled identically to regular content links (no special pill styling or distinct appearance)
- Tag click functionality is handled by existing navigation code that doesn't need modification
- Frontmatter tags are processed separately from inline markdown tags
- Users write tags inline in markdown using standard `#tag` or `#tag/subtag` syntax
- The existing link styling (used for internal and external links) is appropriate for tags

## Dependencies *(if applicable)*

- Requires understanding of the current markdown-to-HTML transformation pipeline
- Depends on the existing tag detection and parsing logic in Quartz transformers
- Relies on current tag page generation remaining functional
- May depend on CSS styling definitions for tag pills

## Constraints *(if applicable)*

- Must maintain backward compatibility with existing tag page URLs
- Must not break existing tag indexing or search functionality
- Must work across all four publish modes (public, trusted, shachu, full)
- Must maintain site build performance
- Should not require changes to existing markdown content files in the vault

## Risks *(if applicable)*

- **Risk**: Tags in unusual markdown contexts (inside code blocks, links) might render incorrectly
  - *Mitigation*: Test comprehensive markdown edge cases during implementation

- **Risk**: Removing top tags section might break user expectations if they're accustomed to it
  - *Mitigation*: This is an intentional change requested by the site owner; no mitigation needed

- **Risk**: Performance impact if tag processing happens during every content render
  - *Mitigation*: Leverage existing tag parsing that already happens during build; should be minimal impact

## Open Questions *(if applicable)*

None - the requirement is clear: move tags from top-of-page section to inline display where they appear in content.
