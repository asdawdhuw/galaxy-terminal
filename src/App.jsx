import { useState, useCallback, useEffect, useRef } from 'react'
import SessionList from './components/SessionList'
import TerminalCanvas from './components/TerminalCanvas'
import SplashScreen from './components/SplashScreen'
import GalaxyBackground from './components/GalaxyBackground'
import TopMenuBar from './components/TopMenuBar'
import RightMusicSidebar from './components/RightMusicSidebar'
import GalaxySpotlight from './components/GalaxySpotlight'
import FileViewer from './components/FileViewer'
import ThemePicker from './components/ThemePicker'
import MusicPlayer from './components/MusicPlayer'
import MultiverseView from './components/MultiverseView'
import useMusicController from './hooks/useNeteaseMusicController'
import idleSrc from '../sound/idle.mp3'
import activeSrc from '../sound/active.mp3'
import climaxSrc from '../sound/climax.mp3'

export default function App() {
  // Music popup window — render standalone player
  if (window.location.hash === '#/music') {
    return (
      <div className="h-screen w-full" style={{ background: 'var(--bg-deep)' }}>
        <MusicPlayer isPopup onClose={() => window.close()} />
      </div>
    )
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
  const [activeCwd, setActiveCwd] = useState(null)
  const [chillMode, setChillMode] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('orion')
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [terminalSolid, setTerminalSolid] = useState(false)
  const [uiOpacity, setUiOpacity] = useState(0.85)
  const [canvasMode, setCanvasMode] = useState(false)
  const [canvasFocusId, setCanvasFocusId] = useState(null)

  const termRef = useRef(null)

  const music = useMusicController()

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
        window.terminal.openMusicWindow()
        break
      case 'canvasToggle':
        setCanvasMode((v) => !v)
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
    setThemePickerOpen(false)
  }

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme)
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

      {/* Galaxy Spotlight — Ctrl+K */}
      <GalaxySpotlight onCommand={handleSpotlightCommand} />

      {/* File Viewer — double-click in FileTree */}
      <FileViewer
        file={viewerFile}
        onClose={() => setViewerFile(null)}
      />

      {/* Theme Picker — /theme command */}
      {themePickerOpen && (
        <ThemePicker
          current={currentTheme}
          onSelect={handleThemeSelect}
          onClose={() => setThemePickerOpen(false)}
        />
      )}


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
          uiOpacity={uiOpacity}
          onOpacityChange={setUiOpacity}
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
            onFileOpen={setViewerFile}
            cwd={activeCwd}
          />

          {/* Terminal or Multiverse Canvas */}
          <div style={{ flex: 1, padding: focusMode ? 0 : 12, overflow: 'hidden', minWidth: 0, transition: 'padding 0.5s ease' }}>
            {canvasMode ? (
              <MultiverseView
                sessions={sessions}
                focusId={canvasFocusId}
                onNodeClick={(id) => handleSwitch(id)}
                onCanvasClick={() => {}}
                onNodeClose={(id) => handleClose(id)}
                onNodeFocus={(id) => {
                  handleSwitch(id)
                  setCanvasMode(false)
                }}
              />
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
