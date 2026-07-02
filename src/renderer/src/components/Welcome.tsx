import { useStore } from '../state/store'
import { basename } from '../util/path'

export default function Welcome(): JSX.Element {
  const openProjectDialog = useStore((s) => s.openProjectDialog)
  const openProject = useStore((s) => s.openProject)
  const newProject = useStore((s) => s.newProject)
  const importProjectZip = useStore((s) => s.importProjectZip)
  const engineAvailable = useStore((s) => s.engineAvailable)
  const recents = useStore((s) => s.settings?.recentProjects ?? [])

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>FreeLeaf</h1>
        <p className="tagline">A free, local, Overleaf-style LaTeX editor.</p>

        {!engineAvailable && (
          <div className="engine-warning">
            ⚠ Tectonic engine not found. Run <code>npm run fetch-tools</code> (needs internet) to
            install it, then restart.
          </div>
        )}

        <div className="welcome-actions">
          <button className="btn btn-primary btn-lg" onClick={() => void newProject()}>
            New project
          </button>
          <button className="btn btn-lg" onClick={() => void openProjectDialog()}>
            Open folder
          </button>
          <button className="btn btn-lg" onClick={() => void importProjectZip()}>
            Import .zip
          </button>
        </div>

        {recents.length > 0 && (
          <div className="recents">
            <div className="recents-title">Recent</div>
            {recents.map((p) => (
              <button key={p} className="recent-item" onClick={() => void openProject(p)}>
                <span className="recent-name">{basename(p)}</span>
                <span className="recent-path">{p}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
