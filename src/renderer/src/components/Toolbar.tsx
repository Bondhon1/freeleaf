import { useMemo } from 'react'
import { useStore, selectIsDirty } from '../state/store'
import type { FileNode } from '../../../shared/types'

function collectTex(nodes: FileNode[], acc: string[]): void {
  for (const n of nodes) {
    if (n.isDir && n.children) collectTex(n.children, acc)
    else if (!n.isDir && n.name.toLowerCase().endsWith('.tex')) acc.push(n.path)
  }
}

export default function Toolbar(): JSX.Element {
  const project = useStore((s) => s.project)
  const mainFile = useStore((s) => s.mainFile)
  const setMainFile = useStore((s) => s.setMainFile)
  const runCompile = useStore((s) => s.runCompile)
  const syncToPdf = useStore((s) => s.syncToPdf)
  const compileStatus = useStore((s) => s.compileStatus)
  const lastResult = useStore((s) => s.lastResult)
  const settings = useStore((s) => s.settings)
  const patchSettings = useStore((s) => s.patchSettings)
  const openProjectDialog = useStore((s) => s.openProjectDialog)
  const isDirty = useStore(selectIsDirty)
  const hasPdf = !!lastResult?.pdfPath

  const texFiles = useMemo(() => {
    if (!project) return []
    const acc: string[] = []
    collectTex(project.tree, acc)
    return acc
  }, [project])

  const rel = (p: string): string =>
    project ? p.slice(project.rootPath.length).replace(/^[\\/]/, '') : p

  const statusLabel =
    compileStatus === 'compiling'
      ? 'Compiling…'
      : compileStatus === 'success'
        ? `Compiled in ${lastResult?.durationMs ?? 0} ms`
        : compileStatus === 'error'
          ? 'Compile failed'
          : 'Ready'

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="brand">FreeLeaf</span>
        <button className="btn" onClick={() => void openProjectDialog()}>
          Open Folder
        </button>
      </div>

      {project && (
        <div className="toolbar-center">
          <button
            className="btn btn-primary"
            disabled={!mainFile || compileStatus === 'compiling'}
            onClick={() => void runCompile()}
            title="Recompile (Ctrl+Enter)"
          >
            {compileStatus === 'compiling' ? '⏳ Compiling' : '▶ Recompile'}
          </button>

          <button
            className="btn"
            disabled={!hasPdf}
            onClick={() => void syncToPdf()}
            title="Scroll the PDF to the cursor position (Ctrl+J)"
          >
            ⌖ Sync to PDF
          </button>

          <label className="main-select">
            Main:
            <select
              value={mainFile ?? ''}
              onChange={(e) => setMainFile(e.target.value || null!)}
            >
              {!mainFile && <option value="">— select —</option>}
              {texFiles.map((f) => (
                <option key={f} value={f}>
                  {rel(f)}
                </option>
              ))}
            </select>
          </label>

          <label className="auto-toggle" title="Recompile automatically when a project opens and on save (Ctrl+S)">
            <input
              type="checkbox"
              checked={settings?.autoCompile ?? true}
              onChange={(e) => void patchSettings({ autoCompile: e.target.checked })}
            />
            Auto-compile
          </label>
        </div>
      )}

      <div className="toolbar-right">
        <span className={`status status-${compileStatus}`}>
          {isDirty && <span className="dirty-dot" title="Unsaved changes">●</span>} {statusLabel}
        </span>
        <button
          className="btn btn-icon"
          title="Toggle theme"
          onClick={() =>
            void patchSettings({ theme: settings?.theme === 'dark' ? 'light' : 'dark' })
          }
        >
          {settings?.theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </div>
  )
}
