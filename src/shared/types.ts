// Shared domain + IPC types used by main, preload, and renderer.

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export interface ProjectInfo {
  rootPath: string
  name: string
  tree: FileNode[]
  /** Best-guess main .tex (contains \documentclass), if any. */
  mainFile: string | null
}

export interface LogEntry {
  level: 'error' | 'warning' | 'typesetting'
  message: string
  /** Absolute or project-relative file path, if the parser resolved one. */
  file: string | null
  /** 1-based line number, if known. */
  line: number | null
  raw: string
}

export interface CompileResult {
  ok: boolean
  /** Absolute path to the produced PDF, present when ok. */
  pdfPath: string | null
  durationMs: number
  entries: LogEntry[]
  /** Raw engine stdout+stderr+log, for the "raw logs" view. */
  rawLog: string
  /** Set when the compile could not even be started (e.g. binary missing). */
  fatal?: string
}

export interface CompileRequest {
  rootPath: string
  mainFile: string
}

/** Result of a SyncTeX reverse lookup (PDF location → source). */
export interface SyncSource {
  /** Absolute path to the .tex file the point maps to. */
  file: string
  /** 1-based source line. */
  line: number
}

/** Result of a SyncTeX forward lookup (source → PDF location). */
export interface SyncLocation {
  /** 1-based PDF page. */
  page: number
  /** Horizontal position from the page's left edge, in PDF points. */
  x: number
  /** Vertical position from the page's top edge, in PDF points. */
  y: number
  /** Height of the target box in points, for drawing a highlight (0 if unknown). */
  height: number
}

/** Menu → renderer action names pushed over the 'menu' channel. */
export type MenuAction =
  | 'open-project'
  | 'new-file'
  | 'new-folder'
  | 'save'
  | 'recompile'
  | 'export-pdf'
  | 'sync-to-pdf'

export interface AppSettings {
  autoCompile: boolean
  /** Idle debounce before auto-compile fires, in ms. */
  debounceMs: number
  theme: 'light' | 'dark'
  recentProjects: string[]
}

// The typed surface exposed on window.api via the preload contextBridge.
export interface FreeLeafApi {
  openProjectDialog(): Promise<ProjectInfo | null>
  /** Prompt for a location and scaffold a new project. */
  newProject(): Promise<ProjectInfo | null>
  /** Prompt for a .zip export, extract it, and open it. */
  importProjectZip(): Promise<ProjectInfo | null>
  openProject(rootPath: string): Promise<ProjectInfo | null>
  refreshTree(rootPath: string): Promise<FileNode[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, contents: string): Promise<void>
  createFile(dir: string, name: string): Promise<string>
  createDir(dir: string, name: string): Promise<string>
  rename(oldPath: string, newPath: string): Promise<void>
  deletePath(path: string): Promise<void>
  compile(req: CompileRequest): Promise<CompileResult>
  cancelCompile(): Promise<void>
  readPdf(path: string): Promise<Uint8Array>
  /** Read any file's raw bytes (used by the image viewer). */
  readBytes(path: string): Promise<Uint8Array>
  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  tectonicAvailable(): Promise<boolean>
  /** Copy the produced PDF to a user-chosen location. Returns the dest, or null if cancelled. */
  exportPdf(srcPdfPath: string, suggestedName: string): Promise<string | null>
  /** SyncTeX reverse lookup: PDF page + point (in PDF points, top-left origin) → source. */
  syncReverse(pdfPath: string, page: number, x: number, y: number): Promise<SyncSource | null>
  /** SyncTeX forward lookup: source file + line → PDF location. */
  syncForward(pdfPath: string, file: string, line: number): Promise<SyncLocation | null>
  /** Subscribe to menu-driven actions. Returns an unsubscribe function. */
  onMenu(cb: (action: MenuAction, payload?: unknown) => void): () => void
}

declare global {
  interface Window {
    api: FreeLeafApi
  }
}
