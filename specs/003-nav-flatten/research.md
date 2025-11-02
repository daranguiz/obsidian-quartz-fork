# Research: Explorer Folder State Management

**Date**: 2025-10-31
**Feature**: 003-nav-flatten

## Research Objective

Understand how the Quartz Explorer component manages folder collapse/expand state to determine the best approach for auto-expanding specific folders on lower trust tiers.

---

## Finding 1: Explorer State Options

### folderDefaultState

Controls the initial collapsed/expanded state for all folders:
- **"collapsed"** (default): All folders start collapsed
- **"open"**: All folders start expanded

**Implementation**: Read from `data-collapsed` attribute on Explorer div (Explorer.tsx:70), used in `createFolderNode()` (explorer.inline.ts:131) to set initial state when no saved state exists.

### useSavedState

Boolean flag controlling localStorage persistence:
- **true** (default): Folder state saved to localStorage and restored on subsequent visits
- **false**: Folders always use `folderDefaultState` with no persistence

**Implementation**: Read from `data-savestate` attribute (Explorer.tsx:71), checked in `setupExplorer()` (explorer.inline.ts:161, 170) when loading saved state.

---

## Finding 2: DOM Structure

### Folder HTML Structure

```html
<li>
  <div class="folder-container" data-folderpath="path/to/folder">
    <svg class="folder-icon">...</svg>
    <div>
      <button class="folder-button">
        <span class="folder-title">Folder Name</span>
      </button>
    </div>
  </div>
  <div class="folder-outer [open]">  <!-- 'open' class = expanded -->
    <ul class="content">
      <!-- child files/folders -->
    </ul>
  </div>
</li>
```

### Folder Identification

Each folder is identified by its **full path** stored in `data-folderpath` attribute on `.folder-container` div (explorer.inline.ts:112).

**Format**: `node.slug` (full path from root)
**Examples**:
- `"Tea Resources"`
- `"Tea Resources/紙片 (Shihen)"`
- `"Projects/Programming"`

### Key CSS Classes

- `.folder-outer.open` - When present, folder is expanded (children visible)
- `.folder-container` - Container with metadata and click target
- `.folder-icon` - SVG chevron that rotates to indicate state

---

## Finding 3: State Management Flow

### Initial State Application

Happens in `createFolderNode()` (explorer.inline.ts:128-141):

1. **Check saved state first**: Look for folder's path in `currentExplorerState` array
2. **Fall back to default**: If no saved state, use `folderDefaultState` option
3. **Override for current path**: If folder is prefix of current page's slug, force open

**Special behavior**: Folders containing the current page auto-expand to show user where they are (lines 133-141).

### Saved State Format

Stored in localStorage with key `"fileTree"`:

```json
[
  {"path": "Tea Resources", "collapsed": false},
  {"path": "Tea Resources/紙片 (Shihen)", "collapsed": true},
  {"path": "Bibliography", "collapsed": false}
]
```

**Loading**: Parsed from localStorage on page load (explorer.inline.ts:169-173)
**Saving**: Updated on every folder click (lines 66-79)

### Toggle Mechanism

`toggleFolder()` function (lines 40-80):

1. User clicks folder icon or button
2. Find `.folder-outer` element
3. Toggle `"open"` class
4. Update `currentExplorerState` array (add or modify entry)
5. Save entire array to localStorage as JSON

**Key insight**: User's manual actions always win - if they collapse a folder, it stays collapsed until they expand it again.

---

## Finding 4: Implementation Approaches

Based on research, three viable approaches for auto-expanding specific folders:

### Approach 1: Client-Side State Injection

Inject folder paths into `currentExplorerState` before folder creation.

**Location**: After line 203 in `setupExplorer()`

```typescript
const autoExpandFolders = ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
for (const folderPath of autoExpandFolders) {
  const existing = currentExplorerState.find(item => item.path === folderPath)
  if (existing) {
    existing.collapsed = false  // Force expanded
  } else {
    currentExplorerState.push({ path: folderPath, collapsed: false })
  }
}
```

**Pros**:
- Works with existing `useSavedState` logic
- User can still collapse folders (not forced open every time)
- Respects current path auto-expansion
- No server-side changes

**Cons**:
- Hardcoded list in client script
- Not configurable per tier without rebuilding

### Approach 2: Configuration Option (RECOMMENDED)

Add `autoExpandFolders` option to Explorer component.

**Changes**:
1. Add to Options interface (Explorer.tsx)
2. Pass via data attribute
3. Read and apply in inline script

```typescript
// Explorer.tsx Options interface
export interface Options {
  autoExpandFolders?: string[]  // NEW
}

// Pass via data attribute
data-auto-expand-folders={JSON.stringify(opts.autoExpandFolders || [])}

// explorer.inline.ts - read and apply
const autoExpandFolders = JSON.parse(explorer.dataset.autoExpandFolders || "[]")
// ... (same injection logic as Approach 1)
```

**Pros**:
- Configurable via `quartz.layout.ts`
- Clean separation of concerns
- User preferences still respected
- Tier-specific via publish mode check

**Cons**:
- Requires changes to both Explorer.tsx and inline script
- Option needs serialization through data attributes

### Approach 3: Global Default State

Change `folderDefaultState` to `"open"` globally.

```typescript
// quartz.layout.ts
Component.Explorer({
  folderDefaultState: "open",  // ALL folders start expanded
  useSavedState: true
})
```

**Pros**:
- Zero code changes
- Uses existing configuration
- Simplest implementation

