<!--
SYNC IMPACT REPORT
Version: 0.0.0 → 1.0.0 (Initial constitution creation)
Modified Principles: N/A (initial version)
Added Sections: All sections (initial creation)
Removed Sections: None
Templates Status:
  - .specify/templates/plan-template.md: ✅ No changes required (no constitutional references)
  - .specify/templates/spec-template.md: ✅ No changes required (no constitutional references)
  - .specify/templates/tasks-template.md: ✅ No changes required (no constitutional references)
  - .specify/templates/checklist-template.md: ✅ No changes required (no constitutional references)
  - .specify/templates/agent-file-template.md: ✅ No changes required (no constitutional references)
Follow-up TODOs: None
-->

# Obsidian Quartz Multi-Tier Publishing Constitution

## Core Principles

### I. Single Source of Truth
One Obsidian vault contains all content. Content MUST NOT be duplicated across repositories
or maintained in multiple locations. The vault repository (obsidian-vault-backup) is the
authoritative source for all markdown files, attachments, and media.

**Rationale**: Duplication leads to content drift, synchronization issues, and maintenance
burden. A single source ensures consistency across all publishing tiers.

### II. Clean Separation of Concerns
Build system (obsidian-quartz-fork) MUST be maintained separately from content
(obsidian-vault-backup). The vault MUST remain usable as a standard Obsidian vault without
build artifacts, node modules, or static site generator files.

**Rationale**: Keeps the vault clean for daily Obsidian usage and allows independent
versioning of content and build tooling.

### III. Hierarchical Access Control
Content visibility MUST follow a strict hierarchy across four tiers:
- **Full**: All content (except drafts) - most permissive
- **Trusted**: Content marked `publish: "[[Trusted]]"` or higher
- **Shachu**: Content marked `publish: "[[Shachu]]"` or higher
- **Public**: Content marked `publish: "[[Public]]"` only - most restrictive

Higher tiers MUST include all content from lower tiers (hierarchical inheritance).
`draft: true` MUST be filtered from ALL tiers without exception.

**Rationale**: Prevents accidental information disclosure and ensures consistent access
patterns. Public content automatically appears in all tiers; trusted content cannot
accidentally become public.

### IV. Frontmatter-Driven Publishing
Content visibility MUST be controlled exclusively through frontmatter fields. Publishing
decisions MUST NOT rely on file location, naming conventions, or external configuration
files. The `publish` field format MUST use wikilink syntax: `"[[Public]]"`, `"[[Shachu]]"`,
`"[[Trusted]]"`.

**Rationale**: Frontmatter is version-controlled with content, visible in Obsidian, and
survives file moves. Wikilink format provides Obsidian dropdown support and clear visual
indication of publishing level.

### V. Documentation as Living System
ARCHITECTURE.md MUST be updated whenever features are implemented, architecture changes,
or system behavior is modified. Documentation drift from reality is NOT acceptable.
Feature documentation MUST include both how it works and why design decisions were made.

**Rationale**: Documentation is the primary communication channel between human and AI
assistants. Outdated documentation leads to incorrect implementations and wasted effort.

### VI. Defense in Depth
Publishing restrictions MUST be enforced at multiple layers:
- Filter plugins (server-side, during build)
- Component-level visibility (conditional rendering)
- Client-side filtering (Explorer sidebar)
- Access control (Cloudflare Zero Trust for restricted tiers)

A single layer failure MUST NOT expose private content.

**Rationale**: Security through redundancy. Multiple enforcement points protect against
bugs, misconfigurations, or plugin failures.

### VII. Automated Deployment
Content changes MUST trigger automatic rebuilds of all affected tiers without manual
intervention. The deployment pipeline MUST support rapid iteration with debouncing to
prevent build storms during editing sessions.

**Rationale**: Manual deployment is error-prone and creates friction for content creation.
Automation ensures consistency and enables the single-vault, multi-tier workflow.

## Security Requirements

### Content Isolation
Private content MUST NEVER be accessible on lower-trust tiers, even via direct URL access.
This requirement applies to:
- Markdown files (enforced by filter plugins)
- Attachments and media files (MUST be filtered based on references)
- Orphaned links (MUST NOT reveal existence of filtered content through styling)
- Frontmatter metadata (MUST be hidden on non-Full tiers)

### Authentication Standards
Restricted tiers (Full, Trusted, Shachu) MUST use Cloudflare Zero Trust with Google Auth.
User access MUST be managed through explicit allow lists or Google Groups.
Public tier MUST remain fully public with no authentication.

