import { create } from 'zustand'
import type {
  ProjectInfo,
  FileNode,
  LogEntry,
  AppSettings,
  CompileResult
} from '../../../shared/types'
import { basename, fileKind } from '../util/path'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'

interface OpenFile {
  path: string
  /** Current editor contents. */
  contents: string
  /** Contents last written to disk. */
  savedContents: string
}

/** Where the editor caret currently sits (drives forward sync). */
interface Cursor {
  file: string
  line: number
}

/** A forward-sync target in the PDF (nonce forces the viewer to re-fire). */
interface PdfHighlight {
  page: number
  x: number
  y: number
  height: number
  nonce: number
}

/** A menu-driven request for the file tree (nonce forces re-fire). */
interface TreeRequest {
  kind: 'newFile' | 'newDir'
  nonce: number
}

interface AppState {
  project: ProjectInfo | null
  settings: AppSettings | null
  engineAvailable: boolean

  activeFile: OpenFile | null
  /** A non-text file (image) shown in the viewer instead of the editor. */
  activeAsset: { path: string } | null
  mainFile: string | null
  cursor: Cursor | null

  compileStatus: CompileStatus
  lastResult: CompileResult | null
  logEntries: LogEntry[]
  pdfBytes: Uint8Array | null
  /** Bumped on each successful compile so the viewer knows to reload. */
  pdfVersion: number

  /** A request to move the editor cursor to a line (nonce forces re-fire). */
  gotoRequest: { line: number; nonce: number } | null
  /** A request to scroll+highlight a location in the PDF (forward sync). */
  pdfHighlight: PdfHighlight | null
  /** A menu-driven new file/folder request, consumed by the file tree. */
  treeRequest: TreeRequest | null

  // actions
  init(): Promise<void>
  openProjectDialog(): Promise<void>
  newProject(): Promise<void>
  importProjectZip(): Promise<void>
  openProject(rootPath: string): Promise<void>
  refreshTree(): Promise<void>
  openFile(path: string): Promise<void>
  setEditorContents(contents: string): void
  setCursor(file: string, line: number): void
  saveActiveFile(): Promise<void>
  saveAndCompile(): Promise<void>
  setMainFile(path: string): void
  runCompile(): Promise<void>
  patchSettings(patch: Partial<AppSettings>): Promise<void>
  gotoLine(line: number, file?: string | null): Promise<void>
  exportPdf(): Promise<void>
  syncFromPdf(page: number, x: number, y: number): Promise<void>
  syncToPdf(): Promise<void>
  requestTreeAction(kind: 'newFile' | 'newDir'): void
}

/** Derived: is the active file modified since last save? */
export function selectIsDirty(s: AppState): boolean {
  return !!s.activeFile && s.activeFile.contents !== s.activeFile.savedContents
}

/** Derived: path of whatever is open (text file or image asset). */
export function selectActivePath(s: AppState): string | null {
  return s.activeFile?.path ?? s.activeAsset?.path ?? null
}

