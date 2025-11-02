---
title: Style Guide
publish: "[[Level 3 - Public]]"
---

# Style Guide

Comprehensive styling reference for testing all link types and visual elements.

## Link Types Testing

### Working Internal Links

- [[../Projects/Project Alpha]] - Public project
- [[../Daily/2024-01-15]] - Daily note
- [[Trusted Info]] - Trusted reference (dead on public)

### Dead Links (Styling Test)

These should display in burnt orange (#cc5500) with no background on full tier:

- [[This Page Does Not Exist]]
- [[Another Missing Page]]
- [[Yet Another Dead Link]]
- Inline mention of [[Dead Link in Sentence]] within text

### External Links

- [Quartz Documentation](https://quartz.jzhao.xyz/)
- [GitHub](https://github.com)
- [Example](https://example.com)

### Tag Links

#documentation #style-guide #testing #public

## Heading with [[Dead Link]]

### Subheading with [[Another Dead Link]] and #tag

Testing dead links in headings should inherit the burnt orange color.

## Text Formatting

**Bold with [[Dead Link]]**
*Italic with [[Dead Link]]*
`Code with [[Dead Link]]` (link shouldn't work in code)
~~Strikethrough with [[Dead Link]]~~

## Edge Cases

### Long Dead Link Wrapping

This is a very long paragraph with [[A Dead Link That Has A Really Long Name That Will Probably Wrap To Multiple Lines When Displayed]] to test how the new background-free styling handles text wrapping.

### Multiple Dead Links in Paragraph

The [[First Dead Link]] and [[Second Dead Link]] and [[Third Dead Link]] appear together in this sentence to test visual density and spacing.

### Dead Links in Different Contexts

- Bullet list with [[Dead Link]]
  - Nested item with [[Dead Link]]
- **Bold item** with [[Dead Link]]
- *Italic item* with [[Dead Link]]

1. Numbered list with [[Dead Link]]
2. Another item with [[Dead Link]]

### Links with Images

This tests that image links aren't affected:

![[../attachments/test-image.png]]

[[../attachments/test-document.pdf|Link to PDF]]

## Tag Testing

Multiple inline tags in one line: #tag1 #tag2 #tag3 #css-testing #link-styling

Tags in **bold** context: #bold-tag
Tags in *italic* context: #italic-tag
Tags in code context: `#code-tag` (shouldn't be a tag)
