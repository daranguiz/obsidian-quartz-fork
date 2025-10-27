# Claude Code Assistant Guide

This document provides guidance for AI assistants (like Claude) working on this codebase. It explains conventions, where to find things, and how to maintain documentation.

---

## Core Principles

### 1. Documentation is a Living System

**CRITICAL**: The documentation must ALWAYS be kept up to date.

- **ARCHITECTURE.md is a living document**: Any time you implement a new feature, modify the architecture, or change how the system works, you MUST update [ARCHITECTURE.md](ARCHITECTURE.md)
- Don't let documentation drift from reality
- If you're unsure whether something needs documentation, err on the side of documenting it

### 2. Create Feature Documentation

For every major feature implemented:

1. **Update ARCHITECTURE.md** with the feature details in the appropriate section
2. **Create a dedicated feature document** (if substantial) in this `docs-custom/` folder
3. **Update FUTURE_TASKS.md** by moving the completed task to the "Completed Tasks" section
4. **Update README.md** if the new feature warrants mention

**Example**: When we implemented IndexSwapper:
- Added section to ARCHITECTURE.md explaining how it works
- Could have created `INDEX_SWAPPING.md` if it was more complex
- Would move "Index File Swapping System" from TODO to completed in FUTURE_TASKS.md

### 3. Task Tracking

Use the **TodoWrite** tool to track progress during complex multi-step tasks. This helps:
- Keep work organized
- Show the user what you're doing
- Ensure nothing gets forgotten
- Provide visibility into progress

Clean up todos when they're no longer relevant.

---

## Repository Structure

### Key Directories

```
obsidian-quartz-fork/
├── quartz/                          # Main Quartz source code
│   ├── plugins/
│   │   ├── filters/                 # Filter plugins (run during build)
│   │   │   ├── publishMode.ts      # CUSTOM: Multi-tier filtering
│   │   │   ├── indexSwapper.ts     # CUSTOM: Index file swapping
│   │   │   └── draft.ts            # UPSTREAM: Draft filtering
│   │   ├── transformers/            # Transform markdown to HTML
│   │   └── emitters/                # Generate output files
│   ├── components/                  # React components for pages
│   │   ├── FrontmatterProperties.tsx  # CUSTOM: Shows metadata panel
│   │   └── Explorer.tsx             # File tree sidebar
│   ├── styles/                      # CSS styling
│   └── util/                        # Utility functions
├── content/                         # USUALLY EMPTY (gets cloned during build)
├── docs/                            # Upstream Quartz documentation
├── docs-custom/                     # OUR CUSTOM DOCUMENTATION (this folder)
│   ├── ARCHITECTURE.md              # Complete system documentation
│   ├── PUBLISH_MODES.md             # Quick reference for tiers
│   ├── FUTURE_TASKS.md              # Planned improvements
│   ├── CLAUDE.md                    # This file
│   └── README.md                    # Documentation index
├── quartz.config.ts                 # Main configuration
└── quartz.layout.ts                 # Page layout configuration
```

### The Two Repositories

Remember: There are TWO repositories involved:

1. **obsidian-quartz-fork** (this one) - Build system and tooling
   - Location: `/Users/dario/git/obsidian-quartz-fork`
   - Contains: Quartz fork, plugins, configuration
   - `content/` folder: Usually empty or test files

2. **obsidian-vault-backup** - The actual content
   - Location: `/Users/dario/Documents/Dario Vault`
   - Contains: All markdown files, images, attachments
   - This is a private repository
   - Has `.github/workflows/deploy-to-pages.yaml` for triggering rebuilds

**Important**: When testing, you can manually copy content from the vault to test, but remember that in production, the build process clones the vault repo fresh each time.

---

## Where to Find Things

### Configuration Files

| What | File | Location |
|------|------|----------|
| Main Quartz config | `quartz.config.ts` | Root |
| Page layouts | `quartz.layout.ts` | Root |
| Plugin list | `quartz.config.ts` | `plugins.filters`, `plugins.transformers`, `plugins.emitters` |
| CLI arguments | `quartz/cli/args.js` | For adding new flags |
| Build handling | `quartz/cli/handlers.js` | For modifying build behavior |

### Custom Features (Modified from Upstream)

