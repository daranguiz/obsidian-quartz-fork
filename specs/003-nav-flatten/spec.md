# Feature Specification: Smart Navigation Defaults

**Feature Branch**: `003-nav-flatten`
**Created**: 2025-10-31
**Updated**: 2025-10-31
**Status**: Draft
**Input**: User description: "My issue is that the nav bar on the left isn't super useful in its current form. Shihen files require too many clicks to access (Tea Resources → 紙片 (Shihen) → file = 3 clicks). Solution: Auto-expand specific folders on lower trust tiers so frequently accessed content is immediately visible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Access to Frequently Used Content (Priority: P1)

Users browsing the Public, Shachu, or Trusted tier sites need quick access to individual Shihen notes without manually expanding multiple folders. The current navigation requires users to click "Tea Resources", then click "紙片 (Shihen)", then click the file - creating unnecessary friction for frequently accessed content.

**Why this priority**: This is the core value proposition - reducing navigation friction for the most frequently accessed content type. Auto-expanding relevant folders reduces clicks from 3 to 1 while preserving the folder structure's semantic value.

**Independent Test**: Can be tested by visiting any lower trust tier site (Public, Shachu, or Trusted), observing that "Tea Resources" and "紙片 (Shihen)" folders are already expanded on page load, and verifying that Shihen files are immediately visible without manual expansion.

**Acceptance Scenarios**:

1. **Given** a user visits the Trusted tier site, **When** they view the navigation sidebar, **Then** they see "Tea Resources" already expanded with its subfolders visible
2. **Given** a user is viewing the expanded "Tea Resources" folder on Shachu tier, **When** they look at its contents, **Then** "紙片 (Shihen)" is already expanded showing all Shihen files
3. **Given** a user visits the Public tier site, **When** they want to access a Shihen file, **Then** they can click it directly without expanding any folders (1 click total)

---

### User Story 2 - Preserve Collapsed State for Full Tier (Priority: P2)

Users browsing the Full tier site should see the navigation in its default collapsed state. The Full tier contains the complete vault structure with many folders, so auto-expanding folders would create visual clutter.

**Why this priority**: The Full tier has significantly more content than lower tiers. Auto-expanding folders would make the sidebar unwieldy. Users with full access can manually expand what they need.

**Independent Test**: Can be tested by visiting the Full tier site and verifying that all folders including "Tea Resources" and "紙片 (Shihen)" start in collapsed state.

**Acceptance Scenarios**:

1. **Given** a user visits the Full tier site, **When** they view the navigation sidebar, **Then** all folders are collapsed by default
2. **Given** a user wants to access Shihen files on Full tier, **When** they expand folders manually, **Then** the standard 3-click pattern works (expand Tea Resources, expand Shihen, click file)
3. **Given** the user's folder expansion state is saved, **When** they return to Full tier, **Then** their previously expanded folders remain open (existing behavior preserved)

---

### User Story 3 - Explicit Control Over Auto-Expansion (Priority: P3)

The content owner needs the ability to explicitly control which folders auto-expand on which tiers. Currently only "Tea Resources" and "紙片 (Shihen)" should auto-expand on lower tiers, but future folders like "Tea Activities" should not automatically be added - they must be explicitly configured.

**Why this priority**: This provides flexibility for future content organization without requiring code changes. It ensures that new folders maintain default behavior unless explicitly configured.

**Independent Test**: Can be tested by adding a new folder "Tea Activities" to the vault, building for a lower trust tier, and verifying that this new folder remains collapsed (not auto-expanded) unless explicitly configured.

**Acceptance Scenarios**:

1. **Given** a new folder "Tea Activities" is added to the vault, **When** building for Trusted tier without configuration changes, **Then** "Tea Activities" remains collapsed on page load
2. **Given** only "Tea Resources" and "紙片 (Shihen)" are configured for auto-expansion, **When** building for any lower trust tier, **Then** only those two folders auto-expand
3. **Given** the auto-expansion configuration exists, **When** adding future content, **Then** new folders remain collapsed unless explicitly added to the configuration

---

### Edge Cases

**Missing Folders**:
- What if "Tea Resources" doesn't exist on a lower tier build? → No auto-expansion occurs; navigation shows whatever folders are present in collapsed state
- What if "紙片 (Shihen)" is empty? → Folder appears but is empty when expanded (standard Explorer behavior)

**Folder State Persistence**:
- What if user manually collapses an auto-expanded folder? → Explorer's saved state takes precedence; folder stays collapsed on subsequent page loads
- What if user manually expands a folder on Full tier? → Saved state works normally; folders stay expanded per user preference
- What if user clears browser localStorage (losing saved state)? → Resets to configured default; auto-expanded folders expand again on next page load

**New Folders**:
- What if "Tea Resources" contains a new subfolder? → Only explicitly configured folders auto-expand; new subfolders remain collapsed

