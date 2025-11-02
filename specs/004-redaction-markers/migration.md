# Migration Guide: hideInBuild → Redaction Markers

**Feature**: 004-redaction-markers
**Date**: 2025-11-01

## Overview

This feature **replaces** the existing `hideInBuild` transformer with a more comprehensive redaction system. This document outlines the migration path for existing content.

---

## What's Changing

### Old System (hideInBuild.ts)

**Syntax**:
```markdown
<!-- hide-in-build -->
Content hidden from all builds except full
<!-- /hide-in-build -->

<!-- hide-in-build:public,shachu -->
Content hidden only in public and shachu builds
<!-- /hide-in-build -->
```

**Limitations**:
- Block-only (no inline markers)
- More verbose syntax (opening + closing tags)
- No Obsidian editor integration (manual typing)
- No visual styling in Obsidian

### New System (Redaction Markers)

**Syntax**:
```markdown
Content hidden from non-full builds. <!-- redact -->

Content hidden from ALL builds. <!-- no-render -->

<!-- redact-begin -->
Block content hidden from non-full builds.
<!-- redact-end -->

<!-- no-render-begin -->
Block content hidden from ALL builds.
<!-- no-render-end -->
```

**Improvements**:
- Inline AND block forms
- Simpler syntax (shorter comment tags)
- Obsidian plugin with hotkey support
- Visual styling in live preview mode
- Keyword tripwire ("Juuden" auto-redacts)
- Build warnings for malformed markers

---

## Migration Mapping

| Old hideInBuild | New Redaction Markers | Notes |
|-----------------|----------------------|-------|
| `<!-- hide-in-build -->` | `<!-- redact-begin -->` | Default behavior: hide from all except full |
| `<!-- /hide-in-build -->` | `<!-- redact-end -->` | Closing tag |
| `<!-- hide-in-build:public,shachu,trusted -->` | `<!-- no-render-begin -->` | If hiding from all non-full modes |
| N/A (not supported) | `<!-- redact -->` | NEW: Inline single-line form |
| N/A (not supported) | `<!-- no-render -->` | NEW: Inline hide-from-all form |

**Special Cases**:
- `<!-- hide-in-build:public -->` → Use frontmatter `publish: "[[Trusted]]"` instead (note-level control)
- `<!-- hide-in-build:public,shachu -->` → Use frontmatter `publish: "[[Trusted]]"` (note-level control)
- Partial mode lists → Not directly supported; use frontmatter for note-level, markers for line/block-level

---

## Migration Strategy

### Option 1: Manual Replacement (Recommended for Small Vaults)

1. **Search for hideInBuild markers** in your vault:
   ```bash
   cd "/path/to/your/vault"
   grep -r "hide-in-build" --include="*.md"
   ```

2. **Replace markers** based on mapping table above:
   - `<!-- hide-in-build -->` → `<!-- redact-begin -->`
   - `<!-- /hide-in-build -->` → `<!-- redact-end -->`

3. **Test** by building in different modes

### Option 2: Automated Script (Recommended for Large Vaults)

```bash
#!/bin/bash
# migrate-hideinbuild.sh

VAULT_PATH="/path/to/your/vault"

# Find all markdown files with hideInBuild markers
find "$VAULT_PATH" -name "*.md" -type f | while read file; do
  # Backup original
  cp "$file" "$file.backup"

  # Replace hideInBuild markers with redaction markers
  sed -i '' 's/<!-- hide-in-build -->/<!-- redact-begin -->/g' "$file"
  sed -i '' 's/<!-- \/hide-in-build -->/<!-- redact-end -->/g' "$file"

  # Handle parameterized versions (all non-full modes → no-render)
  sed -i '' 's/<!-- hide-in-build:[^>]* -->/<!-- no-render-begin -->/g' "$file"

  echo "Migrated: $file"
done

echo "Migration complete. Backup files created with .backup extension"
```

### Option 3: Gradual Migration (Coexistence)

The new `redactionMarkers` transformer can coexist with the old `hideInBuild` transformer temporarily:

1. **Keep both transformers** in `quartz.config.ts` initially
2. **Migrate notes gradually** as you edit them
3. **Remove hideInBuild** once all notes are migrated

**Note**: Both transformers will process content independently, so if a file has both old and new markers, both will apply.

---

## Quartz Changes Required

### Files to Modify

1. **quartz/plugins/transformers/index.ts**
   ```diff
   - export { HideInBuild } from "./hideInBuild"
   + export { RedactionMarkers } from "./redactionMarkers"
   ```

