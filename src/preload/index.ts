import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  FreeLeafApi,
  ProjectInfo,
  FileNode,
  CompileRequest,
  CompileResult,
  AppSettings,
  SyncSource,
  SyncLocation,
  MenuAction
} from '../shared/types'

const api: FreeLeafApi = {
  openProjectDialog: () => ipcRenderer.invoke('project:openDialog') as Promise<ProjectInfo | null>,
  newProject: () => ipcRenderer.invoke('project:new') as Promise<ProjectInfo | null>,
  importProjectZip: () => ipcRenderer.invoke('project:importZip') as Promise<ProjectInfo | null>,
  openProject: (rootPath) =>
    ipcRenderer.invoke('project:open', rootPath) as Promise<ProjectInfo | null>,
  refreshTree: (rootPath) =>
    ipcRenderer.invoke('project:refreshTree', rootPath) as Promise<FileNode[]>,
  readFile: (path) => ipcRenderer.invoke('fs:read', path) as Promise<string>,
  writeFile: (path, contents) => ipcRenderer.invoke('fs:write', path, contents) as Promise<void>,
  createFile: (dir, name) => ipcRenderer.invoke('fs:createFile', dir, name) as Promise<string>,
  createDir: (dir, name) => ipcRenderer.invoke('fs:createDir', dir, name) as Promise<string>,
  rename: (oldPath, newPath) =>
    ipcRenderer.invoke('fs:rename', oldPath, newPath) as Promise<void>,
  deletePath: (path) => ipcRenderer.invoke('fs:delete', path) as Promise<void>,
  compile: (req: CompileRequest) => ipcRenderer.invoke('compile:run', req) as Promise<CompileResult>,
  cancelCompile: () => ipcRenderer.invoke('compile:cancel') as Promise<void>,
  readPdf: (path) => ipcRenderer.invoke('pdf:read', path) as Promise<Uint8Array>,
  readBytes: (path) => ipcRenderer.invoke('fs:readBytes', path) as Promise<Uint8Array>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch) as Promise<AppSettings>,
  tectonicAvailable: () => ipcRenderer.invoke('engine:available') as Promise<boolean>,
  exportPdf: (srcPdfPath, suggestedName) =>
    ipcRenderer.invoke('pdf:export', srcPdfPath, suggestedName) as Promise<string | null>,
  syncReverse: (pdfPath, page, x, y) =>
    ipcRenderer.invoke('synctex:reverse', pdfPath, page, x, y) as Promise<SyncSource | null>,
  syncForward: (pdfPath, file, line) =>
    ipcRenderer.invoke('synctex:forward', pdfPath, file, line) as Promise<SyncLocation | null>,
  onMenu: (cb) => {
    const listener = (_e: IpcRendererEvent, action: MenuAction, payload?: unknown): void =>
      cb(action, payload)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
