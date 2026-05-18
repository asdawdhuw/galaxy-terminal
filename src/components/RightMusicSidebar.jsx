import { useState, useRef } from 'react'

export default function RightMusicSidebar({
  visible,
  onClose,
  results = [],
  searching,
  onSearch,
  onPlay,
  currentTrack,
  error
}) {
  const [query, setQuery] = useState('')
  const timerRef = useRef(null)

  function handleInput(v) {
    setQuery(v)
    clearTimeout(timerRef.current)
    if (v.trim()) {
      timerRef.current = setTimeout(() => onSearch?.(v), 400)
    }
  }

  if (!visible) return null

  return (
    <aside className="w-64 shrink-0 border-l border-cosmos-border/30 flex flex-col animate-slide-in-right glass-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cosmos-border/30">
        <span className="text-xs font-semibold text-cosmos-dim/80 uppercase tracking-widest font-mono">
          Music Search
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-cosmos-dim hover:text-red-400 transition-colors text-lg leading-none"
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-3 border-b border-cosmos-border/20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cosmos-border/30 bg-cosmos-panel/40">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(139,139,168,0.6)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search tracks..."
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-xs text-cosmos-text/90 font-mono placeholder:text-cosmos-dim/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="px-4 py-3 text-[10px] text-red-400/70 font-mono text-center">
            {error}
          </div>
        )}
        {searching && (
          <div className="px-4 py-8 text-center text-[10px] text-cosmos-dim/50 font-mono">
            Searching...
          </div>
        )}
        {!searching && results.length === 0 && query && (
          <div className="px-4 py-8 text-center text-[10px] text-cosmos-dim/50 font-mono">
            No results
          </div>
        )}
        {!searching && results.length === 0 && !query && (
          <div className="px-4 py-6 text-center text-[10px] text-cosmos-dim/35 font-mono italic">
            Type to search iTunes previews
          </div>
        )}
        {results.map((track, i) => {
          const isActive = currentTrack?.id === track.id
          return (
            <div
              key={track.id}
              onDoubleClick={() => onPlay?.(track)}
              className={`group flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-cosmos-border/20
                          transition-colors duration-150 font-mono
                          ${isActive
                            ? 'bg-cosmos-accent/12 text-cosmos-text'
                            : 'text-cosmos-dim/75 hover:bg-cosmos-panel/40 hover:text-cosmos-text/90'
                          }`}
            >
              <span className={`w-5 text-[11px] shrink-0 ${isActive ? 'text-cosmos-accent' : 'text-cosmos-dim/45'}`}>
                {i + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className={`text-xs truncate ${isActive ? 'text-cosmos-accent' : 'text-cosmos-text/85'}`}>
                  {track.name}
                </div>
                <div className="text-[10px] text-cosmos-dim/60 truncate mt-0.5">
                  {track.artist}
                </div>
              </div>

              <span className="text-[10px] text-cosmos-dim/45 shrink-0 group-hover:hidden">
                {track.durationFmt}
              </span>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPlay?.(track) }}
                className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded text-cosmos-accent hover:bg-cosmos-accent/15 transition-colors shrink-0"
                title="Play"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2 border-t border-cosmos-border/20 text-[9px] text-cosmos-dim/45 font-mono text-center">
        Double-click or ▶ to play &middot; 30s preview auto-radio
      </div>
    </aside>
  )
}
