import { useState, useRef, useEffect } from 'react'

export default function SessionItem({ session, isActive, onSwitch, onRename, onClose }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(session.name)
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
      className={`group flex items-center gap-2 px-4 py-3 cursor-pointer border-b border-white/5
                  transition-colors duration-150 text-sm font-mono
                  ${isActive
                    ? 'bg-white/[0.06] text-white'
                    : 'text-cosmos-dim/70 hover:bg-white/[0.03] hover:text-cosmos-text/80'
                  }`}
      onClick={() => onSwitch(session.id)}
      onDoubleClick={() => setEditing(true)}
    >
      {/* Active indicator */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 transition-colors
                    ${isActive ? 'bg-cosmos-accent shadow-[0_0_6px_#a78bfa]' : 'bg-cosmos-dim/30'}`}
      />

      {/* Name */}
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
          className="flex-1 bg-transparent border-b border-cosmos-accent outline-none text-white text-sm
                     font-mono px-0.5 min-w-0"
        />
      ) : (
        <span className="flex-1 truncate">{name}</span>
      )}

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(session.id) }}
        className="opacity-0 group-hover:opacity-100 text-cosmos-dim hover:text-red-400
                   transition-all duration-150 text-base leading-none px-0.5"
        title="Close session"
      >
        {"×"}
      </button>
    </div>
  )
}
