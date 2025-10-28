import { FilePath, joinSegments, slugifyFilePath } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { shouldCopyAttachment } from "../../util/attachments"
import path from "path"
import fs from "fs"
import { glob } from "../../util/glob"
import { Argv } from "../../util/ctx"
import { QuartzConfig } from "../../cfg"

const filesToCopy = async (argv: Argv, cfg: QuartzConfig) => {
  // glob all non MD files in content folder and copy it over
  return await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns])
}

const copyFile = async (argv: Argv, fp: FilePath) => {
  let src = joinSegments(argv.directory, fp) as FilePath

  // Resolve symlinks
  const stats = await fs.promises.lstat(src)
  if (stats.isSymbolicLink()) {
    const resolvedPath = await fs.promises.realpath(src)
    console.log(`[Assets] Resolving symlink: ${src} -> ${resolvedPath}`)
    src = resolvedPath as FilePath
  }

  const name = slugifyFilePath(fp)
  const dest = joinSegments(argv.output, name) as FilePath

  // ensure dir exists
  const dir = path.dirname(dest) as FilePath
  await fs.promises.mkdir(dir, { recursive: true })

  await fs.promises.copyFile(src, dest)
  return dest
}

export const Assets: QuartzEmitterPlugin = () => {
  return {
    name: "Assets",
    async *emit(ctx) {
      const { argv, cfg, state } = ctx
      const fps = await filesToCopy(argv, cfg)
      const whitelist = state?.attachmentWhitelist

      // Statistics
      let copied = 0
      let filtered = 0
      let missing = 0

      for (const fp of fps) {
        // Check if this file should be copied
        const result = shouldCopyAttachment(fp, whitelist)

        if (result.action === "skip") {
          console.log(`[Assets] Skipping ${fp}: ${result.reason}`)
          filtered++
          continue
        }

        // Copy the file
        try {
          const dest = await copyFile(argv, fp)
          yield dest
          copied++
        } catch (err: any) {
          if (err.code === "ENOENT") {
            console.warn(`[Assets] Referenced attachment not found: ${fp}`)
            missing++
          } else {
            console.error(`[Assets] Failed to copy ${fp}:`, err)
            throw err
          }
        }
      }

      // Log summary
      if (whitelist) {
        console.log(
          `[Assets] Copied ${copied} attachments, filtered ${filtered} orphaned, ${missing} missing`,
        )
      } else {
        console.log(`[Assets] Copied ${copied} files (no attachment filtering)`)
      }
    },
    async *partialEmit(ctx, _content, _resources, changeEvents) {
      const whitelist = ctx.state?.attachmentWhitelist

      for (const changeEvent of changeEvents) {
        const ext = path.extname(changeEvent.path)
        if (ext === ".md") continue

        if (changeEvent.type === "add" || changeEvent.type === "change") {
          const result = shouldCopyAttachment(changeEvent.path, whitelist)
          if (result.action === "copy") {
            yield copyFile(ctx.argv, changeEvent.path)
          } else {
            console.log(`[Assets] Skipping ${changeEvent.path}: ${result.reason}`)
          }
        } else if (changeEvent.type === "delete") {
          const name = slugifyFilePath(changeEvent.path)
          const dest = joinSegments(ctx.argv.output, name) as FilePath
          await fs.promises.unlink(dest)
        }
      }
    },
  }
}
