import { useState, useCallback, useEffect } from 'react'
import SessionList from './components/SessionList'
import TerminalCanvas from './components/TerminalCanvas'
import SplashScreen from './components/SplashScreen'
import GalaxyBackground from './components/GalaxyBackground'
import TopMenuBar from './components/TopMenuBar'
import RightMusicSidebar from './components/RightMusicSidebar'
import useMusicController from './hooks/useNeteaseMusicController'
import idleSrc from '../sound/idle.mp3'
import activeSrc from '../sound/active.mp3'
import climaxSrc from '../sound/climax.mp3'

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
    <div className="relative h-screen w-full overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      <GalaxyBackground />

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
        />

        <div className="app-body">
          <SessionList
            sessions={sessions}
            activeId={activeId}
            onSwitch={handleSwitch}
            onRename={handleRename}
            onClose={handleClose}
            onNew={handleNewSession}
          />

          <div style={{ flex: 1, padding: 12, overflow: 'hidden', minWidth: 0 }}>
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

        <div className="status-bar">
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
