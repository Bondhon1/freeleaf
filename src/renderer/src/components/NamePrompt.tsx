import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  initial: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

/** Small modal text prompt (Electron disables window.prompt). */
export default function NamePrompt({ title, initial, onSubmit, onCancel }: Props): JSX.Element {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit(value)
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onSubmit(value)}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
