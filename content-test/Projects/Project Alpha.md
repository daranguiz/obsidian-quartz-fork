---
title: Project Alpha
publish: "[[Level 3 - Public]]"
tags:
  - project
  - active
  - public
---

# Project Alpha

This is a **public project** visible on all publish tiers.

## Overview

Project Alpha demonstrates public content with various link types and inline tags #project #alpha.

## Links to Test

- Internal link to [[../Reference/Style Guide|Style Guide]]
- Internal link to [[Project Beta]] (different tier - will be dead on public)
- Dead link to [[Nonexistent Project]]
- External link to [GitHub](https://github.com)
- Link with image: ![[../attachments/test-image.png]]

## Inline Tags

Testing inline tag display: #css #styling #test-tags #public-content

## Content Blocks

### Code Block

```typescript
function testDeadLinks(link: string): boolean {
  return link.includes('dead');
}
```

### Quote Block

> This is a blockquote to test styling
> with multiple lines

### List Items

- Item with [[Dead Link in List]]
- Item with #inline-tag
- Item with [external link](https://example.com)
- **Bold item** with _italic_ and `code`

### Table

| Feature | Status | Tier |
|---------|--------|------|
| Dead links | Working | All |
| Tag display | Updated | All |
| [[Table Link]] | Testing | Public |

## Related

- [[../Daily/2024-01-15]]
- [[../Reference/Style Guide]]
- [[Project Beta]]
