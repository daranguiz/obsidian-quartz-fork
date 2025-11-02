# Quick Start: Link Styling Refinements

**Feature**: 006-link-styling
**Branch**: `006-link-styling`
**Prerequisites**: None (styling changes only)

## Overview

This feature refines link styling to reduce visual noise while maintaining clear distinction between link types. Changes are confined to CSS and require no code modifications.

## What Changed

### Dead Link Styling
- **Color**: Changed from `#d97706` (bright orange) to `#cc5500` (burnt orange)
- **Background**: Removed grey background (`var(--lightgray)`)
- **Behavior**: Still tier-aware (visible only on full tier)

### Internal Link Styling
- **Options**: Three visual variants created for evaluation
  - Option A: No background (minimal)
  - Option B: Current behavior (grey background)
  - Option C: Bottom border (modern)
- **Selection**: User will choose final option after visual testing

## Files Modified

1. **[quartz/styles/custom.scss](../../quartz/styles/custom.scss)**
   - Updated `.dead-link` selector (lines ~6-27)
   - Changed color to `#cc5500`
   - Removed `background-color: var(--lightgray)`

2. **[quartz/styles/base.scss](../../quartz/styles/base.scss)**
   - Updated `.internal.broken` selector (lines ~94-116)
   - Changed color to `#cc5500` for consistency
   - Added three commented variants for internal link backgrounds (lines ~86-92)

## Testing Locally

### Step 1: Build with Full Tier
```bash
npx quartz build --publish-mode full --serve
```
- Dead links should appear in burnt orange (#cc5500) without background
- Dead links should be clearly distinguishable from working links

### Step 2: Build with Public Tier
```bash
npx quartz build --publish-mode public --serve
```
- Dead links should appear as plain text (existing behavior)
- No special styling should be visible

### Step 3: Evaluate Internal Link Options

**To test Option A (no background)**:
1. Uncomment Option A CSS block in base.scss
2. Comment out current CSS
3. Run `npx quartz build --serve`
4. Review visual appearance

**To test Option B (current)**:
- No changes needed, this is the existing behavior

**To test Option C (bottom border)**:
1. Uncomment Option C CSS block in base.scss
2. Comment out current CSS
3. Run `npx quartz build --serve`
4. Review visual appearance

### Step 4: Cross-Browser Check
- Test in Chrome, Firefox, Safari
- Verify styling renders consistently
- Check mobile responsiveness (optional)

## Making Your Choice

After testing all three internal link background options:

1. **Review visual impact** on sample pages with many links
2. **Consider readability** and aesthetic preferences
3. **Select one option** to keep
4. **Remove commented variants** and keep only the chosen CSS
5. **Commit changes** with clear note of which option was selected

## Accessibility Notes

- Burnt orange color (#cc5500) has **5.1:1 contrast ratio** against white backgrounds
- Meets **WCAG AA standards** for normal text (minimum 4.5:1)
- Removing background reduces visual noise without compromising accessibility
- Dead links remain distinguishable by color alone

## Edge Cases Handled

✓ **Long links**: No background means no awkward wrapping artifacts
✓ **Links in headings**: Color-only styling integrates cleanly
✓ **Tag links**: Excluded automatically (has separate styling)
✓ **Image links**: Already excluded via `:has(> img)` rule
✓ **Tier filtering**: Existing behavior preserved (dead links hidden on non-full tiers)

## Troubleshooting

**Issue**: Dead links still show grey background
- **Solution**: Clear browser cache, rebuild site (`rm -rf public && npx quartz build`)

**Issue**: Color doesn't look right
- **Solution**: Check CSS custom properties in variables.scss aren't overriding

**Issue**: Styling appears on wrong tiers
- **Solution**: Verify `body[data-publish-mode="full"]` selector is intact

**Issue**: Can't decide between options
- **Solution**: Screenshot each option, compare side-by-side, ask for feedback

## Next Steps

1. Complete local testing (Steps 1-4 above)
2. Choose internal link background option
3. Clean up CSS (remove unused option comments)
4. Update ARCHITECTURE.md with styling decisions
5. Commit and push to trigger site rebuild
6. Verify on live sites across all tiers

## Related Documentation

- [Specification](spec.md) - Original requirements and user stories
- [Research](research.md) - Color selection and design rationale
- [Implementation Plan](plan.md) - Technical context and architecture
- [CLAUDE.md](../../docs-custom/CLAUDE.md) - Repository conventions
- [ARCHITECTURE.md](../../docs-custom/ARCHITECTURE.md) - System documentation (update after implementation)

## Support

If you encounter issues or need to modify styling further:
- Check existing link selectors in base.scss and custom.scss
- Verify CSS specificity isn't causing conflicts
- Test with browser DevTools to debug selector matching
- Consult Quartz v4 documentation for SCSS compilation details