export const useStore = create<AppState>((set, get) => ({
  project: null,
  settings: null,
  engineAvailable: false,
  activeFile: null,
  activeAsset: null,
  mainFile: null,
  cursor: null,
  compileStatus: 'idle',
  lastResult: null,
  logEntries: [],
  pdfBytes: null,
  pdfVersion: 0,
  gotoRequest: null,
  pdfHighlight: null,
  treeRequest: null,

  async init() {
    const [settings, engineAvailable] = await Promise.all([
      window.api.getSettings(),
      window.api.tectonicAvailable()
    ])
    set({ settings, engineAvailable })
  },

  async openProjectDialog() {
    const project = await window.api.openProjectDialog()
    if (project) await applyProject(set, get, project)
  },

  async newProject() {
    const project = await window.api.newProject()
    if (project) await applyProject(set, get, project)
  },

  async importProjectZip() {
    const project = await window.api.importProjectZip()
    if (project) await applyProject(set, get, project)
  },

  async openProject(rootPath) {
    const project = await window.api.openProject(rootPath)
    if (project) await applyProject(set, get, project)
  },

  async refreshTree() {
    const p = get().project
    if (!p) return
    const tree = await window.api.refreshTree(p.rootPath)
    set({ project: { ...p, tree } })
  },

  async openFile(path) {
    // Images open in the viewer; reading them as UTF-8 text would garble them.
    if (fileKind(path) === 'image') {
      set({ activeFile: null, activeAsset: { path }, cursor: null })
      return
    }
    const contents = await window.api.readFile(path)
    set({
      activeFile: { path, contents, savedContents: contents },
      activeAsset: null,
      cursor: { file: path, line: 1 }
    })
  },

  setEditorContents(contents) {
    const f = get().activeFile
    if (!f) return
    set({ activeFile: { ...f, contents } })
  },

  setCursor(file, line) {
    set({ cursor: { file, line } })
  },

  async saveActiveFile() {
    const f = get().activeFile
    if (!f || f.contents === f.savedContents) return
    await window.api.writeFile(f.path, f.contents)
    set({ activeFile: { ...f, savedContents: f.contents } })
  },

  /** Ctrl+S / File→Save: persist, then recompile when auto-compile is on. */
  async saveAndCompile() {
    await get().saveActiveFile()
    if (get().settings?.autoCompile ?? true) await get().runCompile()
  },

  setMainFile(path) {
    set({ mainFile: path })
  },

  async runCompile() {
    const { project, mainFile } = get()
    if (!project || !mainFile) return
    // Persist the active buffer first so the engine sees latest text.
    await get().saveActiveFile()
    set({ compileStatus: 'compiling' })

    const result = await window.api.compile({ rootPath: project.rootPath, mainFile })

    // Ignore superseded compiles (killed): a newer one is already running.
    if (result.durationMs > 0 && !result.ok && result.entries.length === 0 && !result.fatal) {
      return
    }

    let pdfBytes = get().pdfBytes
    let pdfVersion = get().pdfVersion
    if (result.ok && result.pdfPath) {
      pdfBytes = await window.api.readPdf(result.pdfPath)
      pdfVersion += 1
    }

    set({
      compileStatus: result.ok ? 'success' : 'error',
      lastResult: result,
      logEntries: result.fatal
        ? [{ level: 'error', message: result.fatal, file: null, line: null, raw: result.fatal }]
        : result.entries,
      pdfBytes,
      pdfVersion
    })
  },

  async patchSettings(patch) {
    const settings = await window.api.setSettings(patch)
    set({ settings })
  },

  async gotoLine(line, file) {
    // If the target is in another file, open it first.
    const active = get().activeFile
    if (file && active && file !== active.path) {
      try {
        await get().openFile(file)
      } catch {
        /* keep current file if it can't be opened */
      }
    }
    set({ gotoRequest: { line, nonce: Date.now() } })
  },

  async exportPdf() {
    const pdfPath = get().lastResult?.pdfPath
    if (!pdfPath) return
    const main = get().mainFile
    const name = (main ? basename(main).replace(/\.tex$/i, '') : 'document') + '.pdf'
    await window.api.exportPdf(pdfPath, name)
  },

  /** Reverse sync: a click in the PDF jumps the editor to the source. */
  async syncFromPdf(page, x, y) {
    const pdfPath = get().lastResult?.pdfPath
    if (!pdfPath) return
    const src = await window.api.syncReverse(pdfPath, page, x, y)
    if (src) await get().gotoLine(src.line, src.file)
  },

  /** Forward sync: scroll the PDF to the location of the editor caret. */
  async syncToPdf() {
    const pdfPath = get().lastResult?.pdfPath
    const cursor = get().cursor
    if (!pdfPath || !cursor) return
    const loc = await window.api.syncForward(pdfPath, cursor.file, cursor.line)
    if (loc) set({ pdfHighlight: { ...loc, nonce: Date.now() } })
  },

  requestTreeAction(kind) {
    set({ treeRequest: { kind, nonce: Date.now() } })
  }
}))

async function applyProject(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  project: ProjectInfo
): Promise<void> {
  set({
    project,
    mainFile: project.mainFile,
    activeFile: null,
    activeAsset: null,
    cursor: null,
    logEntries: [],
    pdfBytes: null,
    pdfHighlight: null,
    compileStatus: 'idle',
    lastResult: null
  })
  if (project.mainFile) {
    await get().openFile(project.mainFile)
    // Auto-compile on first load so the preview is populated immediately.
    if (get().settings?.autoCompile ?? true) void get().runCompile()
  }
}

export type { FileNode }
