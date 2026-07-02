import { app, Menu, dialog, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { promptNewProject, promptImportZip, promptOpenFolder } from './dialogs'
import type { MenuAction, ProjectInfo } from '../shared/types'

/** Push a menu-driven action to the renderer over the 'menu' channel. */
function send(win: BrowserWindow, action: MenuAction, payload?: unknown): void {
  win.webContents.send('menu', action, payload)
}

/** Run a project-opening dialog, then tell the renderer to open the result. */
async function openViaDialog(
  win: BrowserWindow,
  prompt: (w: BrowserWindow) => Promise<ProjectInfo | null>
): Promise<void> {
  const info = await prompt(win)
  if (info) send(win, 'open-project', { rootPath: info.rootPath })
}

export function buildAppMenu(win: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project…',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => void openViaDialog(win, promptNewProject)
        },
        {
          label: 'New Project from Zip…',
          click: () => void openViaDialog(win, promptImportZip)
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => void openViaDialog(win, promptOpenFolder)
        },
        { type: 'separator' },
        {
          label: 'New File…',
          accelerator: 'CmdOrCtrl+N',
          click: () => send(win, 'new-file')
        },
        {
          label: 'New Folder…',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send(win, 'new-folder')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send(win, 'save')
        },
        {
          label: 'Recompile',
          accelerator: 'CmdOrCtrl+Return',
          click: () => send(win, 'recompile')
        },
        {
          label: 'Sync PDF to Cursor',
          accelerator: 'CmdOrCtrl+J',
          click: () => send(win, 'sync-to-pdf')
        },
        { type: 'separator' },
        {
          label: 'Export PDF…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => send(win, 'export-pdf')
        },
        {
          label: 'Download Source (.zip)…',
          click: () => send(win, 'export-zip')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About FreeLeaf',
          click: () =>
            void dialog.showMessageBox(win, {
              type: 'info',
              title: 'About FreeLeaf',
              message: `FreeLeaf ${app.getVersion()}`,
              detail: 'A free, local, Overleaf-style LaTeX editor powered by a bundled Tectonic engine.'
            })
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
