---
title: Project Beta
publish: "[[Level 1 - Trusted]]"
tags:
  - project
  - trusted
  - confidential
---

# Project Beta

This is a **trusted project** visible only on Trusted and Full tiers.

## Visibility

- ✓ Visible on: Full, Trusted
- ✗ Hidden on: Shachu, Public

This means [[Project Alpha]] will have a working link to this page on trusted tier, but a **dead link** on public tier.

## Testing Dead Links Across Tiers

When viewed from different tiers:

- **Public tier**: Link from Alpha to Beta will be dead/broken
- **Trusted tier**: Link from Alpha to Beta will work
- **Full tier**: All links work

## Internal Links

- [[Project Alpha]] - Public (always works)
- [[../Reference/Trusted Info]] - Trusted (works on same tier)
- [[../Archive/Old Project]] - Shachu (dead on trusted)
- [[Missing Page]] - Dead link on all tiers

## Tags

#trusted #sensitive #project #tier-testing

## Content

This page has substantial content to test:

### Long Paragraph with Dead Link

Lorem ipsum dolor sit amet, [[Nonexistent Reference]], consectetur adipiscing elit. This [[Another Dead Link]] demonstrates how dead links appear in flowing text with #inline-tags mixed in. The styling should be [[Subtle But Visible]] without disrupting readability.

### Multiple Links in List

1. First item with [[Dead Link 1]]
2. Second item with [[Dead Link 2]] and #tag
3. Third item with working link [[Project Alpha]]
4. Fourth with external [link](https://example.com)
