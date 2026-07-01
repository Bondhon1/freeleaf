import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  loadProject,
  buildTree,
  readFile,
  writeFile,
  createFile,
  createDir,
  rename,
  deletePath
} from './project'
import { compile, cancelCompile } from './compile'
import { tectonicAvailable } from './tectonic'
import { getSettings, setSettings, addRecentProject } from './settings'
import type { CompileRequest, ProjectInfo } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'FreeLeaf',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('project:openDialog', async (): Promise<ProjectInfo | null> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open LaTeX project folder',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const info = loadProject(res.filePaths[0])
    addRecentProject(info.rootPath)
    return info
  })

  ipcMain.handle('project:open', (_e, rootPath: string): ProjectInfo | null => {
    try {
      const info = loadProject(rootPath)
      addRecentProject(info.rootPath)
      return info
    } catch {
      return null
    }
  })

  ipcMain.handle('project:refreshTree', (_e, rootPath: string) => buildTree(rootPath))

  ipcMain.handle('fs:read', (_e, path: string) => readFile(path))
  ipcMain.handle('fs:write', (_e, path: string, contents: string) => writeFile(path, contents))
  ipcMain.handle('fs:createFile', (_e, dir: string, name: string) => createFile(dir, name))
  ipcMain.handle('fs:createDir', (_e, dir: string, name: string) => createDir(dir, name))
  ipcMain.handle('fs:rename', (_e, oldPath: string, newPath: string) => rename(oldPath, newPath))
  ipcMain.handle('fs:delete', (_e, path: string) => deletePath(path))

  ipcMain.handle('compile:run', (_e, req: CompileRequest) => compile(req))
  ipcMain.handle('compile:cancel', () => cancelCompile())

  // Return PDF bytes for pdf.js. Uint8Array transfers efficiently over IPC.
  ipcMain.handle('pdf:read', (_e, path: string): Uint8Array => {
    const buf = readFileSync(path)
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  })

  ipcMain.handle('engine:available', () => tectonicAvailable())

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch) => setSettings(patch))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
