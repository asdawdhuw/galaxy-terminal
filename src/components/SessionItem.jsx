import { useState, useRef, useEffect } from 'react'

export default function SessionItem({
  session,
  isActive,
  index = 0,
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

  const status = isActive ? 'running' : 'idle'

  return (
    <div
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 font-mono
        ${isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/80'
        }`}
      onClick={() => onSwitch(session.id)}
      onDoubleClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="relative shrink-0">
        <span
          className={`block w-2.5 h-2.5 rounded-full ${
            status === 'running' ? 'bg-green-400' : 'bg-cosmos-accent'
          }`}
        />
        {status === 'running' && (
          <span className="absolute inset-0 animate-ping">
            <span className="block w-2.5 h-2.5 rounded-full bg-green-400/30" />
          </span>
        )}
      </div>

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
          className="flex-1 bg-transparent border-b border-cosmos-accent outline-none text-sm min-w-0"
        />
      ) : (
        <span className="flex-1 text-sm font-medium truncate">{name}</span>
      )}

      {isActive && !editing && (
        <svg className="w-4 h-4 text-sidebar-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {hovered && canClose && !editing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(session.id) }}
          className="absolute right-2 p-1 rounded hover:bg-red-500/20 transition-colors"
          title="删除会话"
        >
          <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