## Requirements *(mandatory)*

### Functional Requirements

**Tier-Specific Behavior**:
- **FR-001**: System MUST keep all folders collapsed by default when building for Full trust tier
- **FR-002**: System MUST auto-expand the "Tea Resources" folder when building for Public, Shachu, or Trusted trust tiers
- **FR-003**: System MUST auto-expand the "紙片 (Shihen)" folder (nested under "Tea Resources") when building for Public, Shachu, or Trusted trust tiers
- **FR-004**: System MUST NOT automatically expand any folders other than those explicitly configured

**Navigation Display**:
- **FR-005**: Auto-expanded folders MUST show their children immediately on page load without user interaction
- **FR-006**: Auto-expanded folders MUST use existing Explorer expanded state styling (no visual distinction between auto-expanded and manually-expanded folders)
- **FR-007**: Users MUST be able to manually collapse auto-expanded folders (standard Explorer collapse behavior)
- **FR-008**: System MUST preserve user's manual folder state using Explorer's existing saved state mechanism

**Configuration**:
- **FR-009**: System MUST support explicit configuration of which folders should auto-expand per trust tier, stored in quartz.layout.ts alongside existing Explorer configuration
- **FR-010**: System MUST allow different auto-expansion rules per trust tier (Full tier has no auto-expansion, lower tiers have configured folders)
- **FR-011**: System MUST use case-sensitive exact matching for folder paths in auto-expansion configuration (including spaces and Unicode characters)

**Preservation**:
- **FR-012**: System MUST preserve all folder structure - auto-expansion is purely default state, not structural modification
- **FR-013**: System MUST maintain correct file paths and URLs (no changes to vault structure)

### Key Entities

- **Explorer Folder State**: Configuration for which folders should auto-expand
  - Attributes: folderPath (string, case-sensitive exact match), autoExpand (boolean), targetTiers (PublishMode[])
  - Hierarchy: Each folder is listed independently in the configuration array (no implicit parent-child relationship)
  - Example: `{ folderPath: "Tea Resources", autoExpand: true, targetTiers: ["public", "shachu", "trusted"] }`
  - Example: `{ folderPath: "紙片 (Shihen)", autoExpand: true, targetTiers: ["public", "shachu", "trusted"] }`

- **Trust Tier**: The access level for which a site build is being generated
  - Values: Full, Trusted, Shachu, Public
  - Behavior: Determines which folders auto-expand on page load

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Navigation Efficiency**:
- **SC-001**: Users can access any Shihen file in 1 click on lower trust tiers (down from 3 clicks)
- **SC-002**: "Tea Resources" and "紙片 (Shihen)" folders are visibly expanded on page load for lower tiers (0 manual expansions needed)
- **SC-003**: Full tier navigation remains unchanged (all folders collapsed by default)

**Correctness**:
- **SC-004**: 100% of Shihen files are visible and accessible after auto-expansion
- **SC-005**: Manual folder collapse/expand behavior works identically to current Explorer (no regression)
- **SC-006**: Saved folder state persists across page loads (existing behavior preserved)

**Maintainability**:
- **SC-007**: New folders added to vault are not auto-expanded unless explicitly configured
- **SC-008**: Auto-expansion configuration is explicit and documentable (no implicit "expand everything" behavior)

## Clarifications

### Session 2025-11-01

- Q: Should there be any visual indicator differentiating auto-expanded folders from manually-expanded folders? → A: No visual distinction - auto-expanded and manually-expanded folders look identical (both just show expanded state)
- Q: Where should the configuration for which folders auto-expand per trust tier be stored? → A: In quartz.layout.ts as part of the Explorer component configuration (where Explorer filterFn already lives)
- Q: What should happen if a user manually collapses an auto-expanded folder and then clears their browser's localStorage? → A: Reset to configured default (auto-expanded folders expand again on next page load)
- Q: How should the system match folder paths in the auto-expansion configuration? → A: Case-sensitive exact match (must match "Tea Resources" exactly, including spaces and Japanese characters)
- Q: How should the system handle nested folder path specification in the configuration? → A: Independent full paths - list both "Tea Resources" and "紙片 (Shihen)" separately in configuration array (no implicit hierarchy)

## Assumptions

1. **Shihen Content Characteristics**: Shihen is a frequently accessed collection (~23 files currently) where users want immediate visibility rather than browsing
2. **Trust Tier Stability**: The four trust tiers (Full, Trusted, Shachu, Public) are stable and will not change frequently
3. **Explorer Component**: The navigation sidebar uses Explorer component which already supports `folderDefaultState` and saved state
4. **Lower Tier Content Volume**: Public/Shachu/Trusted tiers have less content than Full, making auto-expansion less visually cluttered
5. **Build-Time Processing**: Folder state configuration happens at build time for each tier independently; no runtime dynamic behavior needed
