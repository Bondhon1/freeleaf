import { useStore } from '../state/store'
import { basename } from '../util/path'

export default function Welcome(): JSX.Element {
  const openProjectDialog = useStore((s) => s.openProjectDialog)
  const openProject = useStore((s) => s.openProject)
  const engineAvailable = useStore((s) => s.engineAvailable)
  const recents = useStore((s) => s.settings?.recentProjects ?? [])

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>FreeLeaf</h1>
        <p className="tagline">A free, local, Overleaf-style LaTeX editor.</p>

        {!engineAvailable && (
          <div className="engine-warning">
            ⚠ Tectonic engine not found. Run <code>npm run fetch-tectonic</code> (needs internet)
            to install it, then restart.
          </div>
        )}

        <button className="btn btn-primary btn-lg" onClick={() => void openProjectDialog()}>
          Open a project folder
        </button>

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
