import { readFileSync, statSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import type { SyncSource, SyncLocation } from '../shared/types'

// --- SyncTeX (.synctex.gz) parsing -----------------------------------------
//
// SyncTeX links positions in the PDF to positions in the .tex sources so the
// editor and preview can jump to each other (as Overleaf does). Tectonic is
// invoked with --synctex, which emits "<job>.synctex.gz" next to the PDF.
//
// The file is a gzipped text log. Its preamble maps numeric "tags" to input
// file paths; the body lists geometry records per page. All coordinates are in
// TeX "scaled points" (sp), 65536 per point, measured from the page's top-left
// (the standard 1in offset is already baked in). We divide by 65536 to get PDF
// points, which is the unit the viewer works in.

const SP_PER_PT = 65536

interface SyncRecord {
  page: number
  tag: number
  line: number
  /** horizontal position from page left, in sp */
  h: number
  /** vertical position (baseline) from page top, in sp */
  v: number
  /** box width in sp, or null for point records (glue/kern/math/char) */
  width: number | null
  /** box height above baseline in sp */
  height: number
  /** box depth below baseline in sp */
  depth: number
}

interface SyncData {
  /** tag → absolute source file path */
  inputs: Map<number, string>
  records: SyncRecord[]
}

interface CacheEntry {
  mtimeMs: number
  data: SyncData
}

const cache = new Map<string, CacheEntry>()

/** Locate the SyncTeX file that accompanies a PDF (.synctex.gz preferred). */
function synctexPathFor(pdfPath: string): string | null {
  const base = pdfPath.replace(/\.pdf$/i, '')
  for (const p of [`${base}.synctex.gz`, `${base}.synctex`]) {
    if (existsSync(p)) return p
  }
  return null
}

// Matches a geometry record:  T tag,line[,col] : h , v [ : W , H , D ]
// where T is one of the box/leaf record type characters.
const RECORD_RE = /^([[(vhxkg$])(\d+),(\d+)(?:,\d+)?:(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+),(-?\d+))?/

function parse(synctexPath: string, sourceBase: string): SyncData {
  const raw = synctexPath.endsWith('.gz')
    ? gunzipSync(readFileSync(synctexPath)).toString('utf8')
    : readFileSync(synctexPath, 'utf8')

  const inputs = new Map<number, string>()
  const records: SyncRecord[] = []
  let page = 0

  for (const line of raw.split('\n')) {
    if (line.startsWith('Input:')) {
      // Input:<tag>:<path>
      const rest = line.slice('Input:'.length)
      const colon = rest.indexOf(':')
      if (colon > 0) {
        const tag = parseInt(rest.slice(0, colon), 10)
        const p = rest.slice(colon + 1).trim()
        if (!Number.isNaN(tag) && p) {
          inputs.set(tag, resolve(sourceBase, p))
        }
      }
      continue
    }
    if (line.charCodeAt(0) === 123 /* { */) {
      const n = parseInt(line.slice(1), 10)
      if (!Number.isNaN(n)) page = n
      continue
    }
    const m = RECORD_RE.exec(line)
    if (!m) continue
    const boxed = m[6] !== undefined
    records.push({
      page,
      tag: parseInt(m[2], 10),
      line: parseInt(m[3], 10),
      h: parseInt(m[4], 10),
      v: parseInt(m[5], 10),
      width: boxed ? parseInt(m[6], 10) : null,
      height: boxed ? parseInt(m[7], 10) : 0,
      depth: boxed ? parseInt(m[8], 10) : 0
    })
  }

  return { inputs, records }
}

/** Parse (with mtime caching) the SyncTeX data for a PDF, or null if absent. */
function load(pdfPath: string): SyncData | null {
  const sPath = synctexPathFor(pdfPath)
  if (!sPath) return null
  // Sources live in the compile cwd, i.e. the parent of the .freeleaf-build dir
  // that holds the PDF (see compile.ts buildDir()).
  const sourceBase = dirname(dirname(pdfPath))

  let mtimeMs = 0
  try {
    mtimeMs = statSync(sPath).mtimeMs
  } catch {
    return null
  }
  const hit = cache.get(sPath)
  if (hit && hit.mtimeMs === mtimeMs) return hit.data

  const data = parse(sPath, sourceBase)
  cache.set(sPath, { mtimeMs, data })
  return data
}

/**
 * Reverse lookup: given a click at (xPt, yPt) in PDF points from the top-left
 * of `page`, return the source file + line it corresponds to. Prefers the
 * smallest box that contains the point; otherwise the nearest record.
 */
export function reverse(pdfPath: string, page: number, xPt: number, yPt: number): SyncSource | null {
  const data = load(pdfPath)
  if (!data) return null
  const x = xPt * SP_PER_PT
  const y = yPt * SP_PER_PT

  // Pass 1: smallest box (real height/depth) whose extent contains the point.
  // Also remember the nearest record overall as a fallback for clicks in margins.
  let box: SyncRecord | null = null
  let boxArea = Infinity
  let boxBounds = { left: 0, right: 0, top: 0, bottom: 0 }
  let nearest: SyncRecord | null = null
  let nearestDist = Infinity

  for (const r of data.records) {
    if (r.page !== page || r.line <= 0) continue
    if (r.width !== null) {
      const left = Math.min(r.h, r.h + r.width)
      const right = Math.max(r.h, r.h + r.width)
      const top = r.v - r.height
      const bottom = r.v + r.depth
      if (x >= left && x <= right && y >= top && y <= bottom && bottom > top) {
        const area = (right - left) * (bottom - top)
        if (area < boxArea) {
          boxArea = area
          box = r
          boxBounds = { left, right, top, bottom }
        }
      }
    }
    const dx = x - r.h
    const dy = y - r.v
    const dist = dx * dx + dy * dy
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = r
    }
  }

  // Pass 2: descend into the containing box. Its leaf children (glyphs, glue,
  // kerns) carry the true source line, whereas the box itself is often tagged
  // with the paragraph's end line. Pick the child nearest the click horizontally.
  let chosen = box ?? nearest
  if (box) {
    let childDist = Infinity
    for (const r of data.records) {
      if (r === box || r.page !== page || r.line <= 0) continue
      if (r.h < boxBounds.left || r.h > boxBounds.right) continue
      if (r.v < boxBounds.top || r.v > boxBounds.bottom) continue
      const dist = Math.abs(x - r.h) + Math.abs(y - r.v)
      if (dist < childDist) {
        childDist = dist
        chosen = r
      }
    }
  }

  if (!chosen) return null
  const file = data.inputs.get(chosen.tag)
  if (!file) return null
  return { file, line: chosen.line }
}

/**
 * Forward lookup: given a source `file` + `line`, return the PDF location to
 * scroll to. Picks the record on the given line (or the closest line) that sits
 * highest on the earliest page.
 */
export function forward(pdfPath: string, file: string, line: number): SyncLocation | null {
  const data = load(pdfPath)
  if (!data) return null

  // Find the tag(s) for this file (paths compared case-insensitively on Windows).
  const target = resolve(file).toLowerCase()
  const tags = new Set<number>()
  for (const [tag, p] of data.inputs) {
    if (p.toLowerCase() === target) tags.add(tag)
  }
  if (tags.size === 0) return null

  let best: SyncRecord | null = null
  let bestLineDelta = Infinity
  for (const r of data.records) {
    if (!tags.has(r.tag) || r.line <= 0) continue
    const delta = Math.abs(r.line - line)
    // Prefer the closest line; tie-break by earliest page then topmost position.
    // (Deliberately not by box size: the tightest topmost record gives a better
    // scroll target than a large enclosing box that spans much of the page.)
    if (
      delta < bestLineDelta ||
      (delta === bestLineDelta &&
        best !== null &&
        (r.page < best.page || (r.page === best.page && r.v < best.v)))
    ) {
      bestLineDelta = delta
      best = r
    }
  }
  if (!best) return null

  return {
    page: best.page,
    x: best.h / SP_PER_PT,
    y: (best.v - best.height) / SP_PER_PT,
    height: (best.height + best.depth) / SP_PER_PT
  }
}
