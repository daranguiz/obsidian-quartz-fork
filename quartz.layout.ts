import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Get publish mode for tier-specific configuration
const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"

// Auto-expand folders for lower tiers (Public, Shachu, Trusted)
const autoExpandFolders = publishMode !== "full"
  ? ["Tea Resources", "Tea Resources/紙片 (Shihen)"]
  : []

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.FrontmatterProperties(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      autoExpandFolders,
      filterFn: (node) => {
        // Exclude tags folder and unused index files
        if (node.slugSegment === "tags") return false
        // Exclude index-trusted, index-shachu, index-public files
        // The main index.md is kept
        if (node.slug?.match(/^index-(trusted|shachu|public)$/)) return false
        return true
      },
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      autoExpandFolders,
      filterFn: (node) => {
        // Exclude tags folder and unused index files
        if (node.slugSegment === "tags") return false
        // Exclude index-trusted, index-shachu, index-public files
        // The main index.md is kept
        if (node.slug?.match(/^index-(trusted|shachu|public)$/)) return false
        return true
      },
    }),
  ],
  right: [],
}
