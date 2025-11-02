---
title: Test Content Set - README
publish: "[[Level 3 - Public]]"
---

# Test Content Set

**Purpose**: Fast development iteration for Quartz styling and feature development

## Overview

This directory contains a minimal but comprehensive test content set designed to:

- **Build quickly** (< 10 seconds vs 2+ minutes for full vault)
- **Test all features** comprehensively
- **Mimic real vault structure** authentically
- **Enable rapid iteration** during development

## Structure

```
content-test/
├── index.md                    # Home page (Public)
├── Projects/                   # Project notes
│   ├── Project Alpha.md       # Public project
│   └── Project Beta.md        # Trusted project
├── Reference/                  # Reference materials
│   ├── Style Guide.md         # Public (comprehensive link testing)
│   └── Trusted Info.md        # Trusted tier
├── Tea Resources/              # Tea-related content (mirrors real vault)
│   ├── 紙片 (Shihen)/
│   │   └── Chakai Host Manner.md  # Public shihen
│   └── Temae Reference/
│       └── Usucha.md          # Trusted temae
├── Tea Activities/
│   └── Teaching Log/
│       └── 2024-Lesson-1.md   # Shachu teaching log
├── Okeiko Notes/
│   └── 2024-Practice-Session.md  # Public practice note
├── Daily Notes/
│   ├── 2024-01-15.md          # Public daily
│   └── 2024-06-10-Practice.md # Public daily with cross-refs
├── Archive/
│   └── Old Project.md         # Shachu archived content
├── Orphaned.md                 # Unpublished, no incoming links
├── attachments/                # Non-markdown files
│   └── test-readme.md
└── README.md                   # This file

Total: ~15-20 markdown files across multiple directories
```

## Test Coverage

### Publish Tiers ✓
- **Level 3 - Public**: index, Style Guide, Project Alpha, Okeiko Notes, Daily Notes
- **Level 1 - Trusted**: Project Beta, Usucha, Trusted Info
- **Level 2 - Shachu**: Teaching Log, Old Project
- **Unpublished (Level 0)**: Orphaned.md

### Link Types ✓
- **Working internal links**: Cross-folder, same-folder, parent/child
- **Dead links**: Throughout all files for styling testing
- **External links**: HTTP/HTTPS links
- **Tag links**: Inline tags with # prefix
- **Image links**: Excluded from dead link styling
- **Links in headings**: Test color inheritance
- **Links in lists**: Bullet and numbered
- **Links in tables**: Markdown table cells
- **Long wrapping links**: Test text flow without background

### Content Features ✓
- **Frontmatter variations**: Different field combinations
- **Inline tags**: Multiple tags per line #tag1 #tag2
- **Code blocks**: TypeScript, bash, etc.
- **Blockquotes**: Single and multi-line
- **Lists**: Nested, tasks, bullet, numbered
- **Tables**: With links and formatting
- **Headings**: H1-H6 with links and tags
- **Text formatting**: Bold, italic, code, strikethrough with links

### Tier Testing Scenarios ✓
- **Orphaned files**: Files with no incoming links (filtered by tier)
- **Cross-tier references**: Public→Trusted→Shachu→Unpublished links
- **Dead links per tier**: Links become dead when target is filtered
- **Attachment handling**: Non-markdown files

### Directory Structure ✓
- **Nested folders**: Multi-level directory hierarchy
- **Special characters**: Japanese characters in folder names (紙片)
- **Multiple note types**: Shihen, Temae, Teaching, Okeiko, Daily
- **Cross-folder links**: ../relative paths between sections

## Usage

### Development Testing

```bash
# Quick build for styling iteration
npx quartz build --content content-test --publish-mode full --serve

# Test specific tier
npx quartz build --content content-test --publish-mode public
npx quartz build --content content-test --publish-mode trusted
npx quartz build --content content-test --publish-mode shachu

# With local server
npx quartz build --content content-test --publish-mode full --serve
```

**Build time**: ~5-10 seconds (vs 2+ minutes for full vault)

### What to Test

1. **Link styling (current feature)**:
   - Open Style Guide.md - comprehensive dead link examples
   - Check full tier vs public tier for dead link appearance
   - Verify burnt orange (#cc5500) color with no background
   - Test internal link background options

2. **Tier filtering**:
   - Build public tier: Project Beta should be missing
   - Build trusted tier: Project Beta should appear
   - Check orphaned file handling

3. **Tag display**:
   - Inline tags throughout files
   - Tags in various contexts (headings, lists, paragraphs)

4. **Cross-references**:
   - Daily Notes ↔ Okeiko Notes
   - Tea Resources ↔ Teaching Log
   - Multi-level folder navigation

## Files for Specific Testing

| Test Goal | Recommended File |
|-----------|------------------|
| Dead link styling | Reference/Style Guide.md |
| Tier-based dead links | Projects/Project Beta.md |
| Cross-folder links | Okeiko Notes/2024-Practice-Session.md |
| Inline tags | Daily Notes/2024-06-10-Practice.md |
| Long wrapping links | Reference/Style Guide.md |
| Orphaned files | Orphaned.md |
| Japanese characters | Tea Resources/紙片 (Shihen)/ |
| Multiple note types | Any Tea Resources file |

## Adding More Test Content

When adding files:

1. **Use realistic frontmatter** from real vault
2. **Include dead links** for styling testing
3. **Mix publish tiers** for tier testing
4. **Add cross-references** to existing files
5. **Include inline tags** #like-this
6. **Vary content depth** (short and long pages)

## Maintenance

- **Keep file count low** (< 30 files) for fast builds
- **Update when adding features** that need new test cases
- **Mirror real vault structure** but simplified
- **Document new test scenarios** in this README

## Integration with Development Workflow

This test set should be used for:

- ✓ **In-the-loop testing** during active development
- ✓ **Rapid styling iteration** (CSS changes)
- ✓ **Feature validation** before full vault testing
- ✓ **CI/CD testing** (if automated)
- ✗ **Production builds** (use real vault)

Always test with real vault before deploying to production.

---

**Created**: 2025-11-02
**Purpose**: Feature 006-link-styling and future development
**Maintained by**: Development team
