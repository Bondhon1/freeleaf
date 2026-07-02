# FreeLeaf

A free, local, **Overleaf-style LaTeX editor** for the desktop. Three-pane UI
(file tree · editor · live PDF), **auto-compile on edit**, and a bundled
[Tectonic](https://tectonic-typesetting.github.io/) engine — so it needs **no
separately-installed TeX distribution**.

- ⚡ Auto-compile: edits recompile after a short idle debounce, like Overleaf.
- 📦 Self-contained: the Tectonic engine ships inside the app and downloads only
  the LaTeX packages your document actually uses, caching them for offline reuse.
- 🪶 Lightweight: ~30 MB engine + on-demand package cache instead of a multi-GB
  TeX Live install.
- 🖊️ CodeMirror 6 editor with LaTeX highlighting; ▶ PDF preview via pdf.js.
- 🧭 Clickable error/warning list that jumps to the offending source line.

## Requirements

- Node.js 18+ and Windows 10/11 (Windows is the current build target).

## Getting started

```bash
npm install        # installs deps AND downloads Tectonic + biber (needs internet once)
npm run dev        # launch the app with hot reload
```

`npm install` runs `npm run fetch-tools` via `postinstall`, which downloads both
the Tectonic engine and a version-matched `biber` (for biblatex bibliographies).
If you were offline during install, run it later with:

```bash
npm run fetch-tools
```

Open the `samples/hello` folder from the app to try it out: edit `main.tex` and
watch the PDF update automatically.

## Build a Windows installer

```bash
npm run package    # electron-vite build + electron-builder → release/
```

The installer bundles `resources/win/tectonic.exe` and `resources/win/biber.exe`
so the installed app works on machines with no TeX distribution. biber is pinned
to the version that matches Tectonic's bundled biblatex (see
`scripts/fetch-biber.mjs`); FreeLeaf forces Tectonic to use this bundled biber
rather than any biber already on the user's PATH, avoiding "control file version"
mismatch errors.

## How it works

| Layer     | Responsibility                                                            |
| --------- | ------------------------------------------------------------------------- |
| `main/`   | app lifecycle, filesystem IPC, spawning Tectonic, parsing the TeX log     |
| `preload/`| exposes a typed, sandboxed `window.api` via `contextBridge`               |
| `renderer/`| React UI: file tree, CodeMirror editor, pdf.js viewer, problems panel     |

The renderer never touches `fs` or `child_process` directly —
`contextIsolation` is on and `nodeIntegration` is off. A compile writes the
active buffer to disk, then main runs:

```
tectonic -X compile <main.tex> --outdir .freeleaf-build --synctex --keep-logs --keep-intermediates
```

with `TECTONIC_CACHE_DIR` pointed at the app's user-data folder so package
downloads persist and later compiles run offline.

## Keyboard shortcuts

- `Ctrl+S` — save the active file
- `Ctrl+Enter` — recompile now

## Roadmap

- SyncTeX forward/inverse search (source ↔ PDF click-to-jump)
- Split-pane size persistence, PDF page navigation
- macOS / Linux builds
