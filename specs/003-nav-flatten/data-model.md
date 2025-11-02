# Data Model: Smart Navigation Defaults

**Feature**: 003-nav-flatten
**Date**: 2025-10-31

## Overview

This document defines the data structures and state management for auto-expanding specific folders in the Explorer navigation component.

---

## Configuration

### AutoExpandConfig

Configuration passed to Explorer component for auto-expanding folders.

**Fields**:
- `folderPaths: string[]` - Array of folder paths to auto-expand

**Example**:
```typescript
{
  folderPaths: ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
}
```

**Validation**:
- Array may be empty (no auto-expansion)
- Folder paths must match format of `node.slug` (full path from root)
- Nested folders require parent to also be in array

**Location**: Configured in `quartz.layout.ts`, passed to Explorer component

---

## Runtime State

### FolderState

Represents the collapsed/expanded state of a single folder.

**Source**: Explorer inline script folder management

**Fields**:
- `path: string` - Full folder path (matches `data-folderpath` attribute)
- `collapsed: boolean` - Whether folder is collapsed (true) or expanded (false)

**Example**:
```typescript
{
  path: "Tea Resources/紙片 (Shihen)",
  collapsed: false  // Expanded
}
```

**Persistence**: Saved to localStorage with key `"fileTree"` as JSON array

### currentExplorerState

Runtime array of `FolderState` objects tracking all folder states.

**Initialization**:
1. Load from localStorage (if `useSavedState` is true)
2. Inject auto-expand folders (from config)
3. Create folder DOM with initial states

**Updates**:
- User clicks folder → state toggled → array updated → saved to localStorage

