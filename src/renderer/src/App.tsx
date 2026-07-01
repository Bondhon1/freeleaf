import { useEffect, useRef } from 'react'
import { Allotment } from 'allotment'
import { useStore, selectIsDirty } from './state/store'
import Toolbar from './components/Toolbar'
import FileTree from './components/FileTree'
import Editor from './components/Editor'
import PdfViewer from './components/PdfViewer'
import LogPanel from './components/LogPanel'
import Welcome from './components/Welcome'

/** Debounced auto-compile: recompiles after the buffer is idle. */
function useAutoCompile(): void {
  const contents = useStore((s) => s.activeFile?.contents)
  const isDirty = useStore(selectIsDirty)
  const autoCompile = useStore((s) => s.settings?.autoCompile ?? true)
  const debounceMs = useStore((s) => s.settings?.debounceMs ?? 1200)
  const mainFile = useStore((s) => s.mainFile)
  const runCompile = useStore((s) => s.runCompile)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!autoCompile || !isDirty || !mainFile) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void runCompile(), debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [contents, isDirty, autoCompile, debounceMs, mainFile, runCompile])
}

export default function App(): JSX.Element {
  const init = useStore((s) => s.init)
  const project = useStore((s) => s.project)
  const theme = useStore((s) => s.settings?.theme ?? 'dark')

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useAutoCompile()

  return (
    <div className="app">
      <Toolbar />
      {!project ? (
        <Welcome />
      ) : (
        <div className="workspace">
          <Allotment defaultSizes={[220, 500, 500]}>
            <Allotment.Pane minSize={160} preferredSize={220}>
              <FileTree />
            </Allotment.Pane>
            <Allotment.Pane minSize={300}>
              <Allotment vertical defaultSizes={[600, 180]}>
                <Allotment.Pane minSize={120}>
                  <Editor />
                </Allotment.Pane>
                <Allotment.Pane minSize={36} preferredSize={180}>
                  <LogPanel />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
            <Allotment.Pane minSize={300}>
              <PdfViewer />
            </Allotment.Pane>
          </Allotment>
        </div>
      )}
    </div>
  )
}
