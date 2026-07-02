// Tiny path helpers for the renderer (no node access).

export function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export function extname(p: string): string {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i >= 0 ? b.slice(i).toLowerCase() : ''
}

const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.ico',
  '.avif'
])

/** MIME type to attach to an image Blob so the browser renders it correctly. */
const IMAGE_MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
}

export type FileKind = 'text' | 'image'

/** Classify a file for editor routing (image viewer vs. text editor). */
export function fileKind(p: string): FileKind {
  return IMAGE_EXTS.has(extname(p)) ? 'image' : 'text'
}

export function imageMime(p: string): string {
  const ext = extname(p)
  return IMAGE_MIME[ext] ?? `image/${ext.slice(1)}`
}
