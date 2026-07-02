import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { basename, imageMime } from '../util/path'

/**
 * Shows an image file from the project tree (instead of the text editor).
 * Bytes are pulled over IPC and wrapped in a blob URL; the URL is revoked when
 * the file changes or the component unmounts.
 */
export default function ImageViewer(): JSX.Element {
  const path = useStore((s) => s.activeAsset?.path ?? null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fit, setFit] = useState(true)

  useEffect(() => {
    if (!path) return
    let revoked: string | null = null
    let cancelled = false
    setError(null)
    setUrl(null)
    window.api
      .readBytes(path)
      .then((bytes) => {
        if (cancelled) return
        const blob = new Blob([bytes as BlobPart], { type: imageMime(path) })
        revoked = URL.createObjectURL(blob)
        setUrl(revoked)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [path])

  if (!path) return <div className="imgviewer" />

  return (
    <div className="imgviewer">
      <div className="imgviewer-toolbar">
        <span className="imgviewer-name">{basename(path)}</span>
        <button className="btn btn-icon" onClick={() => setFit((f) => !f)}>
          {fit ? 'Actual size' : 'Fit'}
        </button>
      </div>
      <div className="imgviewer-scroll">
        {error ? (
          <div className="imgviewer-error">Could not load image: {error}</div>
        ) : url ? (
          <img className={`imgviewer-img${fit ? ' fit' : ''}`} src={url} alt={basename(path)} />
        ) : (
          <div className="imgviewer-loading">Loading…</div>
        )}
      </div>
    </div>
  )
}
