import { useState, useCallback, useEffect } from 'react'
import GalaxyBackground from './components/GalaxyBackground'
import SessionList from './components/SessionList'
import TerminalCanvas from './components/TerminalCanvas'
import SplashScreen from './components/SplashScreen'

export default function App() {
  const [splash, setSplash] = useState(true)
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)

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
    return () => { u1?.(); u2?.() }
  }, [activeId, handleNewSession, handleClose])

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
          {/* Minimal title bar */}
          <div
            className="h-8 border-b border-white/5 shrink-0"
            style={{ background: 'rgba(8, 8, 24, 0.25)', WebkitAppRegion: 'drag' }}
          />

          {/* Terminal */}
          <div className="flex-1 min-h-0">
            <TerminalCanvas
              activeSessionId={activeId}
              onSessionCreated={handleSessionCreated}
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
      </div>
    </div>
  )
}
