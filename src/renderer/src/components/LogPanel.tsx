import { useState } from 'react'
import { useStore } from '../state/store'
import { basename } from '../util/path'

export default function LogPanel(): JSX.Element {
  const entries = useStore((s) => s.logEntries)
  const rawLog = useStore((s) => s.lastResult?.rawLog ?? '')
  const status = useStore((s) => s.compileStatus)
  const gotoLine = useStore((s) => s.gotoLine)
  const [showRaw, setShowRaw] = useState(false)

  const errors = entries.filter((e) => e.level === 'error').length
  const warnings = entries.filter((e) => e.level === 'warning').length

  return (
    <div className="logpanel">
      <div className="logpanel-header">
        <span className="log-tab active">Problems</span>
        <span className="log-counts">
          <span className="count err">✖ {errors}</span>
          <span className="count warn">⚠ {warnings}</span>
        </span>
        <button className="btn btn-icon log-raw-toggle" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'List' : 'Raw log'}
        </button>
      </div>

      <div className="logpanel-body">
        {showRaw ? (
          <pre className="raw-log">{rawLog || '(no log yet)'}</pre>
        ) : entries.length === 0 ? (
          <div className="log-empty">
            {status === 'success' ? '✔ No problems. Compiled cleanly.' : 'No problems reported.'}
          </div>
        ) : (
          entries.map((e, i) => (
            <div
              key={i}
              className={`log-entry level-${e.level}${e.line ? ' clickable' : ''}`}
              onClick={() => e.line && void gotoLine(e.line, e.file)}
              title={e.raw}
            >
              <span className="log-icon">
                {e.level === 'error' ? '✖' : e.level === 'warning' ? '⚠' : 'ℹ'}
              </span>
              <span className="log-msg">{e.message}</span>
              {e.line != null && (
                <span className="log-loc">
                  {e.file ? basename(e.file) : ''}:{e.line}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
