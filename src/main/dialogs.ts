import { dialog, BrowserWindow } from 'electron'
import { createProject, importZip, loadProject } from './project'
import { addRecentProject } from './settings'
import type { ProjectInfo } from '../shared/types'

// Project-opening dialogs shared by the application menu and the Welcome screen
// (via IPC). Each returns the opened ProjectInfo, or null if cancelled/failed.

function fail(win: BrowserWindow, message: string, detail: string): null {
  void dialog.showMessageBox(win, { type: 'error', message, detail })
  return null
}

/** Prompt for a location, scaffold a new project with a starter main.tex. */
export async function promptNewProject(win: BrowserWindow): Promise<ProjectInfo | null> {
  const res = await dialog.showSaveDialog(win, {
    title: 'New Project',
    buttonLabel: 'Create Project',
    defaultPath: 'Untitled Project',
    properties: ['createDirectory']
  })
  if (res.canceled || !res.filePath) return null
  const parent = res.filePath.replace(/[\\/][^\\/]*$/, '')
  const name = res.filePath.slice(parent.length).replace(/^[\\/]/, '')
  try {
    const info = createProject(parent, name)
    addRecentProject(info.rootPath)
    return info
  } catch (err) {
    return fail(win, 'Could not create project', (err as Error).message)
  }
}

/** Prompt for a .zip project export, extract it, and open it. */
export async function promptImportZip(win: BrowserWindow): Promise<ProjectInfo | null> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Import Project from Zip',
    buttonLabel: 'Import',
    filters: [{ name: 'Zip archives', extensions: ['zip'] }],
    properties: ['openFile']
  })
  if (res.canceled || res.filePaths.length === 0) return null
  try {
    const info = importZip(res.filePaths[0])
    addRecentProject(info.rootPath)
    return info
  } catch (err) {
    return fail(win, 'Could not import zip', (err as Error).message)
  }
}

/** Prompt for an existing project folder and open it. */
export async function promptOpenFolder(win: BrowserWindow): Promise<ProjectInfo | null> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Open LaTeX project folder',
    properties: ['openDirectory']
  })
  if (res.canceled || res.filePaths.length === 0) return null
  const info = loadProject(res.filePaths[0])
  addRecentProject(info.rootPath)
  return info
}