2. **quartz.config.ts**
   ```diff
     transformers: [
       Plugin.FrontMatter(),
   -   Plugin.HideInBuild(), // Remove content marked with hide-in-build comments
   +   Plugin.RedactionMarkers(), // Filter content with redact/no-render markers
       Plugin.CreatedModifiedDate({
   ```

3. **Delete old file**:
   ```bash
   rm quartz/plugins/transformers/hideInBuild.ts
   ```

### Testing After Migration

1. **Build in all modes** to verify filtering:
   ```bash
   npx quartz build --publish-mode full
   npx quartz build --publish-mode trusted
   npx quartz build --publish-mode shachu
   npx quartz build --publish-mode public
   ```

2. **Check for build warnings**:
   ```bash
   cat public/build-warnings.html
   ```

3. **Spot-check migrated files** in output

---

## Vault Changes (Content Migration)

### Before Migration

Count existing hideInBuild usage:
```bash
cd "/path/to/vault"
echo "Files with hideInBuild markers:"
grep -r "hide-in-build" --include="*.md" -l | wc -l

echo "Total hideInBuild marker pairs:"
grep -r "<!-- hide-in-build" --include="*.md" | wc -l
```

### After Migration

Verify no old markers remain:
```bash
grep -r "hide-in-build" --include="*.md"
# Should return no results
```

### Rollback Plan

If migration causes issues:

1. **Restore backups**:
   ```bash
   find "$VAULT_PATH" -name "*.md.backup" | while read backup; do
     original="${backup%.backup}"
     mv "$backup" "$original"
   done
   ```

2. **Revert Quartz changes**:
   ```bash
   git checkout quartz.config.ts quartz/plugins/transformers/index.ts
   git checkout quartz/plugins/transformers/hideInBuild.ts
   ```

---

## Edge Cases & Gotchas

### Parameterized hideInBuild

**Old**:
```markdown
<!-- hide-in-build:public -->
Only hidden in public mode
<!-- /hide-in-build -->
```

**Problem**: New system doesn't support "hide in some but not all non-full modes"

**Solution**: Use frontmatter for note-level control:
```yaml
---
publish: "[[Trusted]]"  # Hidden from public, visible in trusted+
---
```

Then use redaction markers for line/block-level within the note.

### Nested hideInBuild Blocks

**Old**:
```markdown
<!-- hide-in-build -->
Outer block
  <!-- hide-in-build:public -->
  Inner block (more specific)
  <!-- /hide-in-build -->
More outer block
<!-- /hide-in-build -->
```

**Problem**: Nesting behavior may differ

**Solution**: Flatten to separate blocks:
```markdown
<!-- redact-begin -->
Outer block part 1
<!-- redact-end -->

<!-- no-render-begin -->
Inner block (more restrictive)
<!-- no-render-end -->

<!-- redact-begin -->
Outer block part 2
<!-- redact-end -->
```

### Unclosed hideInBuild Blocks

**Old behavior**: Content after unclosed block still rendered
**New behavior**: File skipped + warning generated

**Solution**: Fix all unclosed blocks before migration

---

## Timeline & Phasing

### Phase 1: Preparation (Before Implementation)
- [ ] Audit vault for hideInBuild usage
- [ ] Review parameterized uses (decide frontmatter vs markers)
- [ ] Create backups of all markdown files

### Phase 2: Quartz Implementation
- [ ] Implement redactionMarkers transformer
- [ ] Keep HideInBuild in config temporarily (coexistence)
- [ ] Test both systems work together

### Phase 3: Content Migration
- [ ] Run migration script on vault
- [ ] Test builds in all 4 modes
- [ ] Fix any warnings in build-warnings.html

### Phase 4: Cleanup
- [ ] Remove HideInBuild from quartz.config.ts
- [ ] Delete hideInBuild.ts file
- [ ] Remove .backup files from vault
- [ ] Update ARCHITECTURE.md

---

## Benefits of Migration

1. **Inline markers**: Hide single lines without block wrapping
2. **Hotkey support**: Toggle markers in Obsidian with keyboard shortcuts
3. **Visual styling**: CSS styling in live preview mode (less visual clutter)
4. **Keyword tripwire**: Auto-hide lines containing "Juuden"
5. **Better error handling**: Build warnings for malformed markers
6. **Simpler syntax**: `<!-- redact -->` vs `<!-- hide-in-build -->`

---

## Support

If migration issues arise:
1. Check build-warnings.html for specific file/line errors
2. Verify marker syntax matches new format exactly
3. Test individual files in isolation
4. Restore from backups if needed

**Migration validation checklist**:
- [ ] All hideInBuild markers replaced
- [ ] All builds succeed without errors
- [ ] Content filtering behavior matches expectations
- [ ] No build-warnings.html file (or only expected warnings)
- [ ] Obsidian plugin installed and working
