# Publish Modes

This Quartz fork supports selective publishing based on frontmatter fields. This allows you to maintain one content repository but build different versions of your site with different subsets of content.

## Four-Tier Publishing System

### Tier 1: Full (vault.dario.ca)
- **Audience:** Highly restricted, private access
- **Content:** ALL notes (except drafts)
- **Frontmatter:** No frontmatter flags needed
- **Build command:** `npx quartz build --publish-mode full --baseUrl vault.dario.ca`

### Tier 2: Trusted (notes-private.dario.ca)
- **Audience:** Trusted users with broader access
- **Content:** ONLY notes with `publish-trusted: true`
- **Frontmatter:** Requires `publish-trusted: true`
- **Build command:** `npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca`

### Tier 3: Shachu (shachu.dario.ca)
- **Audience:** Shachu members
- **Content:** ONLY notes with `publish-shachu: true`
- **Frontmatter:** Requires `publish-shachu: true`
- **Build command:** `npx quartz build --publish-mode shachu --baseUrl shachu.dario.ca`

### Tier 4: Public (notes.dario.ca)
- **Audience:** Public, unrestricted access
- **Content:** ONLY notes with `publish-public: true`
- **Frontmatter:** Requires `publish-public: true`
- **Build command:** `npx quartz build --publish-mode public --baseUrl notes.dario.ca`

## Usage

### 1. Add Frontmatter to Your Markdown Files

In your Obsidian notes, add frontmatter flags to control which tiers can see each note:

**Private note (full only):**
```markdown
---
title: My Private Note
---
```

**Trusted note (full + trusted):**
```markdown
---
title: My Trusted Note
publish-trusted: true
---
```

**Shachu note (full + trusted + shachu):**
```markdown
---
title: My Shachu Note
publish-shachu: true
---
```

**Public note (full + trusted + shachu + public):**
```markdown
---
title: My Public Note
publish-public: true
---
```

**Note:** The publish flags are hierarchical. Setting `publish-public: true` automatically includes the note in shachu and trusted tiers. Setting `publish-shachu: true` includes it in the trusted tier. You don't need to set multiple flags.

### 2. Draft Notes

Notes marked as drafts are NEVER published, regardless of publish mode:

```markdown
---
title: Work in Progress
draft: true
publish-trusted: true
---
```

This note will not appear in ANY tier until you remove `draft: true`.

## Cloudflare Pages Setup

Configure four separate Cloudflare Pages projects, all pulling from the same repositories:

### Full Site (vault.dario.ca)
- **Build command:** `npx quartz build --publish-mode full --baseUrl vault.dario.ca`
- **Output directory:** `public`
- **Access:** Highly restricted via Cloudflare Zero Trust
- **Content:** All notes (except drafts)

### Trusted Site (notes-private.dario.ca)
- **Build command:** `npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca`
- **Output directory:** `public`
- **Access:** Restricted to trusted users via Cloudflare Zero Trust
- **Content:** Only notes with `publish-trusted: true`

### Shachu Site (shachu.dario.ca)
- **Build command:** `npx quartz build --publish-mode shachu --baseUrl shachu.dario.ca`
- **Output directory:** `public`
- **Access:** Restricted to shachu members via Cloudflare Zero Trust
- **Content:** Only notes with `publish-shachu: true`

### Public Site (notes.dario.ca)
- **Build command:** `npx quartz build --publish-mode public --baseUrl notes.dario.ca`
- **Output directory:** `public`
- **Access:** Fully public, no restrictions
- **Content:** Only notes with `publish-public: true`

All four projects pull from the same repositories (obsidian-vault and this Quartz repo).

## How It Works

1. The `PublishMode` filter plugin checks frontmatter for the appropriate publish flag
2. Depending on the mode:
   - **full**: All files are published (no filtering by publish flags)
   - **trusted**: Only files with `publish-trusted: true`, `publish-shachu: true`, or `publish-public: true` are published
   - **shachu**: Only files with `publish-shachu: true` or `publish-public: true` are published
   - **public**: Only files with `publish-public: true` are published
3. The `RemoveDrafts` filter always applies first (files with `draft: true` are never published in any mode)

## Example Workflow

1. Write a note in Obsidian
2. Initially, don't add any publish flags → note only appears on vault.dario.ca (full tier)
3. When ready to share with trusted users, add `publish-trusted: true` → note now appears on vault.dario.ca and notes-private.dario.ca
4. When ready to share with shachu, add `publish-shachu: true` → note now appears on vault.dario.ca, notes-private.dario.ca, and shachu.dario.ca
5. When ready to share publicly, add `publish-public: true` → note now appears on all four sites
6. All four Cloudflare Pages projects will rebuild automatically when you push to git

## Adding More Modes

To add additional publish modes (e.g., `internal-publish`):

1. Edit [quartz/plugins/filters/publishMode.ts](quartz/plugins/filters/publishMode.ts)
2. Add the new mode to the type union
3. Add a condition in the `shouldPublish` function
4. Update [quartz/cli/args.js](quartz/cli/args.js) to add it to the choices array

## Technical Details

- Filter plugin: [quartz/plugins/filters/publishMode.ts](quartz/plugins/filters/publishMode.ts)
- CLI argument handling: [quartz/cli/args.js](quartz/cli/args.js) and [quartz/cli/handlers.js](quartz/cli/handlers.js)
- Config: [quartz.config.ts](quartz.config.ts)
- The publish mode is passed via the `QUARTZ_PUBLISH_MODE` environment variable

## Content Visibility Matrix

| Note Type | vault.dario.ca (full) | notes-private.dario.ca (trusted) | shachu.dario.ca (shachu) | notes.dario.ca (public) |
|-----------|----------------------|----------------------------------|--------------------------|-------------------------|
| No frontmatter | ✅ | ❌ | ❌ | ❌ |
| `publish-trusted: true` | ✅ | ✅ | ❌ | ❌ |
| `publish-shachu: true` | ✅ | ✅ (hierarchical) | ✅ | ❌ |
| `publish-public: true` | ✅ | ✅ (hierarchical) | ✅ (hierarchical) | ✅ |
| `draft: true` | ❌ | ❌ | ❌ | ❌ |

**Note:** The flags are hierarchical - `publish-public: true` automatically includes the note in shachu and trusted tiers. `publish-shachu: true` includes it in the trusted tier.