| Feature | Primary File(s) | Type |
|---------|----------------|------|
| Multi-tier publishing | `quartz/plugins/filters/publishMode.ts` | Plugin (custom) |
| Index swapping | `quartz/plugins/filters/indexSwapper.ts` | Plugin (custom) |
| Attachment filtering | `quartz/plugins/filters/attachmentWhitelist.ts` | Plugin (custom) |
| Frontmatter display | `quartz/components/FrontmatterProperties.tsx` | Component (custom) |
| Orange broken links | CSS files in `quartz/styles/` | Styling (custom) |
| Explorer filtering | `quartz.layout.ts` (filterFn) | Configuration (custom) |

### Documentation

| Document | Purpose | When to Update |
|----------|---------|----------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Complete system explanation | Any architectural change |
| [PUBLISH_MODES.md](PUBLISH_MODES.md) | Tier system quick reference | Changes to publish logic |
| [FUTURE_TASKS.md](FUTURE_TASKS.md) | Planned improvements | New ideas or completed tasks |
| [CLAUDE.md](CLAUDE.md) | This file | Meta-changes or new conventions |
| [README.md](README.md) | Documentation index | New docs or major changes |

---

## Common Tasks

### Adding a New Filter Plugin

1. Create file in `quartz/plugins/filters/[name].ts`
2. Export it in `quartz/plugins/filters/index.ts`
3. Add to filter chain in `quartz.config.ts`
4. **Update ARCHITECTURE.md** with plugin details
5. Test locally: `npx quartz build --serve`

### Adding a New Publish Mode/Tier

1. Update `publishMode.ts` with new mode logic
2. Update `indexSwapper.ts` to recognize new index file pattern
3. Update type definitions in both files
4. Add to CLI choices in `quartz/cli/args.js`
5. Create tier-specific index file in vault (e.g., `index-newmode.md`)
6. Create new Cloudflare Pages project
7. Add deploy hook to vault's GitHub Actions workflow
8. **Update ARCHITECTURE.md** with new tier details
9. **Update PUBLISH_MODES.md** with new tier

### Modifying Component Behavior

Components are in `quartz/components/`.

**Important considerations**:
- Components receive `QuartzComponentProps` with `cfg`, `fileData`, `allFiles`, etc.
- Some components have both server-side (TypeScript) and client-side (inline scripts) code
- Explorer has special inline script: `quartz/components/scripts/explorer.inline.ts`
- Always check `quartz.layout.ts` to see which components are included where

### Testing Changes

```bash
# Test locally with a specific publish mode
npx quartz build --publish-mode trusted --baseUrl notes-private.dario.ca

# Test specific mode and serve
npx quartz build --publish-mode public --serve
```

**Pro tip**: Create test content files in `content/` directory with various publish modes to test filtering logic.

---

## Important Context

### The Build Process Flow

1. **Cloudflare Pages** pulls obsidian-quartz-fork repo
2. **Build command** runs: clones vault repo into `content/`, then builds
3. **Quartz** parses markdown files
4. **Filter plugins** run in order (Drafts → IndexSwapper → PublishMode)
5. **Transformer plugins** convert markdown to HTML
6. **Emitter plugins** write output files
7. **Files over 25MB** are deleted (Cloudflare limitation)
8. **Result** uploaded to CDN

### Publish Mode Environment Variable

The `--publish-mode` flag sets `process.env.QUARTZ_PUBLISH_MODE`, which plugins can read:

```typescript
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"
```

This is how plugins know which tier they're building for.

### Hierarchical Publishing Logic

Remember the hierarchy:
- `[[Public]]` → visible on ALL tiers
- `[[Shachu]]` → visible on Full, Trusted, Shachu (not Public)
- `[[Trusted]]` → visible on Full, Trusted (not Shachu, not Public)
- No field → visible ONLY on Full

This is implemented in `publishMode.ts` lines 54-63.

### Index File Swapping

The IndexSwapper plugin (lines 40-66 in `indexSwapper.ts`):
1. Identifies the correct index file for the current mode
2. Renames it to `index` (becomes landing page)
3. Sets its `publish` field appropriately
4. Filters out all other index variants

This happens BEFORE PublishMode filtering, which is why order matters.

---

## Documentation Workflow

### When Implementing a New Feature

1. **During development**: Use TodoWrite to track progress
2. **After completion**:
   - Update ARCHITECTURE.md with the feature
   - Move task from pending to completed in FUTURE_TASKS.md
   - Create dedicated feature doc if substantial
   - Update README.md if needed
3. **Test the feature** with multiple publish modes
4. **Commit** with descriptive message

### When Fixing a Bug

