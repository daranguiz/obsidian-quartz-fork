import { FilePath, FullSlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { generateWarningsReport, hasWarnings } from "../../util/buildWarnings"
import path from "path"

export const BuildWarningsReport: QuartzEmitterPlugin = () => {
  return {
    name: "BuildWarningsReport",
    async emit(ctx, content, resources): Promise<FilePath[]> {
      // Only generate report if there are warnings
      if (!hasWarnings()) {
        return []
      }

      const publishMode = (process.env.QUARTZ_PUBLISH_MODE || "full") as string
      const outputDir = ctx.argv.output

      generateWarningsReport(publishMode, outputDir)

      return [path.join(outputDir, "build-warnings.html") as FilePath]
    },
  }
}
