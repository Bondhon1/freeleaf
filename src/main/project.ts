import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  rmSync
} from 'node:fs'
import { join, basename } from 'node:path'
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
