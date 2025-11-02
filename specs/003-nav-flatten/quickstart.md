# Quickstart: Smart Navigation Defaults

**Feature**: 003-nav-flatten
**Date**: 2025-10-31

This guide explains how to configure, test, and verify the smart navigation defaults feature.

---

## Overview

Smart navigation defaults auto-expand specific folders on page load for lower trust tiers (Public, Shachu, Trusted), reducing clicks to access frequently used content from 3 to 1. Full tier preserves default collapsed state.

---

## Configuration

### Step 1: Add autoExpandFolders Option to Explorer

**File**: `quartz/components/Explorer.tsx`

**Location**: Options interface (around line 14)

```typescript
export interface Options {
  title?: string
  folderDefaultState: "collapsed" | "open"
  folderClickBehavior: "collapse" | "link"
  useSavedState: boolean
  sortFn: (a: FileTrieNode, b: FileTrieNode) => number
  filterFn: (node: FileTrieNode) => boolean
  mapFn: (node: FileTrieNode) => void
  order: OrderEntries[]
  autoExpandFolders?: string[]  // NEW: Folders to auto-expand on page load
}
```

**Location**: Pass via data attribute (around line 72)

```typescript
<div
  class={classNames(displayClass, "explorer")}
  data-behavior={opts.folderClickBehavior}
  data-collapsed={opts.folderDefaultState}
  data-savestate={opts.useSavedState}
  data-auto-expand-folders={JSON.stringify(opts.autoExpandFolders || [])}  // NEW
  data-data-fns={JSON.stringify({
    order: opts.order,
    sortFn: opts.sortFn.toString(),
    filterFn: opts.filterFn.toString(),
    mapFn: opts.mapFn.toString(),
  })}
>
```

### Step 2: Apply Auto-Expansion in Inline Script

**File**: `quartz/components/scripts/explorer.inline.ts`

**Location**: After loading saved state (after line 203, before folder creation)

```typescript
// After: currentExplorerState = JSON.parse(savedState) ?? []

// NEW: Inject auto-expand folders into state
const autoExpandFolders = JSON.parse(
  explorer.dataset.autoExpandFolders || "[]"
) as string[]

for (const folderPath of autoExpandFolders) {
  // Check if user has previously interacted with this folder
  const existing = currentExplorerState.find(item => item.path === folderPath)

  if (!existing) {
    // No saved state for this folder - set to expanded
    currentExplorerState.push({ path: folderPath, collapsed: false })
  }
  // If existing state found, respect user's choice (don't override)
}

// Continue with: const folderPaths = trie.getFolderPaths()
```

### Step 3: Configure in Layout

**File**: `quartz.layout.ts`

**Location**: Explorer component configuration (around line 42 and 75)

```typescript
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

Component.Explorer({
  folderDefaultState: "collapsed",
  useSavedState: true,
  filterFn: (node) => {
    if (node.slugSegment === "tags") return false
    if (node.slug?.match(/^index-(trusted|shachu|public)$/)) return false
    return true
  },
  // NEW: Auto-expand specific folders on lower tiers
  autoExpandFolders: publishMode !== "full"
    ? ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
    : []
})
```

**Apply to both occurrences** (left sidebar and right sidebar if you have Explorer in both places).

---

## Testing

### Local Testing Commands

Test each tier to verify auto-expansion:

```bash
# Full tier - should have no auto-expansion
npx quartz build --publish-mode full --serve

# Trusted tier - should auto-expand Tea Resources + Shihen
npx quartz build --publish-mode trusted --serve

# Shachu tier - should auto-expand Tea Resources + Shihen
npx quartz build --publish-mode shachu --serve

# Public tier - should auto-expand Tea Resources + Shihen
npx quartz build --publish-mode public --serve
```

After running each command:
1. Open browser to `http://localhost:8080`
2. Check the navigation sidebar
3. Verify folder expansion state

### Verification Checklist

#### Full Tier
- [ ] All folders start collapsed
- [ ] "Tea Resources" is collapsed
- [ ] "紙片 (Shihen)" is not visible (inside collapsed parent)
- [ ] Click count to Shihen file: **3 clicks**
  - Click 1: Expand "Tea Resources"
  - Click 2: Expand "紙片 (Shihen)"
  - Click 3: Click on file

