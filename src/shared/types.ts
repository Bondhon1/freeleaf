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
  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  tectonicAvailable(): Promise<boolean>
}

declare global {
  interface Window {
    api: FreeLeafApi
  }
}
