// Downloads a pinned biber Windows binary into resources/win/biber.exe.
//
// WHY THIS IS PINNED: Tectonic does not ship biber. When a document uses
// biblatex, Tectonic shells out to whatever `biber` it finds on PATH. biber
// and biblatex are tightly version-locked (biber reads a `.bcf` control file
// whose version must match exactly). Tectonic's bundle ships biblatex 3.17,
// which writes a bcf 3.8 control file — that requires biber 2.17/2.18. A user
// with a newer biber (e.g. MiKTeX's 2.19, which wants bcf 3.10) would fail with
// "Found biblatex control file version 3.8, expected version 3.10". Bundling a
// matching biber and putting resources/win first on PATH makes bibliographies
// work deterministically regardless of what the user has installed.
//
// Runs on postinstall. Like fetch-tectonic, it is intentionally NON-FATAL: a
// failed download prints a warning and exits 0 so `npm install` still succeeds.

import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'

// Must stay compatible with the biblatex version in Tectonic's bundle (3.17 →
// bcf 3.8). biber 2.18 reads bcf 3.8. Bump this in lockstep if the pinned
// Tectonic bundle's biblatex ever changes.
const BIBER_VERSION = '2.18'
const ASSET = 'biber-MSWIN64.zip'
const URL =
  `https://downloads.sourceforge.net/project/biblatex-biber/biblatex-biber/` +
  `${BIBER_VERSION}/binaries/Windows/${ASSET}`

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const destDir = join(root, 'resources', 'win')
const exePath = join(destDir, 'biber.exe')

async function main() {
  if (existsSync(exePath)) {
    console.log(`[fetch-biber] Already present: ${exePath}`)
    return
  }
  mkdirSync(destDir, { recursive: true })

  const tmpZip = join(os.tmpdir(), `freeleaf-${ASSET}`)
  console.log(`[fetch-biber] Downloading biber ${BIBER_VERSION} ...`)
  console.log(`  ${URL}`)

  const res = await fetch(URL, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpZip))

  // Windows-only project: use PowerShell Expand-Archive to avoid a zip dep.
  console.log('[fetch-biber] Extracting ...')
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
    throw new Error(`biber.exe not found in archive at ${exePath}`)
  }
  console.log(`[fetch-biber] Ready: ${exePath}`)
}

main().catch((err) => {
  console.warn(`[fetch-biber] WARNING: could not fetch biber: ${err.message}`)
  console.warn('[fetch-biber] Run `npm run fetch-biber` once you are online.')
  // Non-fatal.
  process.exit(0)
})