1. Identify root cause
2. Fix the code
3. **Update documentation** if the bug revealed incorrect docs
4. Add to troubleshooting section if it's a common issue
5. Test thoroughly

### When Answering Questions

If the user asks "how does X work?":
1. Check ARCHITECTURE.md first
2. If not documented, investigate and then UPDATE the docs
3. Reference the documentation in your response
4. If you had to dig deep to find the answer, consider adding it to docs

---

## Conventions

### Code Style

- Follow existing patterns in the codebase
- Use TypeScript types appropriately
- Add comments for complex logic
- Plugins should export properly and be added to index files

### Naming

- Filter plugins: `[Feature]` (e.g., `PublishMode`, `IndexSwapper`)
- Components: PascalCase (e.g., `FrontmatterProperties`)
- Config files: camelCase (e.g., `quartz.config.ts`)
- Documentation: SCREAMING_SNAKE_CASE.md (e.g., `ARCHITECTURE.md`)

### Git Commits

When committing changes:
- Use descriptive commit messages
- Separate logical changes into separate commits
- Don't commit `content/` folder test files (or do, but don't push them)
- Remember: Pushing to this repo triggers ALL FOUR sites to rebuild

---

## Troubleshooting Guide for Developers

### "My changes aren't showing up on the live site"

1. Did you push to the obsidian-quartz-fork repo?
2. Check Cloudflare Pages build logs
3. Wait for GitHub Actions debounce (120 seconds)
4. Clear browser cache

### "Content is filtered out unexpectedly"

1. Check the `publish` frontmatter field format (should be `[[Mode]]`)
2. Verify PublishMode plugin logic in `publishMode.ts`
3. Check plugin order in `quartz.config.ts`
4. Look at build logs for "Filtered out X files"

### "Index page not swapping"

1. Verify index files exist in vault with correct frontmatter
2. Check IndexSwapper is before PublishMode in plugin chain
3. Verify IndexSwapper is setting `publish` field correctly
4. Check that index files have the right names

### "Build failing"

1. Check Cloudflare environment variables (GH_TOKEN)
2. Verify vault repo is accessible
3. Look for syntax errors in plugins
4. Check for large files (>25MB)

---

## Future Considerations

See [FUTURE_TASKS.md](FUTURE_TASKS.md) for planned improvements.

When working on future tasks:
1. Move task from pending to in-progress
2. Update this file if new patterns emerge
3. Document the implementation in ARCHITECTURE.md
4. Move to completed when done

---

## Quick Reference

### File a Human Might Ask About

| "Where is..." | Location |
|---------------|----------|
| Publish mode logic | `quartz/plugins/filters/publishMode.ts` |
| Index swapping | `quartz/plugins/filters/indexSwapper.ts` |
| Frontmatter display | `quartz/components/FrontmatterProperties.tsx` |
| Sidebar file tree | `quartz/components/Explorer.tsx` |
| Main config | `quartz.config.ts` |
| Page layouts | `quartz.layout.ts` |
| Build commands | Cloudflare Pages project settings |
| Deploy workflow | Vault repo: `.github/workflows/deploy-to-pages.yaml` |
| Complete docs | `docs-custom/ARCHITECTURE.md` |

### Commands You'll Use Often

```bash
# Local build with specific mode
npx quartz build --publish-mode [full|trusted|shachu|public]

# Serve locally
npx quartz build --serve

# Clean and rebuild
rm -rf public && npx quartz build

# Check for large files
find content -type f -size +25M

# Test with vault content (manual)
rm -rf content && cp -r ~/Documents/Dario\ Vault content && npx quartz build
```

---

## When in Doubt

1. **Read ARCHITECTURE.md** - Most questions are answered there
2. **Check existing code** - Follow established patterns
3. **Test locally** - Before assuming something is broken
4. **Update docs** - If you learned something, document it
5. **Ask the user** - If unclear, ask rather than assume

---

**Remember**: This is Dario's personal knowledge base. Treat it with care. Every change affects four live websites. Document thoroughly. Test carefully. Keep docs updated.

---

*Last updated: 2025-10-26*
*By: Claude (Sonnet 4.5)*

## Active Technologies
- TypeScript 5.9.2 with ESNext target, Node.js >=22 (001-filter-orphaned-attachments)
- File-based content management; in-memory attachment whitelist during build (001-filter-orphaned-attachments)

## Recent Changes
- 001-filter-orphaned-attachments: Added TypeScript 5.9.2 with ESNext target, Node.js >=22
