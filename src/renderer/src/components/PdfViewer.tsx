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
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.2)
  const [pageCount, setPageCount] = useState(0)
  const renderTokenRef = useRef(0)

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
          const canvas = document.createElement('canvas')
          const dpr = window.devicePixelRatio || 1
          canvas.width = Math.floor(viewport.width * dpr)
          canvas.height = Math.floor(viewport.height * dpr)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          canvas.className = 'pdf-page'
          container.appendChild(canvas)
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
      </div>
      <div className="pdf-scroll" ref={containerRef}>
        {!pdfBytes && (
          <div className="pdf-empty">
            {status === 'error'
              ? 'Compilation failed — see the Problems panel.'
              : 'The compiled PDF will appear here.'}
          </div>
        )}
      </div>
    </div>
  )
}