### Information Disclosure Prevention
The existence of filtered content MUST NOT be inferable from:
- Broken link styling (tiered styling required)
- Navigation elements (unused content must be hidden)
- Error messages or 404 pages
- Build logs or deployment outputs (private repos only)

## Development Standards

### Plugin Architecture
Custom plugins MUST follow Quartz plugin patterns:
- **Filter plugins**: Return boolean (`shouldPublish`) for each file
- **Transformer plugins**: Modify content AST during processing
- **Emitter plugins**: Generate output files from processed content

Plugin execution order MUST be explicitly managed in `quartz.config.ts`.
Order-dependent plugins (IndexSwapper → PublishMode) MUST document their dependencies.

### Testing Requirements
Changes to filter or security-related plugins MUST be tested across all four publish modes
before deployment. Test cases MUST verify:
- Content appears on expected tiers
- Content is filtered from expected tiers
- Index swapping functions correctly
- Hierarchical inheritance works as designed

Local testing MUST use: `npx quartz build --publish-mode [MODE] --serve`

### Configuration Management
Environment-specific configuration (base URLs, publish modes) MUST be passed via CLI
arguments, not hard-coded. Cloudflare Pages projects MUST use identical build commands
except for `--publish-mode` and `--baseUrl` parameters.

Secrets (GH_TOKEN) MUST be stored in Cloudflare environment variables, never in code or
configuration files.

### File Size Handling
Files exceeding Cloudflare Pages 25MB limit MUST be handled gracefully. Current approach
(deletion) is acceptable as temporary solution. Long-term solution MUST migrate large
files to CDN with automated link rewriting.

## Maintenance Practices

### Task Tracking
Complex multi-step tasks MUST use TodoWrite tool to track progress and provide user
visibility. Tasks MUST be marked complete immediately upon finishing, not batched.
Exactly ONE task MUST be in_progress at any time.

### Feature Implementation Workflow
1. Update ARCHITECTURE.md with feature details
2. Implement the feature with appropriate tests
3. Move task from pending to completed in FUTURE_TASKS.md
4. Create dedicated feature documentation if substantial
5. Update README.md if user-facing

### Documentation Standards
Documentation MUST:
- Use markdown format with proper heading hierarchy
- Include both "what" (behavior) and "why" (rationale)
- Provide file paths with line numbers for code references
- Maintain table of contents for documents over 200 lines
- Use consistent naming: SCREAMING_SNAKE_CASE.md for major docs

### Repository Maintenance
The build repository (obsidian-quartz-fork) MUST keep `content/` folder empty or minimal
(test files only). Content MUST be cloned fresh during each build via `git clone --depth=1`.

Pushing to build repository triggers ALL FOUR sites to rebuild. Changes MUST be tested
locally before pushing.

## Governance

### Constitutional Authority
This constitution supersedes ad-hoc practices and conventions. All feature implementations,
plugin modifications, and architectural decisions MUST align with core principles.

### Amendment Process
Constitution amendments require:
1. Clear rationale for the change
2. Impact analysis on existing features
3. Update to version number following semantic versioning:
   - MAJOR: Breaking changes to principles or governance
   - MINOR: New principles or significant expansions
   - PATCH: Clarifications, typo fixes, non-semantic improvements
4. Review and validation of dependent templates
5. Documentation updates in ARCHITECTURE.md and related files

### Compliance Verification
All pull requests and code reviews MUST verify compliance with:
- Hierarchical access control (Principle III)
- Defense in depth (Principle VI)
- Security requirements (Information disclosure prevention)
- Documentation standards (Principle V)

### Complexity Justification
Complexity MUST be justified by real requirements documented in ARCHITECTURE.md or
FUTURE_TASKS.md. Speculative features or "nice-to-have" additions MUST be deferred unless
explicitly requested.

Simplicity and maintainability are valued over feature completeness.

### Runtime Guidance
For detailed development guidance, refer to [docs-custom/CLAUDE.md](../../docs-custom/CLAUDE.md).
For publish mode implementation details, see [docs-custom/PUBLISH_MODES.md](../../docs-custom/PUBLISH_MODES.md).
For complete system architecture, see [docs-custom/ARCHITECTURE.md](../../docs-custom/ARCHITECTURE.md).

---

**Version**: 1.0.0 | **Ratified**: 2025-10-27 | **Last Amended**: 2025-10-27
