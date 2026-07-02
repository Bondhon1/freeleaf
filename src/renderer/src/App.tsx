import { useEffect } from 'react'
import { Allotment } from 'allotment'
import { useStore } from './state/store'
import type { MenuAction } from '../../shared/types'
import Toolbar from './components/Toolbar'
import FileTree from './components/FileTree'
import Editor from './components/Editor'
import ImageViewer from './components/ImageViewer'
import PdfViewer from './components/PdfViewer'
import LogPanel from './components/LogPanel'
import Welcome from './components/Welcome'

/**
 * Route File-menu actions (pushed from the main process) to store actions.
 * Compilation is driven by open + save, not by keystrokes.
 */
function useMenuActions(): void {
  useEffect(() => {
    return window.api.onMenu((action: MenuAction, payload?: unknown) => {
      const s = useStore.getState()
      switch (action) {
        case 'open-project': {
          const rootPath = (payload as { rootPath?: string } | undefined)?.rootPath
          if (rootPath) void s.openProject(rootPath)
          break
        }
        case 'new-file':
          s.requestTreeAction('newFile')
          break
        case 'new-folder':
          s.requestTreeAction('newDir')
          break
        case 'save':
          void s.saveAndCompile()
          break
        case 'recompile':
          void s.runCompile()
          break
        case 'export-pdf':
          void s.exportPdf()
          break
        case 'export-zip':
          void s.exportSourceZip()
          break
        case 'sync-to-pdf':
          void s.syncToPdf()
          break
      }
    })
  }, [])
}

export default function App(): JSX.Element {
  const init = useStore((s) => s.init)
  const project = useStore((s) => s.project)
  const showImage = useStore((s) => !!s.activeAsset)
  const theme = useStore((s) => s.settings?.theme ?? 'dark')

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useMenuActions()

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
                  {showImage ? <ImageViewer /> : <Editor />}
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
