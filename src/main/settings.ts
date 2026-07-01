import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  autoCompile: true,
  debounceMs: 1200,
  theme: 'dark',
  recentProjects: []
}

let cache: AppSettings | null = null

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8'))
      cache = { ...DEFAULTS, ...raw }
    } else {
      cache = { ...DEFAULTS }
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache!
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  cache = next
  try {
    writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8')
  } catch (err) {
    console.error('[settings] failed to persist:', err)
  }
  return next
}

export function addRecentProject(rootPath: string): void {
  const s = getSettings()
  const recents = [rootPath, ...s.recentProjects.filter((p) => p !== rootPath)].slice(0, 10)
  setSettings({ recentProjects: recents })
}
