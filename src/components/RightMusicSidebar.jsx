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
    <aside
      className="w-64 shrink-0 border-l border-white/10 flex flex-col animate-slide-in-right"
      style={{ background: 'rgba(8, 8, 24, 0.03)', backdropFilter: 'blur(4px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-xs font-semibold text-cosmos-dim/70 uppercase tracking-widest">
          Music Search
        </span>
        <button
          onClick={onClose}
          className="text-cosmos-dim hover:text-red-400 transition-colors text-lg leading-none"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(107,107,138,0.5)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search NetEase..."
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-xs text-cosmos-text/80 font-mono placeholder:text-cosmos-dim/30"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="px-4 py-3 text-[10px] text-red-400/60 font-mono text-center">
            {error}
          </div>
        )}
        {searching && (
          <div className="px-4 py-8 text-center text-[10px] text-cosmos-dim/40 font-mono">
            Searching...
          </div>
        )}
        {!searching && results.length === 0 && query && (
          <div className="px-4 py-8 text-center text-[10px] text-cosmos-dim/40 font-mono">
            No results
          </div>
        )}
        {!searching && results.length === 0 && !query && (
          <div className="px-4 py-6 text-center text-[10px] text-cosmos-dim/30 font-mono italic">
            Type to search NetEase Cloud
          </div>
        )}
        {results.map((track, i) => {
          const isActive = currentTrack?.id === track.id
          return (
            <div
              key={track.id}
              onDoubleClick={() => onPlay?.(track)}
              className={`group flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/5
                          transition-colors duration-150 font-mono
                          ${isActive
                            ? 'bg-white/[0.06] text-white'
                            : 'text-cosmos-dim/70 hover:bg-white/[0.03] hover:text-cosmos-text/80'
                          }`}
            >
              {/* Index */}
              <span className={`w-5 text-[11px] shrink-0 ${isActive ? 'text-cosmos-accent' : 'text-cosmos-dim/40'}`}>
                {i + 1}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className={`text-xs truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                  {track.name}
                </div>
                <div className="text-[10px] text-white/50 truncate mt-0.5">
                  {track.artist}
                </div>
              </div>

              {/* Duration */}
              <span className="text-[10px] text-cosmos-dim/40 shrink-0 group-hover:hidden">
                {track.durationFmt}
              </span>

              {/* Play button on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); onPlay?.(track) }}
                className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded
                           text-cosmos-accent hover:bg-cosmos-accent/10 transition-colors shrink-0"
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

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 text-[9px] text-cosmos-dim/35 font-mono text-center">
        Double-click or ▶ to play &middot; NetEase Cloud
      </div>
    </aside>
  )
}
