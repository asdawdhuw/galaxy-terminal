import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import SessionList from './components/SessionList'
import TerminalCanvas from './components/TerminalCanvas'
import SplashScreen from './components/SplashScreen'
import GalaxyBackground from './components/GalaxyBackground'
import TopMenuBar from './components/TopMenuBar'
import RightMusicSidebar from './components/RightMusicSidebar'

const GalaxySpotlight = lazy(() => import('./components/GalaxySpotlight'))
const FileViewer = lazy(() => import('./components/FileViewer'))
const ThemePicker = lazy(() => import('./components/ThemePicker'))
const MusicPlayer = lazy(() => import('./components/MusicPlayer'))
const MultiverseView = lazy(() => import('./components/MultiverseView'))
const AetherMap = lazy(() => import('./components/AetherMap'))
const VoidDasher = lazy(() => import('./components/VoidDasher'))
import useMusicController from './hooks/useNeteaseMusicController'
import { setMusicState } from './utils/musicState'
import idleSrc from '../sound/idle.mp3'
import activeSrc from '../sound/active.mp3'
import climaxSrc from '../sound/climax.mp3'

function WebUrlBar({ onClose }) {
  const [inputVal, setInputVal] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const q = inputVal.trim()
    if (!q) { setSuggestions([]); setSelectedIdx(-1); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const list = await window.terminal.searchSuggest(q)
      setSuggestions(list)
      setSelectedIdx(-1)
    }, 150)
    return () => clearTimeout(timerRef.current)
  }, [inputVal])

  function openUrl(val) {
    let u = (val || inputVal).trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u) && /\.\w{2,}/.test(u)) u = 'https://' + u
    if (!/^https?:\/\//i.test(u)) u = 'https://www.google.com/search?q=' + encodeURIComponent(u)
    window.terminal.openExternal(u)
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
        openUrl(suggestions[selectedIdx])
      } else {
        openUrl()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return createPortal(
    <div className="omnibox-backdrop" onClick={onClose}>
      <div className="omnibox-wrapper" onClick={(e) => e.stopPropagation()}>
        <div className={`omnibox-bar${suggestions.length > 0 ? ' omnibox-bar-open' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="omnibox-icon">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search Google or type a URL"
            spellCheck={false}
            className="omnibox-input"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="omnibox-dropdown">
            {suggestions.map((s, i) => (
              <div
                key={s}
                className={`omnibox-suggestion${i === selectedIdx ? ' selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); openUrl(s) }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="omnibox-sug-icon">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default function App() {
  // Music popup window — apply saved theme then render standalone player
  if (window.location.hash === '#/music') {
    const savedTheme = localStorage.getItem('galaxy-theme') || 'orion'
    document.documentElement.setAttribute('data-theme', savedTheme)
    return (
      <div className="h-screen w-full" style={{ background: 'var(--bg-deep)' }}>
        <MusicPlayer isPopup onClose={() => window.close()} />
      </div>
    )
  }

  // Game popup window
  if (window.location.hash === '#/games') {
    const savedTheme = localStorage.getItem('galaxy-theme') || 'orion'
    document.documentElement.setAttribute('data-theme', savedTheme)
    return <VoidDasher onClose={() => window.terminal?.closeGameWindow?.()} />
  }

  const [splash, setSplash] = useState(true)
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [musicOn, setMusicOn] = useState(true)
  const [masterVolume, setMasterVolume] = useState(0.75)
  const [currentTier, setCurrentTier] = useState(0)
  const [audioMode, setAudioMode] = useState('dynamic')
  const [staticTier, setStaticTier] = useState(0)
  const [audioMap, setAudioMap] = useState({ 0: idleSrc, 1: activeSrc, 2: climaxSrc })
  const [searchOpen, setSearchOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState('')

  // X-axis: sidebar view mode
  const [sidebarViewMode, setSidebarViewMode] = useState('sessions')
  // Z-axis: focus mode
  const [focusMode, setFocusMode] = useState(false)
  const [viewerFile, setViewerFile] = useState(null)
  function handleFileOpen(file) {
    const ext = (file.name?.split('.').pop() || '').toLowerCase()
    if (/^(mp3|wav|flac|ogg|m4a|aac|wma)$/i.test(ext)) {
      window.terminal?.playMusicFile(file.path)
      window.terminal?.openMusicWindow()
    } else {
      setViewerFile(file)
    }
  }
  // Listen for file-open events from MultiverseView ResourcePodNode double-click
  useEffect(() => {
    function handler(e) { handleFileOpen(e.detail) }
    window.addEventListener('galaxy:openFile', handler)
    return () => window.removeEventListener('galaxy:openFile', handler)
  }, [])
  const [activeCwd, setActiveCwd] = useState(null)
  const [chillMode, setChillMode] = useState(false)
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('galaxy-theme') || 'orion')
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [terminalSolid, setTerminalSolid] = useState(false)
  const [uiOpacity, setUiOpacity] = useState(0.85)
  const [canvasMode, setCanvasMode] = useState(false)
  const [canvasFocusId, setCanvasFocusId] = useState(null)
  const [webBarOpen, setWebBarOpen] = useState(false)
  const [memoMode, setMemoMode] = useState(false)
  const [filePinned, setFilePinned] = useState(false)
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false)
  const [musicPlayerPinned, setMusicPlayerPinned] = useState(false)
  const [searchPinned, setSearchPinned] = useState(false)

  const termRef = useRef(null)

  const music = useMusicController()

  // Poll Bilibili music time for mini-player display (TopMenuBar)
  const [musicTime, setMusicTime] = useState(0)
  useEffect(() => {
    if (!music.playing) { setMusicTime(0); return }
    const timer = setInterval(() => setMusicTime(music.getTime()), 250)
    return () => clearInterval(timer)
  }, [music.playing])

  // Listen for cross-window music state from pop-out MusicPlayer → update shared store
  useEffect(() => {
    return window.terminal?.onMusicStateBroadcast?.((state) => {
      setMusicState(state)
    })
  }, [])

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  function handleChangeTrack(tier, file) {
    const url = URL.createObjectURL(file)
    setAudioMap((prev) => {
      const old = prev[tier]
      if (old && old.startsWith('blob:')) URL.revokeObjectURL(old)
      return { ...prev, [tier]: url }
    })
  }

  const handleSessionCreated = useCallback((session) => {
    setSessions((prev) => [...prev, session])
    setActiveId(session.id)
  }, [])

  const handleNewSession = useCallback(async () => {
    const session = await window.terminal.createPty(120, 30)
    if (session) {
      setSessions((prev) => [...prev, session])
      setActiveId(session.id)
    }
  }, [])

  const handleSwitch = useCallback(async (id) => {
    const ok = await window.terminal.switchSession(id)
    if (ok) setActiveId(id)
  }, [])

  const handleRename = useCallback(async (id, name) => {
    const ok = await window.terminal.renameSession(id, name)
    if (ok) {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
    }
  }, [])

  const handleClose = useCallback(async (id) => {
    const ok = await window.terminal.closeSession(id)
    if (ok) {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id)
        if (activeId === id) {
          const newActive = next.length > 0 ? next[0].id : null
          if (newActive) window.terminal.switchSession(newActive)
          setActiveId(newActive)
        }
        return next
      })
    }
  }, [activeId])

  // Galaxy Spotlight command handler
  function handleSpotlightCommand(type, payload) {
    switch (type) {
      case 'focus':
        setFocusMode(payload)
        if (payload) setChillMode(false)
        break
      case 'focusToggle':
        setFocusMode((v) => !v)
        break
      case 'chill':
        setChillMode(payload)
        if (payload) setFocusMode(false)
        break
      case 'chillToggle':
        setChillMode((v) => !v)
        break
      case 'themePick':
        setThemePickerOpen(true)
        break
      case 'modeToggle':
        setTerminalSolid((v) => !v)
        break
      case 'musicPlayer':
        setMusicPlayerOpen((v) => !v)
        break
      case 'canvasToggle':
        setCanvasMode((v) => !v)
        break
      case 'memoToggle':
        setMemoMode((v) => !v)
        break
      case 'gamesLaunch':
        window.terminal?.openGameWindow()
        break
      case 'viewMode':
        setSidebarViewMode(payload)
        break
      case 'terminal':
        // Forward unknown command to active PTY session
        window.terminal.sendInput(payload + '\r')
        break
    }
  }

  // Track active session CWD for FileTree
  useEffect(() => {
    const unsub = window.terminal.onCwd?.(({ sessionId, cwd }) => {
      if (sessionId === activeId) setActiveCwd(cwd)
    })
    return () => { if (unsub) unsub() }
  }, [activeId])

  useEffect(() => {
    const unsub = window.terminal.onSwitched?.((newId) => {
      setActiveId(newId)
    })
    return () => { if (unsub) unsub() }
  }, [])

  useEffect(() => {
    const u1 = window.terminal.onMenuNewSession?.(() => handleNewSession())
    const u2 = window.terminal.onMenuCloseSession?.(() => {
      if (activeId) handleClose(activeId)
    })
    const u3 = window.terminal.onMenuToggleMusic?.(() => setMusicOn((v) => !v))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [activeId, handleNewSession, handleClose])

  const handleToggleMusic = useCallback(() => setMusicOn((v) => !v), [])

  function handleThemeSelect(themeId) {
    setCurrentTheme(themeId)
    document.documentElement.setAttribute('data-theme', themeId)
    localStorage.setItem('galaxy-theme', themeId)
    setThemePickerOpen(false)
  }

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme)
    localStorage.setItem('galaxy-theme', currentTheme)
  }, [])

  const activeSession = sessions.find((s) => s.id === activeId)

  return (
    <div className={`relative h-screen w-full overflow-hidden ${chillMode ? 'chill-mode' : ''}`} style={{ background: 'var(--bg-deep)', '--ui-opacity': uiOpacity }}>
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      <GalaxyBackground chillMode={chillMode} />

      {/* Chill nebula overlay — cosmic immersion */}
      {chillMode && (
        <>
          <div className="chill-nebula" aria-hidden>
            <div className="chill-nebula-a" />
            <div className="chill-nebula-b" />
            <div className="chill-nebula-c" />
            <div className="chill-nebula-d" />
            <div className="chill-nebula-e" />
            <div className="chill-nebula-f" />
          </div>
          <div className="chill-dust" aria-hidden />
        </>
      )}

      <Suspense fallback={null}>
        {/* Galaxy Spotlight — Ctrl+K */}
        <GalaxySpotlight onCommand={handleSpotlightCommand} />

        {/* File Viewer — double-click in FileTree */}
        <FileViewer
        file={viewerFile}
        onClose={() => setViewerFile(null)}
        pinned={filePinned}
        onTogglePin={() => setFilePinned((v) => !v)}
      />

      {/* Music Player — inline overlay */}
      {musicPlayerOpen && (
        <MusicPlayer
          onClose={() => setMusicPlayerOpen(false)}
          pinned={musicPlayerPinned}
          onTogglePin={() => setMusicPlayerPinned((v) => !v)}
        />
      )}

      {/* Web URL Bar — click Web button */}
      {webBarOpen && <WebUrlBar onClose={() => setWebBarOpen(false)} />}

      {/* Theme Picker — /theme command */}
      {themePickerOpen && (
        <ThemePicker
          current={currentTheme}
          onSelect={handleThemeSelect}
          onClose={() => setThemePickerOpen(false)}
        />
      )}
      </Suspense>


      <div className="app-layout">
        <TopMenuBar
          currentTime={currentTime}
          musicOn={musicOn}
          onToggleMusic={handleToggleMusic}
          currentTier={currentTier}
          audioMap={audioMap}
          masterVolume={masterVolume}
          mode={audioMode}
          onChangeTrack={handleChangeTrack}
          onVolumeChange={setMasterVolume}
          onModeChange={setAudioMode}
          onStaticSelect={setStaticTier}
          onToggleSearch={() => setSearchOpen((v) => !v)}
          searchOpen={searchOpen}
          musicPlaying={music.playing}
          musicTrack={music.currentTrack}
          onMusicPause={music.pause}
          onMusicResume={music.resume}
          onMusicNext={music.next}
          onMusicPrev={music.prev}
          onMusicSeek={music.seek}
          musicTime={musicTime}
          musicDuration={music.duration}
          uiOpacity={uiOpacity}
          onOpacityChange={setUiOpacity}
          onWebClick={() => setWebBarOpen(true)}
        />

        <div className="app-body">
          {/* X-axis: Sidebar with flip */}
          <SessionList
            sessions={sessions}
            activeId={activeId}
            onSwitch={handleSwitch}
            onRename={handleRename}
            onClose={handleClose}
            onNew={handleNewSession}
            viewMode={sidebarViewMode}
            onViewModeChange={setSidebarViewMode}
            focusMode={focusMode}
            onFileOpen={handleFileOpen}
            cwd={activeCwd}
          />

          {/* Terminal, Aether Map, or Multiverse Canvas */}
          <div
            style={{ flex: 1, padding: focusMode ? 0 : 12, overflow: 'hidden', minWidth: 0, transition: 'padding 0.5s ease' }}
            onMouseDown={() => {
              if (viewerFile && !filePinned) setViewerFile(null)
            }}
          >
            {memoMode ? (
              <Suspense fallback={null}><AetherMap
                visible={memoMode}
                onClose={() => setMemoMode(false)}
              /></Suspense>
            ) : canvasMode ? (
              <Suspense fallback={null}><MultiverseView
                sessions={sessions}
                focusId={canvasFocusId}
                onNodeClick={(id) => handleSwitch(id)}
                onCanvasClick={() => {}}
                onNodeClose={(id) => handleClose(id)}
                onMusicOpen={() => setMusicPlayerOpen(true)}
                onNodeFocus={(id) => {
                  handleSwitch(id)
                  setCanvasMode(false)
                }}
              /></Suspense>
            ) : (
              <TerminalCanvas
                activeSessionId={activeId}
                sessionName={activeSession?.name}
                onSessionCreated={handleSessionCreated}
                musicEnabled={musicOn && !splash}
                audioMap={audioMap}
                masterVolume={masterVolume}
                mode={audioMode}
                staticTier={staticTier}
                onTierChange={setCurrentTier}
                focusMode={focusMode}
                onFocusToggle={setFocusMode}
                onChillToggle={setChillMode}
                onThemePick={() => setThemePickerOpen(true)}
                terminalSolid={terminalSolid}
                onModeToggle={() => setTerminalSolid((v) => !v)}
                onCanvasToggle={(sessionId) => { setCanvasFocusId(sessionId || null); setCanvasMode((v) => !v) }}
                onMemoToggle={() => setMemoMode((v) => !v)}
                onMusicPlayerToggle={() => setMusicPlayerOpen((v) => !v)}
                onGamesLaunch={() => window.terminal?.openGameWindow()}
                onViewModeChange={(mode) => setSidebarViewMode(mode)}
                onCloseSession={() => { if (activeId) handleClose(activeId) }}
              />
            )}
          </div>

          {/* Z-axis: Right sidebar hidden in focus mode */}
          <RightMusicSidebar
            visible={searchOpen}
            onClose={() => setSearchOpen(false)}
            results={music.results}
            searching={music.searching}
            onSearch={music.search}
            onPlay={music.play}
            currentTrack={music.currentTrack}
            error={music.error}
            focusMode={focusMode}
            playing={music.playing}
            getTime={music.getTime}
            pinned={searchPinned}
            onTogglePin={() => setSearchPinned((v) => !v)}
          />
        </div>

        {/* Z-axis: Status bar hidden in focus mode */}
        <div className={`status-bar ${focusMode ? 'focus-hidden' : 'focus-visible'}`}>
          <div className="status-bar-left">
            <span style={{ color: 'var(--accent)' }}>●</span>
            <span>{activeSession?.name ?? '—'}</span>
            <span>·</span>
            <span>pwsh</span>
          </div>
          <div className="status-bar-right">
            <span>UTF-8</span>
          </div>
        </div>
      </div>
    </div>
  )
}
