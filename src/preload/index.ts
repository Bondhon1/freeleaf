import { contextBridge, ipcRenderer } from 'electron'
import type {
  FreeLeafApi,
  ProjectInfo,
  FileNode,
  CompileRequest,
  CompileResult,
  AppSettings
} from '../shared/types'

const api: FreeLeafApi = {
  openProjectDialog: () => ipcRenderer.invoke('project:openDialog') as Promise<ProjectInfo | null>,
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
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch) as Promise<AppSettings>,
  tectonicAvailable: () => ipcRenderer.invoke('engine:available') as Promise<boolean>
}

contextBridge.exposeInMainWorld('api', api)
