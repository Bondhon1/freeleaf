import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'

/**
 * Resolve the bundled Tectonic binary. In dev it lives in the repo's
 * resources/win; in a packaged app it is copied to <resources>/win.
 */
export function tectonicPath(): string {
  const rel = join('win', 'tectonic.exe')
  if (!app.isPackaged) {
    return join(app.getAppPath(), 'resources', rel)
  }
  return join(process.resourcesPath, rel)
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
    '--keep-intermediates',
    '--color',
    'never'
  ]

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let killed = false

    const child = spawn(tectonicPath(), args, {
      cwd: dirname(mainFile),
      env: { ...process.env, TECTONIC_CACHE_DIR: cacheDir() }
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
