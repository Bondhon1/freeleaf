import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, basename, dirname, delimiter } from 'node:path'

/**
 * Directory holding the bundled command-line tools (tectonic.exe, biber.exe).
 * In dev it is the repo's resources/win; in a packaged app it is <resources>/win.
 */
function toolsDir(): string {
  if (!app.isPackaged) {
    return join(app.getAppPath(), 'resources', 'win')
  }
  return join(process.resourcesPath, 'win')
}

/** Resolve the bundled Tectonic binary. */
export function tectonicPath(): string {
  return join(toolsDir(), 'tectonic.exe')
}

export function tectonicAvailable(): boolean {
  return existsSync(tectonicPath())
}

/** Persistent package/format cache so compiles are offline after first use. */
function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'tectonic-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  killed: boolean
}

let current: ChildProcess | null = null

/**
 * Compile `mainFile` (absolute) with Tectonic. Output goes to `outDir`.
 * Any previously running compile is killed first (auto-compile supersede).
 */
export function runTectonic(mainFile: string, outDir: string): Promise<RunResult> {
  cancel()
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const args = [
    '-X',
    'compile',
    basename(mainFile),
    '--outdir',
    outDir,
    '--synctex',
    '--keep-logs',
    '--keep-intermediates'
  ]

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let killed = false

    // Put the bundled tools dir first on PATH so Tectonic invokes OUR biber
    // (version-matched to the bundle's biblatex) rather than any biber the user
    // happens to have installed (e.g. MiKTeX's, which is often too new).
    const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
    const child = spawn(tectonicPath(), args, {
      cwd: dirname(mainFile),
      env: {
        ...process.env,
        TECTONIC_CACHE_DIR: cacheDir(),
        [pathKey]: `${toolsDir()}${delimiter}${process.env[pathKey] ?? ''}`
      }
    })
    current = child

    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      stderr += `\n[spawn error] ${err.message}`
    })
    child.on('close', (code) => {
      if (current === child) current = null
      resolve({ code, stdout, stderr, killed })
    })

    // Mark supersede kills so the caller can ignore their (garbage) result.
    child.once('exit', (_c, signal) => {
      if (signal) killed = true
    })
  })
}

/** Kill the in-flight compile, if any. */
export function cancel(): void {
  if (current) {
    current.kill()
    current = null
  }
}