**Priority**:
1. **Saved state** (highest priority - user's previous actions)
2. **Auto-expand config** (if no saved state exists)
3. **folderDefaultState** (fallback if no saved state or config)

---

## State Flow

### Initial Page Load (Lower Tiers)

```
1. Parse autoExpandFolders from data attribute
   → ["Tea Resources", "Tea Resources/紙片 (Shihen)"]

2. Load saved state from localStorage
   → currentExplorerState = [
        {path: "Bibliography", collapsed: false}  // User previously expanded
      ]

3. Inject auto-expand folders (only if not in saved state)
   → currentExplorerState = [
        {path: "Bibliography", collapsed: false},  // Preserved from saved state
        {path: "Tea Resources", collapsed: false},  // NEW: Auto-expanded
        {path: "Tea Resources/紙片 (Shihen)", collapsed: false}  // NEW: Auto-expanded
      ]

4. Create folder DOM using currentExplorerState
   → Bibliography: expanded (user's choice)
   → Tea Resources: expanded (auto-config)
   → Shihen: expanded (auto-config)
```

### User Manually Collapses

```
1. User clicks "Tea Resources" folder
   → toggleFolder() called

2. Toggle .folder-outer.open class
   → Folder collapses visually

3. Update currentExplorerState
   → Find entry {path: "Tea Resources", collapsed: false}
   → Change to {path: "Tea Resources", collapsed: true}

4. Save to localStorage
   → Entire array saved as JSON

5. Next page load
   → Saved state has collapsed: true
   → Auto-expand config is ignored (saved state wins)
   → "Tea Resources" stays collapsed
```

### Initial Page Load (Full Tier)

```
1. Parse autoExpandFolders from data attribute
   → []  // Empty for Full tier

2. Load saved state from localStorage
   → currentExplorerState = [...]  // User's preferences

3. Inject auto-expand folders
   → No folders to inject (array is empty)

4. Create folder DOM using currentExplorerState
   → All folders use folderDefaultState ("collapsed")
   → Except folders in saved state (user's previous actions)
```

---

## Edge Cases

### Folder Path Doesn't Exist

**Scenario**: Config specifies `"Tea Activities"` but folder doesn't exist in tree

**Data State**:
```typescript
currentExplorerState = [
  {path: "Tea Activities", collapsed: false}  // Entry exists
]
// But no matching DOM node is created
```

**Behavior**: State entry is harmless, no visual effect

**Action**: None needed - gracefully handled

### Nested Folder Without Parent

**Scenario**: Config specifies `["Tea Resources/紙片 (Shihen)"]` but not `"Tea Resources"`

**Data State**:
```typescript
currentExplorerState = [
  {path: "Tea Resources/紙片 (Shihen)", collapsed: false}
]
```

**Behavior**:
- "Tea Resources" uses `folderDefaultState` ("collapsed")
- "紙片 (Shihen)" is expanded but hidden inside collapsed parent
- User sees: "Tea Resources" collapsed (must manually expand to see Shihen)

**Action**: Configuration must include all parent folders

**Correct Config**:
```typescript
autoExpandFolders: ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
```

### User Previously Collapsed

**Scenario**: User manually collapsed "Tea Resources" on previous visit

**Data State**:
```typescript
// localStorage
[
  {path: "Tea Resources", collapsed: true}  // User's choice
]

// Config
autoExpandFolders: ["Tea Resources"]
```

**Injection Logic**:
```typescript
const existing = currentExplorerState.find(item => item.path === "Tea Resources")
if (existing) {
  // Entry exists - respect user's choice (don't modify)
  continue
}
```

**Result**: "Tea Resources" stays collapsed (saved state wins)

**Action**: This is correct behavior - user preference respected

---

## Storage

### localStorage Structure

**Key**: `"fileTree"`

**Value**: JSON array of FolderState objects

```json
[
  {"path": "Tea Resources", "collapsed": false},
  {"path": "Tea Resources/紙片 (Shihen)", "collapsed": true},
  {"path": "Bibliography", "collapsed": false},
  {"path": "Bibliography/Chanoyu Quarterly", "collapsed": true}
]
```

**Size**: Minimal (typically <1KB for 20-30 folders)

**Lifetime**: Persists across sessions until user clears browser data

**Scope**: Per-origin (shared across all tiers on same domain)

---

## Data Passing

### Explorer.tsx → Inline Script

Configuration passed via HTML data attribute:

```tsx
// Explorer.tsx
<div
  class="explorer"
  data-auto-expand-folders={JSON.stringify(opts.autoExpandFolders || [])}
>
```

```typescript
// explorer.inline.ts
const autoExpandFolders = JSON.parse(
  explorer.dataset.autoExpandFolders || "[]"
) as string[]
```

**Format**: JSON-encoded string array

**Example Attribute**:
```html
data-auto-expand-folders='["Tea Resources","Tea Resources/紙片 (Shihen)"]'
```

---

## State Priority

When determining folder's initial state, priority order is:

1. **Saved state** (localStorage `"fileTree"`) - User's previous interactions
2. **Auto-expand config** (if no saved state for that folder)
3. **folderDefaultState** option (global default)
4. **Current path override** (folder containing current page always expanded)

**Example**:
```
Folder: "Tea Resources"

Priority 1: Check saved state
  → Found: {path: "Tea Resources", collapsed: true}
  → Use: collapsed ✓

Priority 2: Check auto-expand config
  → Skipped (saved state exists)

Priority 3: Check folderDefaultState
  → Skipped (saved state exists)

Result: Folder is collapsed (user's previous choice respected)
```

---

## Configuration Examples

### Full Tier (No Auto-Expansion)

```typescript
// quartz.layout.ts
Component.Explorer({
  folderDefaultState: "collapsed",
  useSavedState: true,
  autoExpandFolders: []  // Empty array
})
```

**Result**: All folders collapsed unless user previously expanded them

### Lower Tiers (Auto-Expand Shihen)

```typescript
// quartz.layout.ts
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

Component.Explorer({
  folderDefaultState: "collapsed",
  useSavedState: true,
  autoExpandFolders: publishMode !== "full"
    ? ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
    : []
})
```

**Result**:
- Full tier: No auto-expansion
- Other tiers: "Tea Resources" and "紙片 (Shihen)" expanded on first visit

### All Folders Expanded (Global)

```typescript
// quartz.layout.ts
Component.Explorer({
  folderDefaultState: "open",  // All folders start expanded
  useSavedState: true,
  // autoExpandFolders not needed
})
```

**Result**: ALL folders expanded by default (not selective)

---

## Summary

**Configuration**: Array of folder paths passed via component option
**State Management**: Existing Explorer localStorage mechanism
**Priority**: Saved state > Auto-expand > Default state
**Persistence**: User actions always win (saved state respected)
**Edge Cases**: Handled gracefully (no errors for missing folders, nested folders require parent config)
