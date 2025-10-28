# Publish Modes

This Quartz fork supports selective publishing based on frontmatter fields. This allows you to maintain one content repository but build different versions of your site with different subsets of content.

## Four-Tier Publishing System

### Level 0 - Full (vault.dario.ca)
- **Audience:** Highly restricted, private access
- **Content:** ALL notes (except drafts)
- **Frontmatter:** No frontmatter flags needed
- **Build command:** `npx quartz build --publish-mode full --baseUrl vault.dario.ca`

### Level 1 - Trusted (notes-private.dario.ca)
- **Audience:** Trusted users with broader access
- **Content:** ONLY notes with `publish: "[[Level 1 - Trusted]]"`
- **Frontmatter:** Requires `publish: "[[Level 1 - Trusted]]"` (or higher)
- **Build command:** `npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca`

### Level 2 - Shachu (shachu.dario.ca)
- **Audience:** Shachu members
- **Content:** ONLY notes with `publish: "[[Level 2 - Shachu]]"`
- **Frontmatter:** Requires `publish: "[[Level 2 - Shachu]]"` (or higher)
- **Build command:** `npx quartz build --publish-mode shachu --baseUrl shachu.dario.ca`

### Level 3 - Public (notes.dario.ca)
- **Audience:** Public, unrestricted access
- **Content:** ONLY notes with `publish: "[[Level 3 - Public]]"`
- **Frontmatter:** Requires `publish: "[[Level 3 - Public]]"`
- **Build command:** `npx quartz build --publish-mode public --baseUrl notes.dario.ca`

## Usage

### 1. Add Frontmatter to Your Markdown Files

In your Obsidian notes, add a `publish` field to control which tiers can see each note. Obsidian will render this as a dropdown for easy selection:

**Private note (vault only):**
```markdown
---
title: My Private Note
# No publish field, or publish: "" (empty)
---
```

**Trusted note (vault + trusted):**
```markdown
---
title: My Trusted Note
publish: "[[Level 1 - Trusted]]"
---
```

**Shachu note (vault + trusted + shachu):**
```markdown
---
title: My Shachu Note
publish: "[[Level 2 - Shachu]]"
---
```

**Public note (all four tiers):**
```markdown
---
title: My Public Note
publish: "[[Level 3 - Public]]"
---
```

**Note:** The publish values are hierarchical:
- `publish: "[[Level 3 - Public]]"` → appears in all 4 tiers (vault, trusted, shachu, public)
- `publish: "[[Level 2 - Shachu]]"` → appears in vault, trusted, and shachu tiers
- `publish: "[[Level 1 - Trusted]]"` → appears in vault and trusted tiers only
- No `publish` field or empty value → appears in vault tier only

The wikilink format (`[[...]]`) works great in Obsidian and makes it easy to select from a dropdown!

### 2. Draft Notes

Notes marked as drafts are NEVER published, regardless of publish mode:

```markdown
---
title: Work in Progress
draft: true
publish: "[[Level 1 - Trusted]]"
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
   - **full**: All files are published (no publish field or empty)
   - **trusted**: Only files with `publish: "[[Level 1 - Trusted]]"` (or Shachu/Public) are published
   - **shachu**: Only files with `publish: "[[Level 2 - Shachu]]"` (or Public) are published
   - **public**: Only files with `publish: "[[Level 3 - Public]]"` are published
3. The `RemoveDrafts` filter always applies first (files with `draft: true` are never published in any mode)

## Example Workflow

1. Write a note in Obsidian
2. Initially, don't add a `publish` field → note only appears on vault.dario.ca (Level 0 - Full tier)
3. When ready to share with trusted users, set `publish: "[[Level 1 - Trusted]]"` → note now appears on vault.dario.ca and notes-private.dario.ca
4. When ready to share with shachu, set `publish: "[[Level 2 - Shachu]]"` → note now appears on vault.dario.ca, notes-private.dario.ca, and shachu.dario.ca
5. When ready to share publicly, set `publish: "[[Level 3 - Public]]"` → note now appears on all four sites
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

| Publish Field | vault.dario.ca (Level 0 - Full) | notes-private.dario.ca (Level 1 - Trusted) | shachu.dario.ca (Level 2 - Shachu) | notes.dario.ca (Level 3 - Public) |
|---------------|----------------------|----------------------------------|--------------------------|-------------------------|
| (no field or empty) | ✅ | ❌ | ❌ | ❌ |
| `publish: "[[Level 1 - Trusted]]"` | ✅ | ✅ | ❌ | ❌ |
| `publish: "[[Level 2 - Shachu]]"` | ✅ | ✅ (hierarchical) | ✅ | ❌ |
| `publish: "[[Level 3 - Public]]"` | ✅ | ✅ (hierarchical) | ✅ (hierarchical) | ✅ |
| `draft: true` | ❌ | ❌ | ❌ | ❌ |

**Note:** The values are hierarchical - `publish: "[[Level 3 - Public]]"` automatically includes the note in shachu and trusted tiers. `publish: "[[Level 2 - Shachu]]"` includes it in the trusted tier.
