import { Fragment, JSX } from "preact"
import { classNames } from "../util/lang"
import { FullSlug, splitAnchor, TransformOptions, transformLink } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { wikilinkRegex } from "../plugins/transformers/ofm"

type FrontmatterValue = unknown

type RenderContext = {
  fileData: QuartzComponentProps["fileData"]
  ctx: QuartzComponentProps["ctx"]
  baseSlug?: FullSlug
  validLinks: Set<string>
  transformOptions: TransformOptions
}

const isPlainObject = (value: FrontmatterValue): value is Record<string, unknown> => {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)
  )
}

const shouldSkipEntry = (value: FrontmatterValue) => {
  if (value === undefined || value === null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "string") return value.trim() === ""
  if (isPlainObject(value)) return Object.keys(value).length === 0
  return false
}

const normalizeHref = (href: string): string => {
  const [path] = href.split("#")
  if (path === "") return "."

  let normalized = path

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2)
  }

  if (normalized.endsWith("/index")) {
    normalized = normalized.slice(0, -"/index".length)
  }

  if (normalized !== "." && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1)
  }

  if (normalized === "") {
    normalized = "."
  }

  return normalized
}

const renderBoolean = (value: boolean) => {
  return (
    <span class="frontmatter-boolean">
      <input type="checkbox" checked={value} disabled aria-checked={value} />
    </span>
  )
}

const renderDate = (value: Date | string | number) => {
  if (value instanceof Date) {
    return <span>{value.toISOString()}</span>
  }
  if (typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return <span>{date.toISOString()}</span>
    }
  }
  return <span>{String(value)}</span>
}

const renderPlainText = (text: string) => {
  return <span class="frontmatter-text">{text}</span>
}

const renderWikiLinks = (text: string, context: RenderContext, linkClass = "internal") => {
  const regex = new RegExp(wikilinkRegex)
  const externalLinkPattern = /^[a-z][a-z0-9+.-]*:/i
  const nodes: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let linkIndex = 0

  while ((match = regex.exec(text)) !== null) {
    const [raw, rawPath, rawHeader, rawAlias] = match
    const startIndex = match.index

    if (startIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, startIndex))
    }

    const isEmbed = raw.startsWith("!")
    const filePath = (rawPath ?? "").trim()
    const header = rawHeader ?? ""
    const alias = rawAlias ? rawAlias.slice(1).trim() : undefined

    if (filePath && externalLinkPattern.test(filePath)) {
      nodes.push(
        <a
          key={`frontmatter-link-${linkIndex++}`}
          class={`${linkClass} external${isEmbed ? " embed" : ""}`}
          href={filePath}
          rel="noopener noreferrer"
          target="_blank"
        >
          {alias || filePath}
        </a>,
      )
      lastIndex = startIndex + raw.length
      continue
    }

    const combinedTarget = `${filePath}${header ?? ""}`
    const [target, anchor] = splitAnchor(combinedTarget)

    let href = combinedTarget
    let isValid = true

    if (target === "") {
      href = anchor || "#"
    } else {
      const baseSlug = context.baseSlug
      if (baseSlug) {
        href = transformLink(baseSlug, combinedTarget, context.transformOptions)
        const normalizedHref = normalizeHref(href)
        if (normalizedHref !== ".") {
          isValid = context.validLinks.has(normalizedHref)
        }
      }
    }

    const display = alias || (target !== "" ? target : anchor.replace(/^#/, "")) || filePath

    if (!isValid) {
      nodes.push(
        <span key={`frontmatter-link-${linkIndex++}`} class="dead-link">
          {display}
        </span>,
      )
    } else {
      nodes.push(
        <a
          key={`frontmatter-link-${linkIndex++}`}
          class={`${linkClass}${isEmbed ? " embed" : ""}`}
          href={href}
        >
          {display}
        </a>,
      )
    }

    lastIndex = startIndex + raw.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return <span class="frontmatter-text">{nodes}</span>
}

const renderValue = (value: FrontmatterValue, context: RenderContext): JSX.Element => {
  if (typeof value === "boolean") {
    return renderBoolean(value)
  }

  if (value instanceof Date) {
    return renderDate(value)
  }

  if (typeof value === "number") {
    return renderPlainText(String(value))
  }

  if (Array.isArray(value)) {
    return (
      <span class="frontmatter-array">
        {value.map((item, idx) => (
          <Fragment key={`frontmatter-array-${idx}`}>
            {renderValue(item, context)}
            {idx < value.length - 1 ? <span class="frontmatter-separator">, </span> : null}
          </Fragment>
        ))}
      </span>
    )
  }

  if (isPlainObject(value)) {
    return renderPlainText(JSON.stringify(value))
  }

  if (typeof value === "string") {
    if (value.includes("[[")) {
      return renderWikiLinks(value, context)
    }
    return renderPlainText(value)
  }

  return renderPlainText(String(value))
}

const CalendarIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </svg>
)

const TagIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <path d="M20 13.586 13.586 20a2 2 0 0 1-2.828 0L4 13.243V4h9.243L20 10.757a2 2 0 0 1 0 2.829Z" />
    <circle cx="9" cy="9" r="1.5" />
  </svg>
)

const ListIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <path d="M9 6h12M9 12h12M9 18h12" stroke-linecap="round" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round" />
  </svg>
)

const NoteIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <path d="M6 3h9l6 6v12H6z" />
    <path d="M15 3v6h6" />
  </svg>
)

const LinkIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 12" stroke-linecap="round" />
    <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 12" stroke-linecap="round" />
  </svg>
)

const iconFactories: Record<string, () => JSX.Element> = {
  created: CalendarIcon,
  modified: CalendarIcon,
  updated: CalendarIcon,
  published: CalendarIcon,
  date: CalendarIcon,
  note_type: NoteIcon,
  type: NoteIcon,
  topics: ListIcon,
  tags: TagIcon,
  tag: TagIcon,
  links: LinkIcon,
  related: LinkIcon,
}

const getIcon = (key: string) => {
  const normalized = key.toLowerCase()
  const directMatch = iconFactories[normalized]
  if (directMatch) {
    return directMatch()
  }

  if (normalized.includes("date")) {
    return CalendarIcon()
  }

  if (normalized.includes("tag")) {
    return TagIcon()
  }

  if (normalized.includes("link")) {
    return LinkIcon()
  }

  return NoteIcon()
}

const FrontmatterProperties: QuartzComponent = ({
  fileData,
  displayClass,
  allFiles,
  ctx,
}: QuartzComponentProps) => {
  // Only show frontmatter properties on the "full" tier
  const publishMode = process.env.QUARTZ_PUBLISH_MODE || "full"
  if (publishMode !== "full") {
    return null
  }

  const raw = fileData.frontmatterRaw
  if (!raw) {
    return null
  }

  // Filter out publish field and empty values
  const publishFields = ["publish", "publish-trusted", "publish-shachu", "publish-public"]
  const entries = Object.entries(raw).filter(
    ([key, value]) => !shouldSkipEntry(value) && !publishFields.includes(key)
  )
  if (entries.length === 0) {
    return null
  }

  const baseSlug = fileData.slug as FullSlug | undefined

  const transformOptions: TransformOptions = {
    strategy: "shortest",
    allSlugs: ctx.allSlugs,
  }

  const renderContext: RenderContext = {
    fileData,
    ctx,
    baseSlug,
    validLinks: new Set<string>(),
    transformOptions,
  }

  if (baseSlug) {
    const addCandidate = (target: FullSlug) => {
      const href = transformLink(baseSlug, target, transformOptions)
      renderContext.validLinks.add(normalizeHref(href))
    }

    for (const data of allFiles) {
      const slug = data.slug as FullSlug | undefined
      const aliases = data.aliases as FullSlug[] | undefined

      if (slug) {
        addCandidate(slug)
      }

      if (aliases) {
        for (const aliasSlug of aliases) {
          addCandidate(aliasSlug)
        }
      }
    }
  }

  return (
    <section class={classNames(displayClass, "frontmatter-properties")}>
      <dl>
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <dt data-key={key}>
              <span class="frontmatter-icon">{getIcon(key)}</span>
              <span class="frontmatter-label">{key.replace(/_/g, " ")}</span>
            </dt>
            <dd>{renderValue(value, renderContext)}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  )
}

FrontmatterProperties.css = `
.frontmatter-properties {
  margin: 1rem 0;
  padding: 0.85rem 1.1rem;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--gray) 18%, transparent);
  background-color: color-mix(in srgb, var(--lightgray) 30%, var(--light) 70%);
  box-shadow: none;
  color: inherit;
}

.frontmatter-properties dl {
  display: grid;
  grid-template-columns: minmax(140px, 200px) minmax(0, 1fr);
  row-gap: 0.65rem;
  column-gap: 1rem;
  margin: 0;
}

.frontmatter-properties dt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  color: #252525;
}

.frontmatter-properties dd {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  white-space: pre-wrap;
  color: #252525;
}

.frontmatter-text {
  white-space: inherit;
}

.frontmatter-boolean input {
  accent-color: var(--secondary);
  pointer-events: none;
}

.frontmatter-properties a {
  background: none;
  padding: 0;
  border-radius: 0;
  color: var(--secondary);
}

.frontmatter-properties a.internal {
  background: none !important;
  padding: 0;
  border-radius: 0;
}

.frontmatter-properties a.internal:hover {
  background: none;
  text-decoration: underline;
}

.frontmatter-array {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.frontmatter-separator {
  color: #404040;
}

.frontmatter-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 6px;
  background: transparent;
  color: #252525;
}

.frontmatter-icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.frontmatter-label {
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .frontmatter-properties dl {
    grid-template-columns: 1fr;
  }

  .frontmatter-properties dt {
    font-size: 0.95em;
  }

  .frontmatter-properties {
    padding: 0.75rem 0.95rem;
  }
}

:root[saved-theme="dark"] .frontmatter-properties {
  background-color: #262626;
  border-color: color-mix(in srgb, var(--lightgray) 18%, transparent);
  box-shadow: none;
}

:root[saved-theme="dark"] .frontmatter-properties dt {
  color: rgba(245, 245, 245, 0.92);
}

:root[saved-theme="dark"] .frontmatter-properties dd {
  color: rgba(235, 235, 235, 0.88);
}

:root[saved-theme="dark"] .frontmatter-icon {
  background: transparent;
  color: rgba(255, 255, 255, 0.96);
}

:root[saved-theme="dark"] .frontmatter-separator {
  color: rgba(210, 210, 210, 0.75);
}

:root[saved-theme="dark"] .frontmatter-properties a {
  color: color-mix(in srgb, var(--secondary) 80%, white 20%);
}
`

export default (() => FrontmatterProperties) satisfies QuartzComponentConstructor
