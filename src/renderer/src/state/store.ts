import { create } from 'zustand'
import type {
  ProjectInfo,
  FileNode,
  LogEntry,
  AppSettings,
  CompileResult
} from '../../../shared/types'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'

interface OpenFile {
  path: string
  /** Current editor contents. */
  contents: string
  /** Contents last written to disk. */
  savedContents: string
}

interface AppState {
  project: ProjectInfo | null
  settings: AppSettings | null
  engineAvailable: boolean

  activeFile: OpenFile | null
  mainFile: string | null

  compileStatus: CompileStatus
  lastResult: CompileResult | null
  logEntries: LogEntry[]
  pdfBytes: Uint8Array | null
  /** Bumped on each successful compile so the viewer knows to reload. */
  pdfVersion: number

  /** A request to move the editor cursor to a line (nonce forces re-fire). */
  gotoRequest: { line: number; nonce: number } | null

  // actions
  init(): Promise<void>
  openProjectDialog(): Promise<void>
  openProject(rootPath: string): Promise<void>
  refreshTree(): Promise<void>
  openFile(path: string): Promise<void>
  setEditorContents(contents: string): void
  saveActiveFile(): Promise<void>
  setMainFile(path: string): void
  runCompile(): Promise<void>
  patchSettings(patch: Partial<AppSettings>): Promise<void>
  gotoLine(line: number, file?: string | null): Promise<void>
}

/** Derived: is the active file modified since last save? */
export function selectIsDirty(s: AppState): boolean {
  return !!s.activeFile && s.activeFile.contents !== s.activeFile.savedContents
}

export const useStore = create<AppState>((set, get) => ({
  project: null,
  settings: null,
  engineAvailable: false,
  activeFile: null,
  mainFile: null,
  compileStatus: 'idle',
  lastResult: null,
  logEntries: [],
  pdfBytes: null,
  pdfVersion: 0,
  gotoRequest: null,

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
    const contents = await window.api.readFile(path)
    set({ activeFile: { path, contents, savedContents: contents } })
  },

  setEditorContents(contents) {
    const f = get().activeFile
    if (!f) return
    set({ activeFile: { ...f, contents } })
  },

  async saveActiveFile() {
    const f = get().activeFile
    if (!f || f.contents === f.savedContents) return
    await window.api.writeFile(f.path, f.contents)
    set({ activeFile: { ...f, savedContents: f.contents } })
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
    // If the error is in another file, open it first.
    const active = get().activeFile
    if (file && active && file !== active.path) {
      try {
        await get().openFile(file)
      } catch {
        /* keep current file if it can't be opened */
      }
    }
    set({ gotoRequest: { line, nonce: Date.now() } })
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
    logEntries: [],
    pdfBytes: null,
    compileStatus: 'idle',
    lastResult: null
  })
  if (project.mainFile) {
    await get().openFile(project.mainFile)
  }
}

export type { FileNode }
