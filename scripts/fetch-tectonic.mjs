// Downloads a pinned Tectonic Windows binary into resources/win/tectonic.exe.
//
// Runs on postinstall. It is intentionally NON-FATAL: if the download fails
// (e.g. offline install), it prints a warning and exits 0 so `npm install`
// still succeeds. The app detects a missing engine at runtime and the user can
// re-run `npm run fetch-tectonic` once online.

import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'

const TECTONIC_VERSION = '0.15.0'
const ASSET = `tectonic-${TECTONIC_VERSION}-x86_64-pc-windows-msvc.zip`
const URL =
  `https://github.com/tectonic-typesetting/tectonic/releases/download/` +
  `tectonic%40${TECTONIC_VERSION}/${ASSET}`

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const destDir = join(root, 'resources', 'win')
const exePath = join(destDir, 'tectonic.exe')

async function main() {
  if (existsSync(exePath)) {
    console.log(`[fetch-tectonic] Already present: ${exePath}`)
    return
  }
  mkdirSync(destDir, { recursive: true })

  const tmpZip = join(os.tmpdir(), `freeleaf-${ASSET}`)
  console.log(`[fetch-tectonic] Downloading Tectonic ${TECTONIC_VERSION} ...`)
  console.log(`  ${URL}`)

  const res = await fetch(URL, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpZip))

  // Windows-only project: use PowerShell Expand-Archive to avoid a zip dep.
  console.log('[fetch-tectonic] Extracting ...')
  const unzip = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path "${tmpZip}" -DestinationPath "${destDir}" -Force`
    ],
    { stdio: 'inherit' }
  )
  rmSync(tmpZip, { force: true })

  if (unzip.status !== 0) {
    throw new Error(`Expand-Archive exited with code ${unzip.status}`)
  }
  if (!existsSync(exePath)) {
    throw new Error(`tectonic.exe not found in archive at ${exePath}`)
  }
  console.log(`[fetch-tectonic] Ready: ${exePath}`)
}

main().catch((err) => {
  console.warn(`[fetch-tectonic] WARNING: could not fetch Tectonic: ${err.message}`)
  console.warn('[fetch-tectonic] Run `npm run fetch-tectonic` once you are online.')
  // Non-fatal.
  process.exit(0)
})
