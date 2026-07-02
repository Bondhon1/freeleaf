import { isAbsolute, resolve } from 'node:path'
import type { LogEntry } from '../shared/types'

// A compact, self-contained TeX .log parser. It is not exhaustive but handles
// the cases that matter for an editor: hard errors (lines beginning with "!"),
// their "l.<n>" line indicators, and the common LaTeX/box warnings.
//
// TeX tracks the current file with balanced "(path" / ")" tokens in the log; we
// keep a lightweight stack so each entry can be attributed to a file.

const ERROR_RE = /^! (.+)$/
const LINE_RE = /^l\.(\d+)\s?(.*)$/
const LATEX_WARNING_RE = /^(?:LaTeX|Package|Class)[^\n]*Warning: (.+?)(?: on input line (\d+))?\.?$/
const BOX_WARNING_RE = /^(Overfull|Underfull) \\[hv]box .*(?:lines? (\d+))/

/** Track the file stack by scanning parens on a line; returns the top file. */
function updateFileStack(line: string, stack: string[]): string | null {
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '(') {
      // Read a following path token (until whitespace or paren).
      const m = /^\(([^()\s]*)/.exec(line.slice(i))
      const path = m?.[1] ?? ''
      stack.push(path)
      i += 1 + (m ? m[1].length : 0)
    } else if (ch === ')') {
      stack.pop()
      i += 1
    } else {
      i += 1
    }
  }
  for (let k = stack.length - 1; k >= 0; k--) {
    if (stack[k] && /\.(tex|sty|cls|ltx)$/i.test(stack[k])) return stack[k]
  }
  return stack.length ? stack[stack.length - 1] || null : null
}

/**
 * Parse a TeX .log into structured entries. File paths in the log are relative
 * to the compile working directory, so `baseDir` (that directory) is used to
 * make each entry's `file` absolute — otherwise the renderer would try to open
 * it relative to the app's own cwd. Paths already absolute are left as-is.
 */
export function parseLog(rawLog: string, baseDir?: string): LogEntry[] {
  if (!rawLog.trim()) return []
  const lines = rawLog.split(/\r?\n/)
  const entries: LogEntry[] = []
  const fileStack: string[] = []
  const seen = new Set<string>()

  const abs = (f: string | null): string | null =>
    f && baseDir && !isAbsolute(f) ? resolve(baseDir, f) : f

  const push = (e: LogEntry): void => {
    const key = `${e.level}|${e.message}|${e.line ?? ''}|${e.file ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push(e)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const currentFile = updateFileStack(line, fileStack)

    // Hard error: "! <message>" possibly followed later by "l.<n> <context>".
    const errM = ERROR_RE.exec(line)
    if (errM) {
      let msg = errM[1].trim()
      let lineNo: number | null = null
      const context: string[] = []
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        const lm = LINE_RE.exec(lines[j])
        if (lm) {
          lineNo = parseInt(lm[1], 10)
          break
        }
        if (lines[j].trim()) context.push(lines[j].trim())
      }
      if (context.length && !/Error/.test(msg)) msg = `${msg} ${context[0]}`
      push({
        level: 'error',
        message: msg,
        file: abs(currentFile),
        line: lineNo,
        raw: [line, ...context].join('\n')
      })
      continue
    }

    // LaTeX / Package / Class warnings.
    const warnM = LATEX_WARNING_RE.exec(line)
    if (warnM) {
      push({
        level: 'warning',
        message: warnM[1].trim(),
        file: abs(currentFile),
        line: warnM[2] ? parseInt(warnM[2], 10) : null,
        raw: line
      })
      continue
    }

    // Overfull / Underfull boxes → typesetting hints.
    const boxM = BOX_WARNING_RE.exec(line)
    if (boxM) {
      push({
        level: 'typesetting',
        message: line.trim(),
        file: abs(currentFile),
        line: boxM[2] ? parseInt(boxM[2], 10) : null,
        raw: line
      })
      continue
    }
  }

  return entries
}
