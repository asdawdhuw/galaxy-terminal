import { useState, useRef, useCallback } from 'react'

function fmtDuration(ms) {
  if (!ms) return '--:--'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RightMusicSidebar({
  visible,
  onClose,
  results = [],
  searching,
  onSearch,
  onPlay,
  selectedUri,
  onSelect,
  connected,
  connecting,
  error,
  onConnect
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const handleInput = useCallback((v) => {
    setQuery(v)
    clearTimeout(timerRef.current)
    if (v.trim()) {
      timerRef.current = setTimeout(() => onSearch?.(v), 400)
    }
  }, [onSearch])

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
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search Spotify..."
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-xs text-cosmos-text/80 font-mono placeholder:text-cosmos-dim/30"
          />
        </div>
      </div>

      {/* Connect / status */}
      {!connected && (
        <div className="px-3 py-3 border-b border-white/5">
          {connecting ? (
            <div className="text-center text-[10px] text-[#1db954]/60 font-mono py-1">
              Connecting...
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="w-full py-1.5 rounded-lg text-xs font-mono text-[#1db954] border border-[#1db954]/30
                         bg-[#1db954]/10 hover:bg-[#1db954]/20 transition-colors"
            >
              Connect Spotify
            </button>
          )}
          {error && (
            <div className="mt-1.5 text-[9px] text-red-400/60 font-mono text-center leading-relaxed">
              {error}
            </div>
          )}
        </div>
      )}
      {connected && (
        <div className="px-3 py-2 border-b border-white/5 text-center text-[10px] text-[#1db954]/50 font-mono">
          Connected
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
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
            Type to search Spotify
          </div>
        )}
        {results.map((track, i) => {
          const isSelected = track.uri === selectedUri
          return (
            <div
              key={track.id}
              onClick={() => onSelect?.(track)}
              onDoubleClick={() => onPlay?.(track.uri)}
              className={`group flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/5
                          transition-colors duration-150 font-mono
                          ${isSelected
                            ? 'bg-white/[0.06] text-white'
                            : 'text-cosmos-dim/70 hover:bg-white/[0.03] hover:text-cosmos-text/80'
                          }`}
            >
              {/* Index */}
              <span className={`w-5 text-[11px] shrink-0 ${isSelected ? 'text-cosmos-accent' : 'text-cosmos-dim/40'}`}>
                {i + 1}
              </span>

              {/* Album art or placeholder */}
              {track.image ? (
                <img src={track.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-white/[0.04] flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(107,107,138,0.3)" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className={`text-xs truncate ${isSelected ? 'text-cosmos-text' : ''}`}>
                  {track.name}
                </div>
                <div className="text-[10px] text-cosmos-dim/50 truncate mt-0.5">
                  {track.artist}
                </div>
              </div>

              {/* Duration + play on hover */}
              <span className="text-[10px] text-cosmos-dim/40 shrink-0 group-hover:hidden">
                {fmtDuration(track.duration)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onPlay?.(track.uri) }}
                className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded
                           text-[#1db954] hover:bg-[#1db954]/10 transition-colors shrink-0"
                title="Play on Spotify"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-white/5 text-[9px] text-cosmos-dim/35 font-mono text-center">
        Double-click or ▶ to play on Spotify
      </div>
    </aside>
  )
}
