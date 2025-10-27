import { QuartzTransformerPlugin } from "../types"
import { Root, Html } from "mdast"
import { visit, SKIP } from "unist-util-visit"

export interface Options {
  // No options needed for now, but keeping the structure for consistency
}

const defaultOptions: Options = {}

/**
 * Regex to match hide-in-build comments with optional mode specification
 *
 * Matches:
 * - <!-- hide-in-build --> ... <!-- /hide-in-build -->
 * - <!-- hide-in-build:public,shachu,trusted --> ... <!-- /hide-in-build -->
 *
 * The modes parameter specifies which publish modes should hide the content.
 * If no modes are specified, defaults to hiding in all modes except "full".
 */
const hideStartRegex = /<!--\s*hide-in-build(?::([^>]+))?\s*-->/
const hideEndRegex = /<!--\s*\/hide-in-build\s*-->/

type PublishMode = "full" | "trusted" | "shachu" | "public"

/**
 * Determines if content should be hidden based on current publish mode
 */
function shouldHideContent(modesParam: string | undefined, currentMode: PublishMode): boolean {
  // Default behavior: hide in all modes except "full"
  if (!modesParam || modesParam.trim() === "") {
    return currentMode !== "full"
  }

  // Parse the comma-separated list of modes
  const hideModes = modesParam
    .split(",")
    .map((mode) => mode.trim().toLowerCase())
    .filter((mode) => mode.length > 0)

  // Hide if current mode is in the list
  return hideModes.includes(currentMode)
}

export const HideInBuild: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "HideInBuild",
    textTransform(_ctx, src) {
      // Get the current publish mode from environment variable
      const publishMode = (process.env.QUARTZ_PUBLISH_MODE || "full") as PublishMode

      // Track if we're inside a hide block
      let insideHideBlock = false
      let currentHideModes: string | undefined
      let buffer = ""

      const lines = src.split("\n")
      const outputLines: string[] = []

      for (const line of lines) {
        const startMatch = line.match(hideStartRegex)
        const endMatch = line.match(hideEndRegex)

        if (startMatch && !insideHideBlock) {
          // Start of hide block
          insideHideBlock = true
          currentHideModes = startMatch[1]
          buffer = ""

          // Check if we should hide in this mode
          if (shouldHideContent(currentHideModes, publishMode)) {
            // Remove the opening tag and don't output the line
            continue
          } else {
            // Keep content visible - remove the hide tags but keep content
            // Don't add the comment itself
            continue
          }
        } else if (endMatch && insideHideBlock) {
          // End of hide block
          insideHideBlock = false

          // If we're not hiding, output the buffered content
          if (!shouldHideContent(currentHideModes, publishMode)) {
            outputLines.push(buffer)
          }

          buffer = ""
          currentHideModes = undefined

          // Don't output the closing tag
          continue
        } else if (insideHideBlock) {
          // Inside hide block
          if (shouldHideContent(currentHideModes, publishMode)) {
            // Skip this line - we're hiding content
            continue
          } else {
            // Buffer the line - we'll output it when we hit the end tag
            if (buffer) {
              buffer += "\n" + line
            } else {
              buffer = line
            }
            continue
          }
        } else {
          // Normal line, not in hide block
          outputLines.push(line)
        }
      }

      // If we're still in a hide block at the end (unclosed), output buffer if not hiding
      if (insideHideBlock && !shouldHideContent(currentHideModes, publishMode)) {
        if (buffer) {
          outputLines.push(buffer)
        }
      }

      return outputLines.join("\n")
    },
  }
}
