import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename } from 'node:path'
import { readFileSync, copyFileSync } from 'node:fs'
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
import { reverse as synctexReverse, forward as synctexForward } from './synctex'
import { buildAppMenu } from './menu'
import { promptNewProject, promptImportZip, promptOpenFolder } from './dialogs'
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
  buildAppMenu(mainWindow)

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('project:openDialog', () => promptOpenFolder(mainWindow!))
  ipcMain.handle('project:new', () => promptNewProject(mainWindow!))
  ipcMain.handle('project:importZip', () => promptImportZip(mainWindow!))

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

  // Raw bytes for the in-editor image viewer.
  ipcMain.handle('fs:readBytes', (_e, path: string): Uint8Array => {
    const buf = readFileSync(path)
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  })

  ipcMain.handle('engine:available', () => tectonicAvailable())

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch) => setSettings(patch))

  // Copy the built PDF to a user-chosen location.
  ipcMain.handle(
    'pdf:export',
    async (_e, srcPdfPath: string, suggestedName: string): Promise<string | null> => {
      const res = await dialog.showSaveDialog(mainWindow!, {
        title: 'Export PDF',
        defaultPath: suggestedName || basename(srcPdfPath),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (res.canceled || !res.filePath) return null
      copyFileSync(srcPdfPath, res.filePath)
      return res.filePath
    }
  )

  // SyncTeX: PDF <-> source position mapping.
  ipcMain.handle('synctex:reverse', (_e, pdfPath: string, page: number, x: number, y: number) =>
    synctexReverse(pdfPath, page, x, y)
  )
  ipcMain.handle('synctex:forward', (_e, pdfPath: string, file: string, line: number) =>
    synctexForward(pdfPath, file, line)
  )
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