#### Lower Tiers (Trusted, Shachu, Public)
- [ ] "Tea Resources" is expanded on page load
- [ ] "紙片 (Shihen)" is expanded on page load (visible inside Tea Resources)
- [ ] All Shihen files immediately visible:
  - Fukiage Bunrin
  - Gomei
  - Gomei (January)
  - ... (all ~23 files)
- [ ] Other folders remain collapsed (Bibliography, Temae Reference)
- [ ] Click count to Shihen file: **1 click**
  - Click 1: Click directly on file

### Visual Comparison

**Full Tier**:
```
📁 Tea Resources (collapsed)
📁 Other Folder (collapsed)
📄 Other File
```

**Shachu Tier** (after auto-expansion):
```
📂 Tea Resources (expanded)
    📂 紙片 (Shihen) (expanded)
        📄 Fukiage Bunrin
        📄 Gomei
        📄 Gomei (January)
        ...
    📁 Bibliography (collapsed)
    📁 Temae Reference (collapsed)
📁 Other Folder (collapsed)
📄 Other File
```

---

## State Persistence Testing

### Test 1: User Manually Collapses

**Setup**: Visit Shachu tier, manually collapse "Tea Resources"

**Expected**:
1. Folder collapses
2. State saved to localStorage
3. Refresh page → folder stays collapsed (user's choice respected)

**Verification**:
```bash
# Build and serve
npx quartz build --publish-mode shachu --serve

# In browser:
# 1. Verify "Tea Resources" is expanded (auto-expand)
# 2. Click to collapse it
# 3. Refresh page
# 4. Verify it's still collapsed (saved state wins)
```

### Test 2: Clear Saved State

**Setup**: Clear browser localStorage

**Expected**:
1. Navigate back to site
2. Auto-expansion applies again (no saved state to override)

**Verification**:
```javascript
// In browser console:
localStorage.removeItem("fileTree")
location.reload()

// Verify:
// "Tea Resources" is expanded again (auto-expand reapplied)
```

---

## Edge Case Testing

### Test 1: Nested Folder Without Parent

**Setup**: Configure only `"Tea Resources/紙片 (Shihen)"` (omit parent)

```typescript
autoExpandFolders: ["Tea Resources/紙片 (Shihen)"]  // Missing parent!
```

**Expected**:
- "Tea Resources" is collapsed (not in config)
- "紙片 (Shihen)" is expanded but hidden inside collapsed parent
- User must manually expand "Tea Resources" to see Shihen

**Fix**: Always include parent folders
```typescript
autoExpandFolders: ["Tea Resources", "Tea Resources/紙片 (Shihen)"]  // Correct
```

### Test 2: Folder Doesn't Exist

**Setup**: Configure non-existent folder

```typescript
autoExpandFolders: ["Nonexistent Folder"]
```

**Expected**:
- No error or warning
- State entry created but no visual effect (no matching DOM node)
- Other folders work normally

### Test 3: Empty Shihen Folder

**Setup**: Temporarily remove all files from "紙片 (Shihen)" in vault

**Expected**:
- "Tea Resources" expands
- "紙片 (Shihen)" expands but shows no children (empty)
- No error messages

**Verification**:
```bash
# Build after removing Shihen files
npx quartz build --publish-mode shachu --serve

# Check:
# - "紙片 (Shihen)" is expanded
# - Folder shows no content (standard empty folder behavior)
# - No JavaScript errors in console
```

---

## Troubleshooting

### Issue: Auto-Expansion Not Working

**Symptoms**: Lower tiers still show collapsed folders

**Possible Causes**:
1. `autoExpandFolders` not passed to component
2. Data attribute not set correctly
3. Folder paths don't match exact format

**Debug Steps**:
```bash
# 1. Verify publish mode
npx quartz build --publish-mode shachu 2>&1 | grep -i MODE

# 2. Check HTML data attribute (in browser)
# Inspect Explorer div, should see:
# data-auto-expand-folders='["Tea Resources","Tea Resources/紙片 (Shihen)"]'

# 3. Check browser console for errors
# Open DevTools → Console
# Look for parse errors or missing dataset property
```

**Fix**: Ensure data attribute matches this format exactly:
```typescript
data-auto-expand-folders={JSON.stringify(opts.autoExpandFolders || [])}
```

### Issue: Folders Stay Collapsed After Manual Collapse

**Symptoms**: Auto-expansion doesn't reapply on subsequent visits

**Cause**: Saved state is working correctly (this is expected behavior!)

**Explanation**: Once user manually collapses a folder, their preference is saved and respected on future visits. Auto-expansion only applies when no saved state exists.

**To Reset**: Clear localStorage
```javascript
// Browser console
localStorage.removeItem("fileTree")
location.reload()
```

### Issue: Nested Folder Not Visible

**Symptoms**: "紙片 (Shihen)" configured but not visible

**Cause**: Parent folder ("Tea Resources") not expanded

**Fix**: Include parent in config
```typescript
autoExpandFolders: [
  "Tea Resources",  // Parent must be included
  "Tea Resources/紙片 (Shihen)"
]
```

---

## Performance Verification

### Expected Impact

- **Build Time**: No change (configuration is static)
- **Page Load**: <5ms overhead (state injection before DOM creation)
- **Runtime**: No change (uses existing folder state logic)

### Measurement

```bash
# Time the build
time npx quartz build --publish-mode shachu

# Compare with Full tier
time npx quartz build --publish-mode full

# Difference should be 0 (configuration doesn't affect build time)
```

**Page Load Timing** (browser DevTools):
```
Network tab → Reload page → Check:
- DOMContentLoaded: Should be unchanged
- Load event: Should be unchanged
```

---

## Deployment

### Pre-Deployment Checklist

```bash
# 1. Clean build
rm -rf public

# 2. Test all four tiers locally
for mode in full trusted shachu public; do
  echo "Testing $mode tier..."
  npx quartz build --publish-mode $mode --serve
  # Manually verify in browser
  # Press Ctrl+C to stop server
done

# 3. Verify no errors
# Check console logs for any warnings or errors

# 4. Test saved state persistence
# Manually collapse folders, refresh, verify state persists
```

### Production Deployment

1. **Commit changes**:
```bash
git add quartz/components/Explorer.tsx
git add quartz/components/scripts/explorer.inline.ts
git add quartz.layout.ts
git commit -m "feat: add smart navigation defaults for lower tiers"
```

2. **Push to trigger builds**:
```bash
git push origin v4
```

3. **Wait for Cloudflare Pages builds** (all four tiers rebuild)

4. **Verify production**:
   - Visit each tier's URL
   - Check navigation sidebar
   - Verify auto-expansion works

---

## Rollback Plan

If issues arise:

1. **Immediate**: Revert commit
```bash
git revert HEAD
git push origin v4
```

2. **Wait for rebuild**: ~5 minutes

3. **Temporary workaround**: Set `autoExpandFolders: []` in layout (requires deploy)

---

## Configuration Variations

### Expand Different Folders Per Tier

```typescript
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

let autoExpand: string[] = []
switch (publishMode) {
  case "public":
    autoExpand = ["Tea Resources"]  // Public: only top level
    break
  case "shachu":
  case "trusted":
    autoExpand = ["Tea Resources", "Tea Resources/紙片 (Shihen)"]  // Lower: both
    break
  case "full":
  default:
    autoExpand = []  // Full: nothing
}

Component.Explorer({
  autoExpandFolders: autoExpand
})
```

### Expand All Folders (Alternative)

```typescript
Component.Explorer({
  folderDefaultState: "open",  // All folders expanded
  useSavedState: true,
  // No autoExpandFolders needed
})
```

---

## Summary

**Implementation Steps**:
1. Add `autoExpandFolders` option to Explorer.tsx
2. Pass via data attribute
3. Apply in inline script after loading saved state
4. Configure in quartz.layout.ts based on publish mode

**Testing Steps**:
1. Build each tier locally
2. Verify folder states match expectations
3. Test state persistence
4. Check edge cases

**Deployment**:
1. Test all tiers locally
2. Commit and push
3. Verify production
4. Keep rollback plan ready

**Success Metrics**:
- Click count: 3 → 1 (lower tiers)
- Saved state works (manual collapse persists)
- Full tier unchanged
- No performance degradation
