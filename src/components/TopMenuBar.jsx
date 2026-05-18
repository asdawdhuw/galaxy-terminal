import { useState, useRef, useEffect } from 'react'

const TIER_NAMES = ['Deep Space', 'Particle Stream', 'Interstellar']

function fileName(url) {
  if (!url) return '—'
  try { return decodeURIComponent(url.split('/').pop()) } catch (_) { return url }
}

export default function TopMenuBar({
  currentTime = '',
  musicOn,
  onToggleMusic,
  currentTier = 0,
  audioMap = {},
  masterVolume = 0.75,
  mode = 'dynamic',
  onChangeTrack,
  onVolumeChange,
  onModeChange,
  onStaticSelect,
  onToggleSearch,
  searchOpen,
  musicPlaying,
  musicTrack,
  onMusicPause,
  onMusicResume
}) {
  const [audioOpen, setAudioOpen] = useState(false)
  const panelRef = useRef(null)
  const fileRefs = useRef([null, null, null])

  useEffect(() => {
    if (!audioOpen) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setAudioOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [audioOpen])

  function handleFile(tier, e) {
    const file = e.target.files?.[0]
    if (file) onChangeTrack?.(tier, file)
    e.target.value = ''
  }

  const isStatic = mode === 'static'

  return (
    <div
      className="h-12 glass-panel border-b border-cosmos-border/30 flex items-center justify-between px-4 shrink-0 relative"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* 左侧：音乐搜索 + 播放 */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          type="button"
          onClick={onToggleSearch}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-300 border ${
            searchOpen
              ? 'bg-cosmos-accent/15 border-cosmos-accent/40 text-cosmos-accent'
              : 'bg-cosmos-panel/50 border-cosmos-border/40 text-cosmos-dim hover:text-cosmos-text'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-xs uppercase tracking-wider font-mono">Music</span>
          {searchOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-cosmos-accent shadow-[0_0_6px_#6eb5d9]" />
          )}
        </button>

        {musicTrack && (
          <div className="flex items-center gap-1 bg-cosmos-panel/40 rounded-full px-2 py-1 border border-cosmos-border/30">
            <button
              type="button"
              className="p-1.5 hover:bg-cosmos-panel/60 rounded-full transition-colors"
              onClick={musicPlaying ? onMusicPause : onMusicResume}
              title={musicPlaying ? 'Pause' : 'Play'}
            >
              {musicPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-cosmos-accent">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-cosmos-accent">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
          </div>
        )}

        {musicTrack && (
          <div className="hidden sm:flex items-center gap-2 text-xs max-w-[200px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cosmos-accent shrink-0 animate-pulse">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
            <span className="text-cosmos-dim truncate font-mono">
              {musicTrack.title || musicTrack.name} — {musicTrack.artist}
            </span>
          </div>
        )}
      </div>

      {/* 中间：时钟 */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-none">
        <div className="flex items-center gap-2 bg-cosmos-panel/50 rounded-full px-4 py-1.5 border border-cosmos-border/30">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-cosmos-accent/80 to-cosmos-accent2/80 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">G</span>
          </div>
          <span className="text-sm text-cosmos-text/80 font-mono">~</span>
          <span className="text-xs text-cosmos-dim mx-1">|</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cosmos-dim">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-mono text-cosmos-text/80">{currentTime}</span>
        </div>
      </div>

      {/* 右侧：音量 + AUDIO */}
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="hidden md:flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cosmos-dim">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
          </svg>
          <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(masterVolume * 100)}
              onChange={(e) => onVolumeChange?.(Number(e.target.value) / 100)}
              className="w-full h-1 bg-cosmos-border/50 rounded-full appearance-none cursor-pointer accent-cosmos-accent"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAudioOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono transition-colors ${
            audioOpen ? 'text-cosmos-accent' : 'text-cosmos-accent/80 hover:text-cosmos-accent'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <span>Audio</span>
          <span className="text-cosmos-dim">▾</span>
        </button>

        {audioOpen && (
          <div
            ref={panelRef}
            className="absolute top-12 right-4 z-50 w-[340px] p-4 rounded-xl border border-cosmos-border/40 glass-panel shadow-2xl font-mono max-h-[calc(100vh-56px)] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-cosmos-accent tracking-widest">AUDIO</span>
              <button
                type="button"
                onClick={onToggleMusic}
                className={`px-2.5 py-0.5 rounded-full text-[10px] border ${
                  musicOn
                    ? 'border-cosmos-accent/35 bg-cosmos-accent/12 text-cosmos-accent'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}
              >
                {musicOn ? 'ON' : 'MUTE'}
              </button>
            </div>

            <div className="flex gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => onModeChange?.('dynamic')}
                className={`flex-1 py-1.5 rounded-md text-[10px] border transition-colors ${
                  !isStatic ? 'border-cosmos-accent/35 bg-cosmos-accent/15 text-cosmos-accent' : 'border-cosmos-border/30 text-cosmos-dim'
                }`}
              >
                Dynamic
              </button>
              <button
                type="button"
                onClick={() => onModeChange?.('static')}
                className={`flex-1 py-1.5 rounded-md text-[10px] border transition-colors ${
                  isStatic ? 'border-cosmos-accent/35 bg-cosmos-accent/15 text-cosmos-accent' : 'border-cosmos-border/30 text-cosmos-dim'
                }`}
              >
                Static
              </button>
            </div>

            {TIER_NAMES.map((name, i) => {
              const active = i === currentTier && musicOn
              return (
                <div
                  key={i}
                  onClick={() => isStatic && onStaticSelect?.(i)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 border cursor-${isStatic ? 'pointer' : 'default'} ${
                    active ? 'bg-cosmos-accent/12 border-cosmos-accent/25' : 'bg-cosmos-panel/30 border-cosmos-border/20'
                  }`}
                >
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold ${
                    active ? 'bg-cosmos-accent/25 text-cosmos-accent' : 'bg-cosmos-panel text-cosmos-dim'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] ${active ? 'text-cosmos-text' : 'text-cosmos-dim'}`}>{name}</div>
                    <div className="text-[9px] text-cosmos-dim/60 truncate">{fileName(audioMap[i])}</div>
                  </div>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-cosmos-accent shadow-[0_0_6px_#6eb5d9]" />}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileRefs.current[i]?.click() }}
                    className="text-[9px] px-2 py-0.5 rounded border border-cosmos-border/30 text-cosmos-dim hover:text-cosmos-accent hover:border-cosmos-accent/30"
                  >
                    Change
                  </button>
                  <input ref={(el) => { fileRefs.current[i] = el }} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac" className="hidden" onChange={(e) => handleFile(i, e)} />
                </div>
              )
            })}

            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-cosmos-border/20">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(masterVolume * 100)}
                onChange={(e) => onVolumeChange?.(Number(e.target.value) / 100)}
                className="flex-1 h-1 accent-cosmos-accent cursor-pointer"
              />
              <span className="text-[10px] text-cosmos-dim w-8 text-right">{Math.round(masterVolume * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
