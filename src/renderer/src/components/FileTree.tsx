import { useState } from 'react'
import { useStore } from '../state/store'
import type { FileNode } from '../../../shared/types'
import NamePrompt from './NamePrompt'

interface RowProps {
  node: FileNode
  depth: number
  onOpen: (path: string) => void
  onContext: (e: React.MouseEvent, n: FileNode) => void
  activePath: string | null
  mainFile: string | null
}

function Row({ node, depth, onOpen, onContext, activePath, mainFile }: RowProps): JSX.Element {
  const [open, setOpen] = useState(depth < 1)
  const isActive = node.path === activePath
  const isMain = node.path === mainFile

  return (
    <div>
      <div
        className={`tree-row${isActive ? ' active' : ''}`}
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => (node.isDir ? setOpen((o) => !o) : onOpen(node.path))}
        onContextMenu={(e) => onContext(e, node)}
        title={node.name}
      >
        <span className="tree-icon">{node.isDir ? (open ? '▾' : '▸') : '📄'}</span>
        <span className="tree-name">{node.name}</span>
        {isMain && <span className="main-badge">main</span>}
      </div>
      {node.isDir && open && node.children && (
        <div>
          {node.children.map((c) => (
            <Row
              key={c.path}
              node={c}
              depth={depth + 1}
              onOpen={onOpen}
              onContext={onContext}
              activePath={activePath}
              mainFile={mainFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ContextState {
  x: number
  y: number
  node: FileNode
}

type PromptState =
  | { kind: 'newFile' | 'newDir'; dir: string }
  | { kind: 'rename'; target: FileNode }
  | null

export default function FileTree(): JSX.Element {
  const project = useStore((s) => s.project)
  const openFile = useStore((s) => s.openFile)
  const refreshTree = useStore((s) => s.refreshTree)
  const setMainFile = useStore((s) => s.setMainFile)
  const activePath = useStore((s) => s.activeFile?.path ?? null)
  const mainFile = useStore((s) => s.mainFile)

  const [ctx, setCtx] = useState<ContextState | null>(null)
  const [prompt, setPrompt] = useState<PromptState>(null)

  if (!project) return <div className="tree" />

  const onContext = (e: React.MouseEvent, node: FileNode): void => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, node })
  }

  const dirOf = (n: FileNode): string =>
    n.isDir ? n.path : n.path.slice(0, n.path.length - n.name.length - 1)

  const submitPrompt = async (name: string): Promise<void> => {
    if (!prompt || !name.trim()) return setPrompt(null)
    try {
      if (prompt.kind === 'newFile') await window.api.createFile(prompt.dir, name.trim())
      else if (prompt.kind === 'newDir') await window.api.createDir(prompt.dir, name.trim())
      else if (prompt.kind === 'rename') {
        const parent = prompt.target.path.slice(
          0,
          prompt.target.path.length - prompt.target.name.length
        )
        await window.api.rename(prompt.target.path, parent + name.trim())
      }
      await refreshTree()
    } catch (err) {
      alert(`Operation failed: ${(err as Error).message}`)
    }
    setPrompt(null)
  }

  return (
    <div className="tree" onClick={() => setCtx(null)}>
      <div className="tree-header">
        <span className="tree-title">{project.name}</span>
        <div className="tree-actions">
          <button
            className="btn btn-icon"
            title="New file"
            onClick={() => setPrompt({ kind: 'newFile', dir: project.rootPath })}
          >
            ＋
          </button>
          <button
            className="btn btn-icon"
            title="New folder"
            onClick={() => setPrompt({ kind: 'newDir', dir: project.rootPath })}
          >
            🗀
          </button>
        </div>
      </div>

      <div className="tree-body">
        {project.tree.map((n) => (
          <Row
            key={n.path}
            node={n}
            depth={0}
            onOpen={openFile}
            onContext={onContext}
            activePath={activePath}
            mainFile={mainFile}
          />
        ))}
      </div>

      {ctx && (
        <div className="context-menu" style={{ left: ctx.x, top: ctx.y }}>
          {ctx.node.isDir && (
            <>
              <button onClick={() => setPrompt({ kind: 'newFile', dir: dirOf(ctx.node) })}>
                New File…
              </button>
              <button onClick={() => setPrompt({ kind: 'newDir', dir: dirOf(ctx.node) })}>
                New Folder…
              </button>
            </>
          )}
          {!ctx.node.isDir && ctx.node.name.toLowerCase().endsWith('.tex') && (
            <button onClick={() => setMainFile(ctx.node.path)}>Set as main</button>
          )}
          <button onClick={() => setPrompt({ kind: 'rename', target: ctx.node })}>Rename…</button>
          <button
            className="danger"
            onClick={async () => {
              if (confirm(`Delete "${ctx.node.name}"?`)) {
                await window.api.deletePath(ctx.node.path)
                await refreshTree()
              }
            }}
          >
            Delete
          </button>
        </div>
      )}

      {prompt && (
        <NamePrompt
          title={
            prompt.kind === 'rename'
              ? 'Rename'
              : prompt.kind === 'newDir'
                ? 'New folder name'
                : 'New file name'
          }
          initial={prompt.kind === 'rename' ? prompt.target.name : ''}
          onSubmit={submitPrompt}
          onCancel={() => setPrompt(null)}
        />
      )}
    </div>
  )
}