**Cons**:
- ALL folders expanded (not selective)
- Overwhelming on sites with many folders
- User must manually collapse unwanted folders on first visit

---

## Decision: Use Approach 2 (Configuration Option)

### Selected Approach

Implement `autoExpandFolders` configuration option for selective auto-expansion.

### Rationale

1. **Selective control**: Only expand specified folders, not all folders
2. **Tier-specific**: Can configure different folders per tier via `QUARTZ_PUBLISH_MODE`
3. **User respect**: Saved state overrides auto-expand (user's manual collapse persists)
4. **Maintainability**: Configuration in layout file, not hardcoded in component
5. **Existing patterns**: Follows same pattern as other Explorer options

### Alternatives Considered

| Approach | Why Rejected |
|----------|--------------|
| Approach 1 (State Injection) | Hardcoded list, not configurable per tier |
| Approach 3 (Global Default) | Expands ALL folders, too broad |

---

## Implementation Plan

### Files to Modify

1. **quartz/components/Explorer.tsx**
   - Add `autoExpandFolders?: string[]` to Options interface
   - Pass via `data-auto-expand-folders` attribute

2. **quartz/components/scripts/explorer.inline.ts**
   - Read `autoExpandFolders` from data attribute
   - Inject into `currentExplorerState` after loading saved state (after line 203)
   - Apply before folder DOM creation

3. **quartz.layout.ts**
   - Configure `autoExpandFolders` based on `QUARTZ_PUBLISH_MODE`
   - Full tier: empty array (no auto-expansion)
   - Lower tiers: `["Tea Resources", "Tea Resources/紙片 (Shihen)"]`

### Configuration Example

```typescript
// quartz.layout.ts
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

Component.Explorer({
  folderDefaultState: "collapsed",  // Default: all collapsed
  useSavedState: true,  // Persist user preferences
  autoExpandFolders: publishMode !== "full"
    ? ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
    : []
})
```

### State Injection Logic

```typescript
// explorer.inline.ts - after line 203
const autoExpandFolders = JSON.parse(explorer.dataset.autoExpandFolders || "[]")

// Inject auto-expand folders into state before folder creation
for (const folderPath of autoExpandFolders) {
  // Check if user has previously collapsed this folder
  const existing = currentExplorerState.find(item => item.path === folderPath)

  if (existing) {
    // User has interacted with this folder - respect their choice
    // (Don't force it open if they manually collapsed it)
    continue
  } else {
    // No saved state - set to expanded
    currentExplorerState.push({ path: folderPath, collapsed: false })
  }
}
```

**Key behavior**: If user manually collapses an auto-expanded folder, their preference persists (saved state wins).

---

## Edge Cases

### Folder Doesn't Exist

If auto-expand config references a folder that doesn't exist in the tree:
- **Behavior**: Silently ignored (state entry exists but no matching DOM node)
- **Impact**: None - harmless
- **Fix needed**: No - natural handling

### Nested Folders

If auto-expanding nested folder (e.g., "Tea Resources/紙片 (Shihen)"):
- **Requirement**: Parent must also be expanded
- **Solution**: Include both in `autoExpandFolders` array
- **Example**: `["Tea Resources", "Tea Resources/紙片 (Shihen)"]`

### User Manually Collapses

If user manually collapses an auto-expanded folder:
- **Behavior**: Saved state records `collapsed: true`
- **Next visit**: Folder stays collapsed (saved state wins over auto-expand)
- **Impact**: User preference respected
- **Desired**: Yes - this is correct behavior

### Empty Folders

If auto-expanded folder has no children:
- **Behavior**: Folder expands but shows nothing
- **Impact**: Visual oddity but harmless
- **Fix needed**: No - standard Explorer behavior

---

## Performance Considerations

### Impact

- **Minimal**: State injection happens once during initialization
- **Timing**: Before DOM creation, no layout thrashing
- **Storage**: Adds small amount of data to localStorage (one entry per auto-expanded folder)

### Measurement

No measurable performance impact expected:
- Array iteration: O(n) where n = number of auto-expanded folders (typically 2)
- State lookup: O(m) where m = number of saved folder states (typically <20)
- Total: O(2 * 20) = ~40 operations, negligible

---

## Testing Strategy

### Manual Verification

Test each tier and verify folder state:

```bash
# Full tier - no auto-expansion
npx quartz build --publish-mode full --serve
# Verify: All folders collapsed

# Shachu tier - auto-expand Tea Resources + Shihen
npx quartz build --publish-mode shachu --serve
# Verify: Tea Resources and 紙片 (Shihen) expanded on page load
```

### Verification Checklist

- [ ] Full tier: All folders collapsed by default
- [ ] Lower tiers: "Tea Resources" expanded on page load
- [ ] Lower tiers: "紙片 (Shihen)" expanded on page load
- [ ] Click count to Shihen file: 3 (Full) vs 1 (lower tiers)
- [ ] Manual collapse persists across page reloads
- [ ] Current page folder still auto-expands (existing behavior preserved)
- [ ] localStorage saved state respects user's manual actions

---

## Conclusion

**Approach 2 (Configuration Option)** is the optimal solution for auto-expanding specific folders on lower trust tiers:

✅ Leverages existing Explorer state management
✅ Configurable per tier via `QUARTZ_PUBLISH_MODE`
✅ Respects user preferences (saved state wins)
✅ Minimal code changes (3 files, ~15 lines total)
✅ No performance impact
✅ Clean separation of concerns

**Next step**: Proceed to Phase 1 (Design Artifacts) with this implementation approach.
