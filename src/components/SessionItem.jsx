import { useState, useRef, useEffect } from 'react'

export default function SessionItem({
  session,
  isActive,
  canClose = true,
  onSwitch,
  onRename,
  onClose
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(session.name)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { setName(session.name) }, [session.name])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== session.name) {
      onRename(session.id, trimmed)
    } else {
      setName(session.name)
    }
    setEditing(false)
  }

  return (
    <div
      className={`session-item${isActive ? ' active' : ''}`}
      onClick={() => onSwitch(session.id)}
      onDoubleClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={`session-item-dot ${isActive ? 'active' : 'idle'}`} />

      {editing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setName(session.name); setEditing(false) }
          }}
          onClick={(e) => e.stopPropagation()}
          className="session-item-input"
        />
      ) : (
        <span className="session-item-name" title={session.name}>{name}</span>
      )}

      {hovered && canClose && !editing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(session.id) }}
          className="session-item-close"
          title="Close session"
        >
          ×
        </button>
      )}
    </div>
  )
}
