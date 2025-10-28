# Architecture & Deployment Guide

This document describes the complete architecture, deployment strategy, and operational details for the multi-tier Obsidian publishing system built on Quartz.

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Content & Build Separation Strategy](#content--build-separation-strategy)
4. [The Four-Tier Publishing System](#the-four-tier-publishing-system)
5. [Deployment Pipeline](#deployment-pipeline)
6. [How It All Works Together](#how-it-all-works-together)
7. [Technical Implementation Details](#technical-implementation-details)
8. [Maintenance & Future Improvements](#maintenance--future-improvements)

---

## Overview

This system publishes a single Obsidian vault to **four different websites**, each with different access levels and content visibility. The setup separates content (Obsidian vault) from the build system (Quartz fork) to maintain a clean vault structure while enabling sophisticated multi-tier publishing.

### Key Principles

1. **Single Source of Truth**: One Obsidian vault contains all content
2. **Hierarchical Access**: Four tiers from fully private to fully public
3. **Clean Separation**: Content repository separate from build tooling
4. **Automated Deployment**: Changes trigger automatic rebuilds via GitHub Actions
5. **Frontmatter-Driven**: Content visibility controlled by frontmatter fields

---

## Repository Structure

### Repository 1: obsidian-quartz-fork (This Repo)

**Purpose**: Static site builder and deployment configuration

**What it contains**:
- Forked Quartz v4 codebase with custom modifications
- Build configuration and plugins
- Layout and component customization
- **Empty or minimal `content/` folder** (content comes from the other repo)
- Deployment configuration for Cloudflare Pages

**Location**: `https://github.com/[username]/obsidian-quartz-fork`

**Key Files**:
- `quartz.config.ts` - Main Quartz configuration
- `quartz.layout.ts` - Page layout and component configuration
- `quartz/plugins/` - Custom plugins including IndexSwapper, PublishMode, and HideInBuild
- `PUBLISH_MODES.md` - Documentation for the four-tier system
- `docs-custom/` - Custom documentation (this file and related docs)

### Repository 2: obsidian-vault-backup

**Purpose**: The actual Obsidian vault containing all content

**What it contains**:
- All markdown files organized as an Obsidian vault
- Attachments, images, and other media files
- Obsidian configuration files (`.obsidian/`)
- Templates and other vault-specific content

**Location**: `https://github.com/daranguiz/obsidian-vault-backup` (private repository)

**Sync Mechanism**:
- The **Obsidian Git plugin** automatically commits and pushes changes to GitHub whenever edits are made in the Obsidian app
- This keeps the vault synchronized between local Obsidian app and GitHub

**Important Note**: This repository contains **only** the vault content, no Quartz build files. This keeps the vault clean and usable as a standard Obsidian vault.

---

## Content & Build Separation Strategy

### Why Separate Repositories?

**Problem**: Combining Quartz build files with the Obsidian vault would pollute the vault with:
- Node modules
- Build artifacts
- Configuration files
- Plugin code
- Other static site generator cruft

**Solution**: Maintain two separate repositories:
1. **obsidian-quartz-fork**: Build system, stays relatively stable
2. **obsidian-vault-backup**: Content, changes frequently

### How They Come Together

During the build process (on Cloudflare Pages), the two repositories are combined:

```bash
# 1. Start with the obsidian-quartz-fork repository (already checked out by Cloudflare)
# 2. Remove any existing content folder
rm -rf content

# 3. Clone the vault repository into the content folder
git clone --depth=1 https://x-access-token:${GH_TOKEN}@github.com/daranguiz/obsidian-vault-backup.git content

# 4. Build the site with the appropriate publish mode
npx quartz build --publish-mode [MODE] --baseUrl [URL]

# 5. Clean up oversized files (Cloudflare limitation)
find public -type f -size +25M -delete
```

This approach gives us:
- ✅ Clean Obsidian vault for daily use
- ✅ Sophisticated build system with custom plugins
- ✅ Automatic deployment on content changes
- ✅ Ability to version control both independently

---

## The Four-Tier Publishing System

The system publishes the **same content source** to **four different websites**, each with progressively more restrictive content filtering.

### Level 0 - Full (vault.dario.ca) - Most Permissive

**Audience**: Highly restricted, personal access only
**Content Included**: ALL notes (except drafts)
**Access Control**: Cloudflare Zero Trust (most restrictive)
**Frontmatter Requirement**: None - all files without `draft: true` are published

**Use Case**: Personal vault access from anywhere, complete view of all content

### Level 1 - Trusted (notes-private.dario.ca)

**Audience**: Trusted users with broader access
**Content Included**: ONLY notes with `publish: "[[Level 1 - Trusted]]"` or higher (Shachu, Public)
**Access Control**: Cloudflare Zero Trust (restricted to trusted users)
**Frontmatter Requirement**: `publish: "[[Level 1 - Trusted]]"`, `publish: "[[Level 2 - Shachu]]"`, or `publish: "[[Level 3 - Public]]"`

**Use Case**: Sharing more personal content with close friends, family, or trusted colleagues

### Level 2 - Shachu (shachu.dario.ca)

**Audience**: Shachu members
**Content Included**: ONLY notes with `publish: "[[Level 2 - Shachu]]"` or `publish: "[[Level 3 - Public]]"`
**Access Control**: Cloudflare Zero Trust (restricted to shachu members)
**Frontmatter Requirement**: `publish: "[[Level 2 - Shachu]]"` or `publish: "[[Level 3 - Public]]"`

**Use Case**: Content specific to shachu activities and members

### Level 3 - Public (notes.dario.ca) - Most Restrictive

**Audience**: General public, unrestricted access
**Content Included**: ONLY notes with `publish: "[[Level 3 - Public]]"`
**Access Control**: None - fully public
**Frontmatter Requirement**: `publish: "[[Level 3 - Public]]"`

**Use Case**: Blog posts, public documentation, content intended for wide distribution

### Hierarchical Publishing Matrix

| Frontmatter Value | vault.dario.ca (Level 0 - Full) | notes-private.dario.ca (Level 1 - Trusted) | shachu.dario.ca (Level 2 - Shachu) | notes.dario.ca (Level 3 - Public) |
|-------------------|----------------------|----------------------------------|--------------------------|-------------------------|
| (no field or empty) | ✅ Published | ❌ Filtered | ❌ Filtered | ❌ Filtered |
| `publish: "[[Level 1 - Trusted]]"` | ✅ Published | ✅ Published | ❌ Filtered | ❌ Filtered |
| `publish: "[[Level 2 - Shachu]]"` | ✅ Published | ✅ Published (hierarchical) | ✅ Published | ❌ Filtered |
| `publish: "[[Level 3 - Public]]"` | ✅ Published | ✅ Published (hierarchical) | ✅ Published (hierarchical) | ✅ Published |
| `draft: true` | ❌ Filtered | ❌ Filtered | ❌ Filtered | ❌ Filtered |

**Note**: The hierarchy means that `publish: "[[Level 3 - Public]]"` automatically makes content visible in all four tiers. Each tier includes its own level plus all higher (more public) levels.

### Index Files Per Tier

Each tier can have its own custom landing page:

- `content/index.md` - Level 0 - Full tier (vault.dario.ca) - No publish field
- `content/index-trusted.md` - Level 1 - Trusted tier - `publish: "[[Level 1 - Trusted]]"`
- `content/index-shachu.md` - Level 2 - Shachu tier - `publish: "[[Level 2 - Shachu]]"`
- `content/index-public.md` - Level 3 - Public tier - `publish: "[[Level 3 - Public]]"`

The **IndexSwapper** plugin automatically:
1. Selects the correct index file for the current publish mode
2. Renames it to `index` to become the landing page
3. Filters out all other index variants completely (they won't appear in sidebars or navigation)

---

## Deployment Pipeline

### Overview

Each tier has its own Cloudflare Pages project, all connected to the same repositories but with different build configurations.

### Cloudflare Pages Projects (4 total)

Each project is configured identically except for the build command:

#### Project 1: vault.dario.ca (Full Tier)

**Build Command**:
```bash
npm install -g npm@latest && rm -rf content && git clone --depth=1 https://x-access-token:${GH_TOKEN}@github.com/daranguiz/obsidian-vault-backup.git content && npx quartz build --publish-mode full --baseUrl vault.dario.ca && find public -type f -size +25M -delete
```

**Access**: Cloudflare Zero Trust - Highly restricted
**Output Directory**: `public`
**Connected Repository**: obsidian-quartz-fork

#### Project 2: notes-private.dario.ca (Trusted Tier)

**Build Command**:
```bash
npm install -g npm@latest && rm -rf content && git clone --depth=1 https://x-access-token:${GH_TOKEN}@github.com/daranguiz/obsidian-vault-backup.git content && npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca && find public -type f -size +25M -delete
```

**Access**: Cloudflare Zero Trust - Restricted to trusted users
**Output Directory**: `public`
**Connected Repository**: obsidian-quartz-fork

#### Project 3: shachu.dario.ca (Shachu Tier)

**Build Command**:
```bash
npm install -g npm@latest && rm -rf content && git clone --depth=1 https://x-access-token:${GH_TOKEN}@github.com/daranguiz/obsidian-vault-backup.git content && npx quartz build --publish-mode shachu --baseUrl shachu.dario.ca && find public -type f -size +25M -delete
```

**Access**: Cloudflare Zero Trust - Restricted to shachu members
**Output Directory**: `public`
**Connected Repository**: obsidian-quartz-fork

#### Project 4: notes.dario.ca (Public Tier)

**Build Command**:
```bash
npm install -g npm@latest && rm -rf content && git clone --depth=1 https://x-access-token:${GH_TOKEN}@github.com/daranguiz/obsidian-vault-backup.git content && npx quartz build --publish-mode public --baseUrl notes.dario.ca && find public -type f -size +25M -delete
```

**Access**: Fully public, no restrictions
**Output Directory**: `public`
**Connected Repository**: obsidian-quartz-fork

### Build Command Breakdown

Each build command follows the same pattern:

```bash
# 1. Update npm to latest version
npm install -g npm@latest

# 2. Remove any existing content folder
&& rm -rf content

# 3. Clone the vault repository (shallow clone for speed)
#    Uses GitHub token for authentication (set in Cloudflare environment variables)
&& git clone --depth=1 https://x-access-token:${GH_TOKEN}@github.com/daranguiz/obsidian-vault-backup.git content

# 4. Build the site with the specific publish mode and base URL
&& npx quartz build --publish-mode [MODE] --baseUrl [URL]

# 5. Delete files larger than 25MB (Cloudflare Pages limitation)
&& find public -type f -size +25M -delete
```

### Environment Variables

Each Cloudflare Pages project requires:

- `GH_TOKEN`: GitHub Personal Access Token with read access to the private obsidian-vault-backup repository
- Configured in Cloudflare Pages project settings under Environment Variables

### Trigger Mechanisms

Each site rebuilds in two scenarios:

#### Trigger 1: Changes to obsidian-quartz-fork

- Someone pushes changes to the obsidian-quartz-fork repository
- Cloudflare Pages automatically detects the change (native integration)
- All four projects rebuild with the updated build configuration

**Use Case**: Updating plugins, changing layouts, modifying build system

#### Trigger 2: Changes to obsidian-vault-backup

- User edits content in Obsidian app
- Obsidian Git plugin automatically commits and pushes to GitHub
- GitHub Actions workflow in obsidian-vault-backup triggers
- Workflow hits Cloudflare Pages deploy hooks for all four projects
- All four projects rebuild with updated content

**Use Case**: Daily content updates, new notes, editing existing notes

### GitHub Actions Setup (in obsidian-vault-backup)

The vault repository has a GitHub Actions workflow that triggers Cloudflare rebuilds:

**File**: `.github/workflows/deploy-to-pages.yaml`

**Key Features**:
- Triggers on pushes to `main` branch
- Only rebuilds when content files change (`.md`, images, PDFs, etc.)
- Skips `README.md` changes
- Includes 120-second debounce window to batch rapid commits
- Supports manual triggering via `workflow_dispatch`
- Cancels in-progress builds if new commits arrive
- Includes error checking for missing secrets

**Secrets Required** (stored in vault repository settings):
- `CF_PAGES_HOOK_URL` - Deploy hook for vault.dario.ca (Full tier)
- `CF_PAGES_PRIVATE_HOOK_URL` - Deploy hook for notes-private.dario.ca (Trusted tier)
- `CF_PAGES_SHACHU_HOOK_URL` - Deploy hook for shachu.dario.ca (Shachu tier)
- `CF_PAGES_PUBLIC_HOOK_URL` - Deploy hook for notes.dario.ca (Public tier) *(see FUTURE_TASKS.md - currently not implemented)*

**Deploy Hooks**: Each Cloudflare Pages project provides a deploy hook URL found in:
Cloudflare Dashboard → Pages → [Project] → Settings → Builds & deployments → Deploy Hooks

**Debounce Strategy**: The workflow waits 120 seconds after a push before triggering rebuilds. This prevents unnecessary builds when you make multiple rapid edits (common with Obsidian Git plugin's auto-commit feature).

---

## How It All Works Together

### The Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. User edits content in Obsidian app                         │
│     └─> Obsidian Git plugin auto-commits and pushes            │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  2. GitHub receives push to obsidian-vault-backup              │
│     └─> GitHub Actions workflow starts                         │
│         └─> Sends POST requests to 4 Cloudflare deploy hooks   │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  3. Cloudflare Pages receives deploy hooks (4 projects)        │
│     └─> Each project starts its build process in parallel      │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  4. Build Process (runs 4 times, once per project)             │
│     a. Clone obsidian-quartz-fork (automatic)                  │
│     b. Run build command:                                       │
│        - Update npm                                             │
│        - Delete existing content folder                         │
│        - Clone vault repository into content folder             │
│        - Run `npx quartz build --publish-mode [MODE]`           │
│        - Delete files over 25MB                                 │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  5. Quartz Build Process (per project)                         │
│     a. Parse all markdown files in content/                     │
│     b. Apply filter plugins:                                    │
│        - RemoveDrafts: Filter out draft: true                   │
│        - IndexSwapper: Swap index files, filter unused ones     │
│        - PublishMode: Filter by publish frontmatter field       │
│     c. Transform content (syntax highlighting, links, etc.)     │
│     d. Generate static HTML files                               │
│     e. Create contentIndex.json for client-side features        │
│     f. Copy assets and static files                             │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  6. Deployment (per project)                                    │
│     └─> public/ folder uploaded to Cloudflare Pages CDN        │
│         └─> Site goes live at its respective domain            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Result: 4 websites, same content source, different visibility levels
```

### Daily Usage Flow

**For the content author (you)**:

1. Open Obsidian app
2. Edit notes as normal
3. Add/update `publish` frontmatter field to control visibility
4. Save (Obsidian Git plugin auto-commits)
5. Wait ~2-5 minutes for all sites to rebuild
6. Changes live on all applicable tiers

**No manual deployment needed!**

---

## Technical Implementation Details

### Custom Features in This Fork

This fork includes several custom features not present in upstream Quartz.

#### Custom Plugins

##### 1. PublishMode Filter Plugin (CUSTOM)

**Location**: `quartz/plugins/filters/publishMode.ts`

**Purpose**: Filters content based on the `publish` frontmatter field and current publish mode

**How it works**:
- Reads `QUARTZ_PUBLISH_MODE` environment variable (set via `--publish-mode` CLI flag)
- Checks each file's `publish` frontmatter field
- Returns `true` (publish) or `false` (filter out) based on hierarchical rules
- Supports wikilink format: `[[Level 3 - Public]]`, `[[Level 2 - Shachu]]`, `[[Level 1 - Trusted]]`

**Example**:
```typescript
// In trusted mode
publish: "[[Level 1 - Trusted]]" → ✅ Published
publish: "[[Level 2 - Shachu]]"  → ✅ Published (hierarchical)
publish: "[[Level 3 - Public]]"  → ✅ Published (hierarchical)
(no field)                        → ❌ Filtered
```

**Status**: Completely custom to this fork

##### 2. IndexSwapper Filter Plugin (CUSTOM)

**Location**: `quartz/plugins/filters/indexSwapper.ts`

**Purpose**: Manages tier-specific index/landing pages

**How it works**:
1. Identifies which index file matches the current publish mode:
   - `full` mode → uses `index.md`
   - `trusted` mode → uses `index-trusted.md`
   - `shachu` mode → uses `index-shachu.md`
   - `public` mode → uses `index-public.md`

2. Renames the selected index file's slug to `index` (becomes landing page)

3. Updates its `publish` frontmatter to match the current mode (ensures it passes PublishMode filter)

4. Filters out ALL other index variants (returns `false` for their `shouldPublish`)

**Result**: Each tier gets its own custom landing page, and unused index files are completely hidden

**Status**: Completely custom to this fork

##### 3. RemoveDrafts Filter Plugin (UPSTREAM)

**Location**: `quartz/plugins/filters/draft.ts`

**Purpose**: Filters out any file with `draft: true` in frontmatter

**Applies to**: ALL publish modes (drafts never published anywhere)

**Status**: Standard Quartz plugin (not custom)

#### Custom Transformer Plugins

##### HideInBuild Transformer Plugin (CUSTOM)

**Location**: `quartz/plugins/transformers/hideInBuild.ts`

**Purpose**: Conditionally removes content from markdown files based on publish mode using HTML comment markers

**How it works**:
- Runs early in the transformer chain (right after FrontMatter parsing)
- Detects HTML comment markers in markdown content: `<!-- hide-in-build -->` and `<!-- /hide-in-build -->`
- Removes content between markers based on the current `QUARTZ_PUBLISH_MODE`
- Supports parameterized hiding to specify which modes should hide the content

**Syntax**:

```markdown
<!-- hide-in-build -->
This content is hidden in ALL modes except "full"
<!-- /hide-in-build -->

<!-- hide-in-build:public,shachu,trusted -->
This content is ONLY visible in "full" mode
(explicitly hidden from public, shachu, and trusted)
<!-- /hide-in-build -->

<!-- hide-in-build:public -->
This content is visible in full, trusted, and shachu
(only hidden from public)
<!-- /hide-in-build -->
```

**Default behavior** (no mode parameter): Hide in all modes except `full`

**Use cases**:
- Hide Obsidian Dataview queries that don't render properly in static output
- Remove internal notes or metadata visible only in your full vault
- Hide work-in-progress content from public/shared tiers while keeping it in private tier
- Conditionally show/hide content based on audience tier

**Example**:
```markdown
---
title: My Index Page
publish: "[[Level 3 - Public]]"
---

# Welcome

This introduction is visible to everyone.

<!-- hide-in-build -->
## Internal Notes

These are my private Dataview queries and internal links:
- dataview query here
- internal planning notes
<!-- /hide-in-build -->

This conclusion is also visible to everyone.
```

**Processing order**: Runs BEFORE markdown is converted to HTML, so it works at the text level

**Status**: Completely custom to this fork

#### Custom UI Features

##### Frontmatter Properties Display (CUSTOM)

**Location**: `quartz/components/FrontmatterProperties.tsx`

**What it does**: Renders a visible panel at the top of each page showing all frontmatter metadata (title, tags, custom fields, etc.)

**Visibility**: **Only shown on the Full tier** (vault.dario.ca). Hidden on all other tiers (Trusted, Shachu, Public).

**Example** (Full tier only):
```
┌─────────────────────────┐
│ title: My Note          │
│ tags: [foo, bar]        │
│ created: 2025-10-26     │
└─────────────────────────┘
```

**Rationale**: Frontmatter is internal metadata useful for vault management but shouldn't be exposed to external audiences.

**Implementation**: The component checks `process.env.QUARTZ_PUBLISH_MODE` and returns `null` (nothing) if the mode is not "full":
```typescript
// In FrontmatterProperties component
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"
if (publishMode !== "full") {
  return null  // Don't render anything
}
```

**Status**: This feature is completely custom to this fork. Upstream Quartz does NOT display frontmatter properties as a visible panel.

**Configuration**: Added to page layouts in `quartz.layout.ts`:
```typescript
beforeBody: [
  Component.FrontmatterProperties(),  // Custom feature
  // ...
]
```

**Note**: The `publish` field itself is already filtered out of the display (see lines 325-329) so it never appears even in the Full tier.

##### Tiered Orphaned Link Styling (CUSTOM)

**What it does**: Internal links that point to non-existent pages are styled differently depending on the publish mode.

**Purpose**:
- On the **Full tier**: Makes it obvious which links are broken or point to filtered-out content
- On **non-Full tiers** (Trusted, Shachu, Public): Hides the fact that links are broken to avoid exposing the existence of private content

**Visual Behavior by Tier**:
- **Full tier**:
  - Blue link with highlight → Page exists
  - Faded blue link → Page doesn't exist (404 or filtered out)
  - Orange `.dead-link` class → Missing page (in FrontmatterProperties)
- **Non-Full tiers** (Trusted, Shachu, Public):
  - Blue link with highlight → Page exists
  - Plain text (no styling) → Page doesn't exist
  - Non-clickable, looks like regular body text

**Status**: Completely custom to this fork. Upstream Quartz may style broken links differently, but the tiered behavior is entirely custom.

**Implementation**:
- CSS conditional styling using `body[data-publish-mode]` attribute selector
- Broken links (`.internal.broken` class) styled differently per tier
- Dead links (`.dead-link` class in FrontmatterProperties) styled differently per tier
- Files modified:
  - [quartz/components/renderPage.tsx:235-239](quartz/components/renderPage.tsx#L235-L239) - Adds `data-publish-mode` attribute to body
  - [quartz/styles/base.scss:93-116](quartz/styles/base.scss#L93-L116) - Conditional `.internal.broken` styling
  - [quartz/styles/custom.scss:5-27](quartz/styles/custom.scss#L5-L27) - Conditional `.dead-link` styling

### Plugin Execution Order

The order matters! Plugins run in the sequence defined in `quartz.config.ts`:

```typescript
filters: [
  Plugin.RemoveDrafts(),      // 1. Remove drafts first (universal)
  Plugin.IndexSwapper(),      // 2. Swap index files and set publish field
  Plugin.PublishMode({...}),  // 3. Filter by publish mode (reads field set by IndexSwapper)
]
```

### Client-Side Filtering (Defense in Depth)

**Location**: `quartz.layout.ts`

The Explorer component (sidebar file tree) has an additional client-side filter:

```typescript
Component.Explorer({
  filterFn: (node) => {
    // Exclude tags folder and unused index files
    if (node.slugSegment === "tags") return false
    // Exclude index-trusted, index-shachu, index-public files
    if (node.slug?.match(/^index-(trusted|shachu|public)$/)) return false
    return true
  },
})
```

**Why**: Defense in depth. Even if server-side filtering fails, these files won't appear in the sidebar.

### Base URL Configuration

Each build uses `--baseUrl` to set the correct domain:

```bash
npx quartz build --publish-mode full --baseUrl vault.dario.ca
```

This ensures:
- Correct canonical URLs in meta tags
- Proper sitemap generation
- Correct RSS feed URLs
- Absolute links point to the right domain

### File Size Limitation Workaround

Cloudflare Pages has a 25MB file size limit. The build command handles this:

```bash
find public -type f -size +25M -delete
```

**Current approach**: Delete oversized files (they return 404)

**Future improvement**: Move large files to a CDN and update links

---

## Maintenance & Future Improvements

### Current Limitations

1. **Large File Handling**: Files over 25MB are deleted during build
   - **Solution**: Set up a CDN (Cloudflare R2, AWS S3, etc.) and update links
   - **Implementation**: Add a transformer plugin to detect and rewrite large file links

2. **Build Time**: All four sites rebuild on every content change
   - **Current**: ~2-5 minutes total (all sites in parallel)
   - **Optimization**: Could implement incremental builds or smarter deploy hooks

3. **Configuration Duplication**: Each tier has identical configuration except publish mode
   - **Future**: Could support tier-specific themes, layouts, or component configurations

### Potential Future Enhancements

#### 1. Tier-Specific Configuration

Each tier could have different visual themes, enabled features, or component layouts:

```typescript
// Pseudocode - not currently implemented
const tierConfigs = {
  full: { theme: "dark", enableGraph: true },
  trusted: { theme: "light", enableGraph: true },
  shachu: { theme: "custom", enableGraph: false },
  public: { theme: "minimal", enableGraph: false }
}
```

#### 2. Build Optimization

- Implement caching for unchanged content
- Use Cloudflare's incremental static regeneration
- Only rebuild affected tiers when content changes affect specific levels

#### 3. Analytics Per Tier

Track usage separately for each tier:
- Which tier gets the most traffic?
- What content is most popular at each level?
- Are users accessing higher tiers appropriately?

#### 4. Automated Testing

GitHub Actions could:
- Verify frontmatter syntax before deploy
- Test that each tier includes expected content
- Check for broken links within each tier
- Validate that hierarchical publishing works correctly

### Updating the System

#### To update the build system (Quartz fork):

1. Make changes in obsidian-quartz-fork repository
2. Test locally: `npx quartz build --serve`
3. Commit and push to GitHub
4. All four Cloudflare projects automatically rebuild

#### To update content:

1. Edit in Obsidian app
2. Obsidian Git plugin auto-commits
3. GitHub Actions triggers all four rebuilds
4. Sites update automatically

#### To add a new tier:

1. Add new publish mode to `publishMode.ts`
2. Update `IndexSwapper` to recognize new index file pattern
3. Create new Cloudflare Pages project
4. Configure build command with new mode
5. Add deploy hook to GitHub Actions workflow
6. Create tier-specific index file in vault

### Access Control Configuration

The three restricted tiers (Full, Trusted, Shachu) use **Cloudflare Zero Trust** for access control.

**Authentication Method**: Google Auth (OAuth)

**Configuration Location**:
Cloudflare Dashboard → Zero Trust → Access → Applications

**Setup Per Tier**:

1. **Full Tier (vault.dario.ca)**:
   - Most restrictive - typically only the vault owner
   - Policy: Allow specific Google account(s)
   - Session duration: As needed (e.g., 24 hours)

2. **Trusted Tier (notes-private.dario.ca)**:
   - Restricted to trusted users
   - Policy: Allow specific Google accounts (trusted friends, family, colleagues)
   - Can use Google Groups for easier management

3. **Shachu Tier (shachu.dario.ca)**:
   - Restricted to shachu members
   - Policy: Allow specific Google accounts of shachu members
   - May overlap with trusted tier users

4. **Public Tier (notes.dario.ca)**:
   - No access control - fully public
   - No Cloudflare Zero Trust policy needed

**Adding/Removing Users**:
1. Go to Cloudflare Zero Trust → Access → Applications
2. Select the relevant application (vault.dario.ca, notes-private.dario.ca, etc.)
3. Edit the access policy
4. Add/remove email addresses or Google Groups
5. Save changes (takes effect immediately)

**User Experience**: When a user visits a protected tier, they:
1. See Cloudflare Access login page
2. Click "Sign in with Google"
3. Authenticate with their Google account
4. If authorized, gain access to the site
5. Session persists based on configured duration

### Troubleshooting

**Sites not updating after content change?**
- Check GitHub Actions workflow in vault repository (look for green checkmarks)
- Verify deploy hooks are configured correctly in Cloudflare
- Check Cloudflare Pages build logs for each project
- Verify the 120-second debounce completed

**Wrong content appearing on a tier?**
- Verify `publish` frontmatter field is set correctly (use wikilink format: `[[Level 3 - Public]]`)
- Check that PublishMode plugin logic matches expectations
- Review build logs to see how many files were filtered
- Remember the hierarchy: Level 3 - Public content appears on all tiers

**Build failing?**
- Check that `GH_TOKEN` environment variable is set in Cloudflare Pages project settings
- Verify token has access to private vault repository (obsidian-vault-backup)
- Review Cloudflare Pages build logs for specific errors
- Check for files over 25MB that might cause issues

**Index page not swapping correctly?**
- Ensure tier-specific index files exist with correct frontmatter:
  - `index.md` - no publish field
  - `index-trusted.md` - `publish: "[[Level 1 - Trusted]]"`
  - `index-shachu.md` - `publish: "[[Level 2 - Shachu]]"`
  - `index-public.md` - `publish: "[[Level 3 - Public]]"`
- Check IndexSwapper plugin is before PublishMode in filter chain (see `quartz.config.ts`)
- Verify index files have appropriate `publish` values

**User can't access a restricted tier?**
- Verify their Google account email is in the Cloudflare Zero Trust access policy
- Check that the access policy is active (not paused)
- Have them clear cookies and try again
- Check Cloudflare Zero Trust logs for denied access attempts

---

## Summary

This architecture enables:

- ✅ **Single source of truth**: One Obsidian vault for all content
- ✅ **Clean separation**: Vault stays pristine, build system separate
- ✅ **Hierarchical publishing**: Four tiers from private to public
- ✅ **Automatic deployment**: Changes propagate to all sites automatically
- ✅ **Flexible control**: Frontmatter-driven content visibility
- ✅ **Custom landing pages**: Different index for each tier
- ✅ **Scalable**: Easy to add new tiers or modify existing ones

The system multiplies a single content source by four (currently), creating completely different websites from the same markdown files through intelligent filtering and custom Quartz plugins.
