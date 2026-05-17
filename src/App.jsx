import { useState, useCallback, useEffect } from 'react'
import GalaxyBackground from './components/GalaxyBackground'
import SessionList from './components/SessionList'
import TerminalCanvas from './components/TerminalCanvas'
import SplashScreen from './components/SplashScreen'
import TopMenuBar from './components/TopMenuBar'
import RightMusicSidebar from './components/RightMusicSidebar'
import useMusicController from './hooks/useNeteaseMusicController'
// Default audio tracks — 3 tiers
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

  const music = useMusicController()

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

  // Listen for auto-switch when active session exits
  useEffect(() => {
    const unsub = window.terminal.onSwitched?.((newId) => {
      setActiveId(newId)
    })
    return () => { if (unsub) unsub() }
  }, [])

  // Listen for menu bar actions
  useEffect(() => {
    const u1 = window.terminal.onMenuNewSession?.(() => handleNewSession())
    const u2 = window.terminal.onMenuCloseSession?.(() => {
      if (activeId) handleClose(activeId)
    })
    const u3 = window.terminal.onMenuToggleMusic?.(() => setMusicOn((v) => !v))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [activeId, handleNewSession, handleClose])

  const handleToggleMusic = useCallback(() => setMusicOn((v) => !v), [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-cosmos-bg">
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      <GalaxyBackground />

      <div className="relative z-10 flex h-full">
        <SessionList
          sessions={sessions}
          activeId={activeId}
          onSwitch={handleSwitch}
          onRename={handleRename}
          onClose={handleClose}
          onNew={handleNewSession}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {/* Title bar with Audio panel */}
          <TopMenuBar
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
            onToggleSearch={() => setSearchOpen(v => !v)}
            searchOpen={searchOpen}
            musicPlaying={music.playing}
            musicTrack={music.currentTrack}
            onMusicPause={music.pause}
            onMusicResume={music.resume}
          />

          {/* Terminal */}
          <div className="flex-1 min-h-0">
            <TerminalCanvas
              activeSessionId={activeId}
              onSessionCreated={handleSessionCreated}
              musicEnabled={musicOn && !splash}
              audioMap={audioMap}
              masterVolume={masterVolume}
              mode={audioMode}
              staticTier={staticTier}
              onTierChange={setCurrentTier}
            />
          </div>

          {/* Status bar */}
          <div
            className="h-6 border-t border-white/5 flex items-center px-4 shrink-0"
            style={{ background: 'rgba(8, 8, 24, 0.25)' }}
          >
            <span className="text-[10px] text-cosmos-dim/60">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              {activeId && <> &middot; active: {sessions.find(s => s.id === activeId)?.name}</>}
            </span>
          </div>
        </main>

          {/* Right music search sidebar */}
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
    </div>
  )
}
