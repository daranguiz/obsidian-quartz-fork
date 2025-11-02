import path from "path"
import fs from "fs"

export interface BuildWarning {
  filePath: string
  errorType: string
  lineNumber?: number
  details: string
  timestamp: Date
}

// Global warning collection
const warnings: BuildWarning[] = []

/**
 * Collect a build warning for later reporting
 */
export function collectWarning(
  filePath: string,
  errorType: string,
  details: string,
  lineNumber?: number,
): void {
  warnings.push({
    filePath,
    errorType,
    lineNumber,
    details,
    timestamp: new Date(),
  })
  console.warn(`[RedactionMarkers] ${filePath}:${lineNumber || "?"} - ${details}`)
}

/**
 * Generate HTML report of all warnings
 */
export function generateWarningsReport(buildMode: string, outputDir: string): void {
  if (warnings.length === 0) {
    return // Don't create file if no warnings
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Build Warnings - Redaction Markers</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #d32f2f;
      border-bottom: 3px solid #d32f2f;
      padding-bottom: 10px;
    }
    .meta {
      background-color: #fff;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .meta p {
      margin: 5px 0;
      color: #666;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      background-color: #fff;
      margin-bottom: 15px;
      padding: 15px;
      border-left: 4px solid #ff9800;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .file-path {
      font-weight: bold;
      color: #1976d2;
      font-family: 'Courier New', monospace;
    }
    .error-type {
      display: inline-block;
      background-color: #ff9800;
      color: white;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      margin-left: 10px;
    }
    .details {
      margin-top: 8px;
      color: #444;
    }
    .line-number {
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <h1>Build Warnings Report</h1>
  <div class="meta">
    <p><strong>Build Mode:</strong> ${buildMode}</p>
    <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    <p><strong>Total Warnings:</strong> ${warnings.length}</p>
  </div>
  <ul>
${warnings
  .map(
    (w) => `    <li>
      <div>
        <span class="file-path">${w.filePath}</span>
        <span class="error-type">${w.errorType}</span>
        ${w.lineNumber ? `<span class="line-number"> at line ${w.lineNumber}</span>` : ""}
      </div>
      <div class="details">${w.details}</div>
    </li>`,
  )
  .join("\n")}
  </ul>
</body>
</html>`

  const outputPath = path.join(outputDir, "build-warnings.html")
  fs.writeFileSync(outputPath, html, "utf-8")
  console.log(`[RedactionMarkers] Generated warning report: ${outputPath}`)
}

/**
 * Check if there are any warnings
 */
export function hasWarnings(): boolean {
  return warnings.length > 0
}

/**
 * Clear all warnings (useful for fresh builds)
 */
export function clearWarnings(): void {
  warnings.length = 0
}
