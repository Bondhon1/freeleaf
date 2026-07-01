import { join, basename, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { runTectonic, cancel, tectonicAvailable } from './tectonic'
import { parseLog } from './logParser'
import type { CompileRequest, CompileResult, LogEntry } from '../shared/types'

/** Build output dir lives next to the main file to keep synctex paths sane. */
function buildDir(mainFile: string): string {
  return join(dirname(mainFile), '.freeleaf-build')
}

export async function compile(req: CompileRequest): Promise<CompileResult> {
  const started = Date.now()

  if (!tectonicAvailable()) {
    return {
      ok: false,
      pdfPath: null,
      durationMs: 0,
      entries: [],
      rawLog: '',
      fatal:
        'Tectonic engine not found. Run `npm run fetch-tectonic` (needs internet) to install it.'
    }
  }

  const mainAbs = req.mainFile
  const outDir = buildDir(mainAbs)
  const result = await runTectonic(mainAbs, outDir)
  const durationMs = Date.now() - started

  // A superseded (killed) compile: report as a soft failure with no entries.
  if (result.killed) {
    return { ok: false, pdfPath: null, durationMs, entries: [], rawLog: result.stderr }
  }

  const jobName = basename(mainAbs).replace(/\.tex$/i, '')
  const logPath = join(outDir, `${jobName}.log`)
  const pdfPath = join(outDir, `${jobName}.pdf`)

  let logText = ''
  if (existsSync(logPath)) {
    try {
      logText = readFileSync(logPath, 'utf8')
    } catch {
      /* ignore */
    }
  }
  const rawLog = [result.stdout, result.stderr, logText].filter(Boolean).join('\n')

  const entries: LogEntry[] = parseLog(logText)
  const hasPdf = existsSync(pdfPath)
  const ok = result.code === 0 && hasPdf

  // Surface Tectonic's own fatal stderr when nothing structured was parsed.
  if (!ok && !entries.some((e) => e.level === 'error')) {
    const stderrErr = result.stderr
      .split('\n')
      .filter((l) => /error:/i.test(l))
      .join('\n')
      .trim()
    if (stderrErr) {
      entries.unshift({ level: 'error', message: stderrErr, file: null, line: null, raw: stderrErr })
    }
  }

  return {
    ok,
    pdfPath: hasPdf ? pdfPath : null,
    durationMs,
    entries,
    rawLog
  }
}

export function cancelCompile(): void {
  cancel()
}
