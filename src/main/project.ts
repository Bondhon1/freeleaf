import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  existsSync
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, basename, extname } from 'node:path'
import type { FileNode, ProjectInfo } from '../shared/types'

const IGNORE = new Set(['node_modules', '.git', '.freeleaf-build', '.DS_Store'])

/** Recursively build a sorted file tree (dirs first, then files, alpha). */
export function buildTree(dir: string): FileNode[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const nodes: FileNode[] = []
  for (const name of entries) {
    if (IGNORE.has(name)) continue
    const full = join(dir, name)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    nodes.push({
      name,
      path: full,
      isDir,
      children: isDir ? buildTree(full) : undefined
    })
  }
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

function collectTexFiles(nodes: FileNode[], acc: string[]): void {
  for (const n of nodes) {
    if (n.isDir && n.children) collectTexFiles(n.children, acc)
    else if (!n.isDir && n.name.toLowerCase().endsWith('.tex')) acc.push(n.path)
  }
}

/** Heuristic: the first .tex containing \documentclass (main.tex preferred). */
export function guessMainFile(tree: FileNode[]): string | null {
  const texFiles: string[] = []
  collectTexFiles(tree, texFiles)
  if (texFiles.length === 0) return null

  const withClass: string[] = []
  for (const f of texFiles) {
    try {
      if (/\\documentclass/.test(readFileSync(f, 'utf8'))) withClass.push(f)
    } catch {
      /* ignore unreadable */
    }
  }
  const pool = withClass.length ? withClass : texFiles
  const preferred = pool.find((f) => basename(f).toLowerCase() === 'main.tex')
  return preferred ?? pool[0]
}

export function loadProject(rootPath: string): ProjectInfo {
  const tree = buildTree(rootPath)
  return {
    rootPath,
    name: basename(rootPath),
    tree,
    mainFile: guessMainFile(tree)
  }
}

const STARTER_MAIN = `\\documentclass{article}

\\title{Untitled}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

Start writing here.

\\end{document}
`

/** Pick a directory path that does not exist yet, appending " (n)" if needed. */
function uniqueDir(parent: string, name: string): string {
  let candidate = join(parent, name)
  let n = 2
  while (existsSync(candidate)) {
    candidate = join(parent, `${name} (${n++})`)
  }
  return candidate
}

/**
 * Create a new project folder under `parent` with a starter main.tex, and
 * return it loaded. `name` is sanitized to a safe folder name.
 */
export function createProject(parent: string, name: string): ProjectInfo {
  const safe = name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'Untitled Project'
  const root = uniqueDir(parent, safe)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'main.tex'), STARTER_MAIN, 'utf8')
  return loadProject(root)
}

/**
 * Extract a project .zip (e.g. an Overleaf export) into a sibling folder and
 * return it loaded. Windows-only: uses PowerShell Expand-Archive, matching the
 * approach in scripts/fetch-*.mjs, so no unzip dependency is needed.
 *
 * Overleaf zips place files at the archive root; if instead everything is
 * nested under a single top-level folder we unwrap that so the project root is
 * the folder actually containing the .tex files.
 */
export function importZip(zipPath: string): ProjectInfo {
  const parent = join(zipPath, '..')
  const base = basename(zipPath, extname(zipPath))
  const root = uniqueDir(parent, base)
  mkdirSync(root, { recursive: true })

  const res = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${root}" -Force`
    ],
    { encoding: 'utf8' }
  )
  if (res.status !== 0) {
    rmSync(root, { recursive: true, force: true })
    throw new Error(`Failed to extract zip: ${res.stderr || `exit ${res.status}`}`)
  }

  // Unwrap a single top-level directory (common when zipping a whole folder).
  const entries = readdirSync(root).filter((e) => !IGNORE.has(e))
  if (entries.length === 1 && statSync(join(root, entries[0])).isDirectory()) {
    return loadProject(join(root, entries[0]))
  }
  return loadProject(root)
}

// --- File operations (used by IPC) ---

export function readFile(path: string): string {
  return readFileSync(path, 'utf8')
}

export function writeFile(path: string, contents: string): void {
  writeFileSync(path, contents, 'utf8')
}

export function createFile(dir: string, name: string): string {
  const full = join(dir, name)
  writeFileSync(full, '', { flag: 'wx' })
  return full
}

export function createDir(dir: string, name: string): string {
  const full = join(dir, name)
  mkdirSync(full, { recursive: false })
  return full
}

export function rename(oldPath: string, newPath: string): void {
  renameSync(oldPath, newPath)
}

export function deletePath(path: string): void {
  rmSync(path, { recursive: true, force: true })
}
