import path from "path"
import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { pathToRoot, resolveRelative } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import { styleText } from "util"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"
import { Node } from "unist"
import { Root } from "hast"
import { StaticResources } from "../../util/resources"
import { QuartzPluginData } from "../vfile"
import { visit } from "unist-util-visit"
import { RelativeURL } from "../../util/path"

async function processContent(
  ctx: BuildCtx,
  tree: Node,
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
  opts: FullPageLayout,
  resources: StaticResources,
) {
  const slug = fileData.slug!
  const cfg = ctx.cfg.configuration

  const allSlugs = allFiles.map((f) => (f.slug ? resolveRelative(slug, f.slug) : ""))

  visit(tree as Root, "element", (elem) => {
    if (elem.tagName === "a" && elem.properties.href) {
      const href = elem.properties.href.toString()

      const isAnchor = href.startsWith("#")
      const isExternalByClass =
        (Array.isArray(elem.properties.className) && elem.properties.className.includes("external")) ||
        (typeof elem.properties.className === "string" && elem.properties.className.includes("external"))
      const isHttpExternal = /^https?:\/\//i.test(href)
      // treat common asset/file extensions as valid (pdf, images, media, docs, data)
      const isAsset = /\.(pdf|png|jpe?g|gif|webp|svg|heic|mp3|mp4|mov|wav|ogg|webm|zip|tar|gz|csv|tsv|json|txt|mdx?)$/i.test(href)

      if (isAnchor || isHttpExternal || isExternalByClass || isAsset) {
        return
      }
      
      if (!allSlugs.includes(href as RelativeURL)) {
        if (elem.properties.className === undefined) {
          elem.properties.className = "dead-link"
        } else if (Array.isArray(elem.properties.className)) {
          if (elem.properties.className.includes("external")) {
            return
          }
          elem.properties.className.push("dead-link")
        } else if (typeof elem.properties.className === "string") {
          if (elem.properties.className.includes("external")) {
            return
          }
          elem.properties.className += " dead-link"
        } else {
          return
        }
        elem.tagName = "span"
      }
    }
  })

  const externalResources = pageResources(pathToRoot(slug), resources)
  const componentData: QuartzComponentProps = {
    ctx,
    fileData,
    externalResources,
    cfg,
    children: [],
    tree,
    allFiles,
  }

  const content = renderPage(cfg, slug, componentData, opts, externalResources)
  return write({
    ctx,
    content,
    slug,
    ext: ".html",
  })
}

export const ContentPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "ContentPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data)
      let containsIndex = false

      for (const [tree, file] of content) {
        const slug = file.data.slug!
        if (slug === "index") {
          containsIndex = true
        }

        // only process home page, non-tag pages, and non-index pages
        if (slug.endsWith("/index") || slug.startsWith("tags/")) continue
        yield processContent(ctx, tree, file.data, allFiles, opts, resources)
      }

      if (!containsIndex) {
        console.log(
          styleText(
            "yellow",
            `\nWarning: you seem to be missing an \`index.md\` home page file at the root of your \`${ctx.argv.directory}\` folder (\`${path.join(ctx.argv.directory, "index.md")} does not exist\`). This may cause errors when deploying.`,
          ),
        )
      }
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data)

      // find all slugs that changed or were added
      const changedSlugs = new Set<string>()
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
        if (changeEvent.type === "add" || changeEvent.type === "change") {
          changedSlugs.add(changeEvent.file.data.slug!)
        }
      }

      for (const [tree, file] of content) {
        const slug = file.data.slug!
        if (!changedSlugs.has(slug)) continue
        if (slug.endsWith("/index") || slug.startsWith("tags/")) continue

        yield processContent(ctx, tree, file.data, allFiles, opts, resources)
      }
    },
  }
}
