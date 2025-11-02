import { QuartzTransformerPlugin } from "../types"
import { collectWarning } from "../../util/buildWarnings"

// Marker types for filtering
type MarkerType = 'redact' | 'no-render'
type PublishMode = 'full' | 'trusted' | 'shachu' | 'public'

// Configuration for topic-based filtering (disabled by default)
const ENABLE_TOPIC_FILTERING = false

// Regex patterns for marker detection
const INLINE_REDACT = /<!--\s*redact\s*-->/i
const INLINE_NO_RENDER = /<!--\s*no-render\s*-->/i
const BLOCK_REDACT_BEGIN = /<!--\s*redact-begin\s*-->/i
const BLOCK_REDACT_END = /<!--\s*redact-end\s*-->/i
const BLOCK_NO_RENDER_BEGIN = /<!--\s*no-render-begin\s*-->/i
const BLOCK_NO_RENDER_END = /<!--\s*no-render-end\s*-->/i
const JUUDEN_KEYWORD = /juuden/i

export interface Options {
  enableTopicFiltering?: boolean
}

export const RedactionMarkers: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { enableTopicFiltering: ENABLE_TOPIC_FILTERING, ...userOpts }

  return {
    name: "RedactionMarkers",
    textTransform(_ctx, src, filePath) {
      const publishMode = (process.env.QUARTZ_PUBLISH_MODE || "full") as PublishMode

      // Process line by line
      const lines = src.split("\n")
      const outputLines: string[] = []

      // State tracking for block markers
      let insideRedactBlock = false
      let insideNoRenderBlock = false
      let redactBlockStartLine = -1
      let noRenderBlockStartLine = -1

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Check for block marker begin/end
        // No-render block markers (highest precedence)
        if (line.match(BLOCK_NO_RENDER_BEGIN)) {
          insideNoRenderBlock = true
          noRenderBlockStartLine = i + 1
          continue // Skip the marker line itself
        }
        if (line.match(BLOCK_NO_RENDER_END)) {
          insideNoRenderBlock = false
          continue // Skip the marker line itself
        }

        // Redact block markers
        if (line.match(BLOCK_REDACT_BEGIN)) {
          insideRedactBlock = true
          redactBlockStartLine = i + 1 // Line numbers are 1-indexed for humans
          // In full mode, skip the marker but continue to include content
          if (publishMode === "full") {
            continue
          }
          continue
        }
        if (line.match(BLOCK_REDACT_END)) {
          insideRedactBlock = false
          // In full mode, skip the marker
          if (publishMode === "full") {
            continue
          }
          continue
        }

        // Filter content inside blocks
        if (insideNoRenderBlock) {
          continue // Always skip no-render block content
        }
        if (insideRedactBlock && publishMode !== "full") {
          continue // Skip redact block content in non-full modes
        }

        // Check for inline markers
        // No-render inline (always filter)
        if (line.match(INLINE_NO_RENDER)) {
          continue
        }

        // Redact inline (filter in non-full modes)
        if (line.match(INLINE_REDACT)) {
          if (publishMode === "full") {
            // In full mode, include the line but remove the marker
            const cleanedLine = line.replace(INLINE_REDACT, "")
            outputLines.push(cleanedLine)
          }
          // In non-full modes, skip the line entirely
          continue
        }

        // Check for Juuden keyword tripwire (acts like redact)
        if (line.match(JUUDEN_KEYWORD)) {
          if (publishMode === "full") {
            // Include in full mode
            outputLines.push(line)
          }
          // Skip in non-full modes
          continue
        }

        // If we got here, include the line
        outputLines.push(line)
      }

      // Check for unclosed blocks (malformed markers)
      if (insideRedactBlock) {
        collectWarning(
          filePath || "unknown",
          "unclosed-block",
          `Unclosed redact block starting at line ${redactBlockStartLine}. Block markers must be properly paired.`,
          redactBlockStartLine
        )
      }

      if (insideNoRenderBlock) {
        collectWarning(
          filePath || "unknown",
          "unclosed-block",
          `Unclosed no-render block starting at line ${noRenderBlockStartLine}. Block markers must be properly paired.`,
          noRenderBlockStartLine
        )
      }

      return outputLines.join("\n")
    },
  }
}
