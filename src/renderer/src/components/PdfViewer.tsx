import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves this to a URL string for the worker bundle.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useStore } from '../state/store'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export default function PdfViewer(): JSX.Element {
  const pdfBytes = useStore((s) => s.pdfBytes)
  const pdfVersion = useStore((s) => s.pdfVersion)
  const status = useStore((s) => s.compileStatus)
  const pdfHighlight = useStore((s) => s.pdfHighlight)
  const hasPdf = useStore((s) => !!s.lastResult?.pdfPath)
  const exportPdf = useStore((s) => s.exportPdf)

  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.2)
  const [pageCount, setPageCount] = useState(0)
  const renderTokenRef = useRef(0)
  // Keep the current zoom readable inside imperative event handlers.
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  useEffect(() => {
    if (!pdfBytes || !containerRef.current) return
    const container = containerRef.current
    const token = ++renderTokenRef.current
    // Preserve scroll ratio across recompiles.
    const prevRatio =
      container.scrollHeight > 0 ? container.scrollTop / container.scrollHeight : 0

    let cancelled = false
    const task = pdfjsLib.getDocument({ data: pdfBytes.slice() })

    task.promise
      .then(async (pdf) => {
        if (cancelled || token !== renderTokenRef.current) return
        container.innerHTML = ''
        setPageCount(pdf.numPages)

        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled || token !== renderTokenRef.current) return
          const page = await pdf.getPage(n)
          const viewport = page.getViewport({ scale })
          // Wrap each canvas so a sync-highlight overlay can be positioned over it.
          const wrap = document.createElement('div')
          wrap.className = 'pdf-page-wrap'
          wrap.dataset.page = String(n)
          wrap.style.width = `${Math.floor(viewport.width)}px`
          wrap.style.height = `${Math.floor(viewport.height)}px`
          const canvas = document.createElement('canvas')
          const dpr = window.devicePixelRatio || 1
          canvas.width = Math.floor(viewport.width * dpr)
          canvas.height = Math.floor(viewport.height * dpr)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          canvas.className = 'pdf-page'
          wrap.appendChild(canvas)
          container.appendChild(wrap)
          const ctx = canvas.getContext('2d')!
          ctx.scale(dpr, dpr)
          await page.render({ canvasContext: ctx, viewport }).promise
        }
        if (!cancelled && token === renderTokenRef.current) {
          container.scrollTop = prevRatio * container.scrollHeight
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('[pdf] render failed:', err)
      })

    return () => {
      cancelled = true
    }
    // Re-render when a new PDF arrives or the zoom changes.
  }, [pdfVersion, scale, pdfBytes])

  // Forward sync: scroll to and briefly highlight the requested location.
  useEffect(() => {
    const h = pdfHighlight
    const container = containerRef.current
    if (!h || !container) return
    const wrap = container.querySelector<HTMLElement>(`.pdf-page-wrap[data-page="${h.page}"]`)
    if (!wrap) return

    const topPx = h.y * scale
    const overlay = document.createElement('div')
    overlay.className = 'pdf-sync-highlight'
    overlay.style.top = `${topPx}px`
    // Clamp so a large enclosing box can't flash most of the page.
    overlay.style.height = `${Math.min(Math.max(h.height * scale, 14), 48)}px`
    wrap.appendChild(overlay)

    const wrapTop = wrap.getBoundingClientRect().top - container.getBoundingClientRect().top
    const target = container.scrollTop + wrapTop + topPx - container.clientHeight / 3
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })

    const t = setTimeout(() => overlay.remove(), 1600)
    return () => {
      clearTimeout(t)
      overlay.remove()
    }
  }, [pdfHighlight, scale])

  // Reverse sync: double-click a spot in the PDF to jump to the source.
  const onDoubleClick = (e: React.MouseEvent): void => {
    const wrap = (e.target as HTMLElement).closest<HTMLElement>('.pdf-page-wrap')
    if (!wrap) return
    const canvas = wrap.querySelector('canvas')
    if (!canvas) return
    const page = parseInt(wrap.dataset.page ?? '0', 10)
    const rect = canvas.getBoundingClientRect()
    const s = scaleRef.current
    const xPt = (e.clientX - rect.left) / s
    const yPt = (e.clientY - rect.top) / s
    void useStore.getState().syncFromPdf(page, xPt, yPt)
  }

  return (
    <div className="pdfviewer">
      <div className="pdf-toolbar">
        <button className="btn btn-icon" onClick={() => setScale((s) => Math.max(0.4, s - 0.15))}>
          −
        </button>
        <span className="pdf-zoom">{Math.round(scale * 100)}%</span>
        <button className="btn btn-icon" onClick={() => setScale((s) => Math.min(3, s + 0.15))}>
          ＋
        </button>
        {pageCount > 0 && <span className="pdf-pages">{pageCount} pages</span>}
        {status === 'compiling' && <span className="pdf-compiling">compiling…</span>}
        <button
          className="btn btn-icon pdf-export"
          title="Export PDF…"
          disabled={!hasPdf}
          onClick={() => void exportPdf()}
        >
          ⭳ PDF
        </button>
      </div>
      <div className="pdf-scroll" ref={containerRef} onDoubleClick={onDoubleClick}>
        {!pdfBytes && (
          <div className="pdf-empty">
            {status === 'error'
              ? 'Compilation failed — see the Problems panel.'
              : 'The compiled PDF will appear here.'}
          </div>
        )}
      </div>
      {pdfBytes && <div className="pdf-hint">Double-click the PDF to jump to its source</div>}
    </div>
  )
}
