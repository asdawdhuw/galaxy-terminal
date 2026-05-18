import { useState, useCallback, useEffect } from 'react'
import SessionList from './components/SessionList'
import TerminalCanvas from './components/TerminalCanvas'
import SplashScreen from './components/SplashScreen'
import GalaxyBackground from './components/GalaxyBackground'
import TopMenuBar from './components/TopMenuBar'
import RightMusicSidebar from './components/RightMusicSidebar'
import useMusicController from './hooks/useNeteaseMusicController'
import idleSrc from '../sound/Afraid of Time.mp3'
import activeSrc from '../sound/Cornfield Chase.mp3'
import climaxSrc from '../sound/No time for caution.mp3'

export default function App() {
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
  const [showScanLine, setShowScanLine] = useState(true)

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

  const activeSession = sessions.find((s) => s.id === activeId)

  return (
    <div className="relative h-screen w-full overflow-hidden bg-cosmos-bg">
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      <GalaxyBackground showScanLine={showScanLine} />

      <div className="relative z-10 h-full flex flex-col">
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
        />

        <div className="flex-1 flex overflow-hidden min-h-0">
          <SessionList
            sessions={sessions}
            activeId={activeId}
            onSwitch={handleSwitch}
            onRename={handleRename}
            onClose={handleClose}
            onNew={handleNewSession}
          />

          <div className="flex-1 p-4 overflow-hidden min-w-0">
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
            />
          </div>

          <RightMusicSidebar
            visible={searchOpen}
            onClose={() => setSearchOpen(false)}
            results={music.results}
            searching={music.searching}
            onSearch={music.search}
            onPlay={music.play}
            currentTrack={music.currentTrack}
            error={music.error}
          />
        </div>

        <div className="h-7 glass-panel border-t border-cosmos-border/30 flex items-center justify-between px-4 text-xs shrink-0">
          <div className="flex items-center gap-4 text-cosmos-dim font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cosmos-accent animate-pulse shadow-[0_0_8px_rgba(110,181,217,0.6)]" />
              {sessions.length} 个会话
            </span>
            <span>·</span>
            <span>当前: {activeSession?.name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-4 text-cosmos-dim font-mono">
            <button
              type="button"
              onClick={() => setShowScanLine((v) => !v)}
              className={`hover:text-cosmos-text transition-colors ${!showScanLine ? 'line-through opacity-50' : ''}`}
            >
              扫描线
            </button>
            <span>|</span>
            <span>双击播放 · 自动连播下一首</span>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none cosmic-border-glow rounded-lg"
        style={{ zIndex: 20 }}
        aria-hidden
      />
    </div>
  )
}
