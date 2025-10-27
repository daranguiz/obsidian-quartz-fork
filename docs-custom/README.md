# Custom Documentation

This folder contains documentation specific to Dario's implementation of Quartz for multi-tier Obsidian publishing.

## Documents

### [ARCHITECTURE.md](ARCHITECTURE.md)
**Complete system architecture and deployment guide**

Read this to understand:
- How the entire system works from top to bottom
- Why the system is designed this way
- Repository structure and how they interact
- The four-tier publishing system
- Deployment pipeline and automation
- Technical implementation details
- How to maintain and troubleshoot the system

**Start here** if you're new to the system or coming back after a while.

### [PUBLISH_MODES.md](PUBLISH_MODES.md)
**Quick reference guide for the four-tier publishing system**

Read this for:
- Overview of the four tiers (Full, Trusted, Shachu, Public)
- Frontmatter syntax and examples
- Content visibility matrix
- Cloudflare Pages build commands
- Quick troubleshooting tips

**Use this** as a quick reference when creating content or configuring builds.

### [FUTURE_TASKS.md](FUTURE_TASKS.md)
**Planned improvements and known issues**

Read this to:
- See what improvements are planned
- Track known limitations
- Understand future roadmap
- Add new ideas and tasks

**Check this** before making major changes or when planning new features.

### [CLAUDE.md](CLAUDE.md)
**Guide for AI assistants working on this codebase**

Read this to:
- Understand documentation conventions
- Know where to find things in the codebase
- Learn the workflow for implementing features
- Follow best practices for maintaining this system

**Essential reading** for Claude or other AI assistants contributing to this project.

---

## Other Documentation

The `docs/` folder (at repository root) contains the **official Quartz documentation** for the upstream project. Refer to that for:
- General Quartz features
- Plugin development
- Theming and customization
- Standard configuration options

---

## Quick Links

- **Obsidian Vault Repository**: `https://github.com/daranguiz/obsidian-vault-backup`
- **Quartz Fork Repository**: `https://github.com/[username]/obsidian-quartz-fork`
- **Cloudflare Dashboard**: Zero Trust → Access → Applications
- **Cloudflare Pages**: Pages → [Project] → Settings

---

## For Future You

If you're reading this after months away:

1. **Start with ARCHITECTURE.md** - It explains everything from scratch
2. **Check FUTURE_TASKS.md** - See if anything needs attention
3. **Review PUBLISH_MODES.md** - Refresh on the tier system
4. **Test a build locally** - Make sure everything still works: `npx quartz build --serve`

The system is designed to be mostly hands-off once set up. Content updates automatically propagate through GitHub Actions → Cloudflare Pages → All four sites.

---

## Contributing / Making Changes

When making significant changes:

1. Document them in the appropriate file (ARCHITECTURE.md for system changes, FUTURE_TASKS.md for future ideas)
2. Test locally before pushing
3. Remember that changes to this repo trigger rebuilds of all four sites
4. Update the documentation if behavior changes

---

*Last major update: 2025-10-26*
