import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import SearchBar from './SearchBar'
import useAudioEngine from '../hooks/useAudioEngine'

const COSMIC_THEME = {
  background: 'transparent',
  foreground: '#c8d8f0',
  cursor: '#3d7fff',
  cursorAccent: '#070b14',
  selectionBackground: 'rgba(61,127,255,0.3)',
  selectionForeground: '#c8d8f0',
  black: '#0a1030',
  red: '#ff5f57',
  green: '#28c840',
  yellow: '#febc2e',
  blue: '#3d7fff',
  magenta: '#7c6ff7',
  cyan: '#22b8cf',
  white: '#c8d8f0',
  brightBlack: '#1a3060',
  brightRed: '#ff7f77',
  brightGreen: '#40e060',
  brightYellow: '#ffd040',
  brightBlue: '#609fff',
  brightMagenta: '#a090ff',
  brightCyan: '#40d8e8',
  brightWhite: '#e8f0ff'
}

export default function TerminalCanvas({ activeSessionId, sessionName, onSessionCreated, musicEnabled = true, audioMap, masterVolume = 0.75, mode = 'dynamic', staticTier = 0, onTierChange }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const searchAddonRef = useRef(null)
  const buffersRef = useRef(new Map())   // sessionId → output string
  const shownIdRef = useRef(null)        // which session xterm is currently showing
  const fontSizeRef = useRef(14)         // live fontSize, avoids stale closures
  const toastTimerRef = useRef(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [toast, setToast] = useState(null)  // { text, visible }

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  // Audio engine — 3-tier, IKD-driven
  const { updateTypingStrike, currentTier } = useAudioEngine(
    audioMap,
    { enabled: musicEnabled, masterVolume, mode, staticTier }
  )

  // Bubble tier changes up to App for UI display
  useEffect(() => { onTierChange?.(currentTier) }, [currentTier, onTierChange])

  function showToast(text) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, visible: true })
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => prev ? { ...prev, visible: false } : null)
    }, 1200)
  }

  // Switch display to a different session
  function switchDisplay(toId) {
    const term = termRef.current
    if (!term) return

    const oldId = shownIdRef.current
    if (oldId === toId) return

    shownIdRef.current = toId

    term.reset()
    try { fitRef.current?.fit() } catch (_) {}

    // Sync PTY dimensions for the newly active session — critical for
    // interactive TUI apps (claude, vim, htop) whose cursor positioning
    // depends on the shell knowing the exact terminal grid size.
    window.terminal.resizePty(term.cols, term.rows)

    const buf = buffersRef.current.get(toId) || ''
    if (buf) {
      term.write(buf)
    }
  }

  // Effect 1: Terminal lifecycle (mount once)
  useEffect(() => {
    const term = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: 'JetBrainsMono NF, FiraCode Nerd Font, Cascadia Code, DejaVu Sans Mono, Consolas, monospace',
      letterSpacing: 1,
      lineHeight: 1.5,
      theme: COSMIC_THEME,
      allowProposedApi: true,
      windowsMode: true
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon

    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // Smart key handling: Ctrl+F search, Ctrl+V paste, Ctrl+C copy-or-explicit-SIGINT
    term.attachCustomKeyEventHandler((e) => {
      // Ctrl+F → toggle search bar
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return false
      }

      // Ctrl+V → always let browser handle paste (bypass xterm to avoid deadlock)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        return false
      }

      // Ctrl+C → copy if text selected, otherwise send SIGINT via IPC
      // Bypassing xterm's internal handler prevents windowsMode from crashing the PTY session
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (term.hasSelection()) {
          // Let browser handle copy natively
          return false
        }
        // No selection → send SIGINT explicitly through IPC, NOT through xterm
        window.terminal.sendInput('\x03')
        // Force-refocus terminal after interrupt to prevent IPC pipe deadlock
        setTimeout(() => {
          try { term.focus() } catch (_) {}
        }, 100)
        return false
      }

      return true
    })

    // Forward keystrokes + feed IKD engine
    term.onData((data) => {
      updateTypingStrike()
      window.terminal.sendInput(data)
    })

    // Receive PTY output — route to correct buffer
    const unsubOutput = window.terminal.onOutput(({ sessionId, data }) => {
      // Always accumulate to the correct session's buffer
      const prev = buffersRef.current.get(sessionId) || ''
      buffersRef.current.set(sessionId, prev + data)

      // Write to screen if this session is shown, or no session established yet (initial load)
      if (sessionId === shownIdRef.current || shownIdRef.current === null) {
        term.write(data)
      }
    })

    // Handle PTY exit
    const unsubExit = window.terminal.onExit(({ id, exitCode }) => {
      term.write(`\r\n\x1b[33m[${id} exited with code ${exitCode}]\x1b[0m\r\n`)
    })

    // Handle auto-switch (exit / close of active session)
    const unsubSwitched = window.terminal.onSwitched((newId) => {
      if (newId) switchDisplay(newId)
    })

    // Handle session respawn — clear buffer and reset terminal
    const unsubRespawned = window.terminal.onRespawned(({ id }) => {
      buffersRef.current.set(id, '')
      if (id === shownIdRef.current) {
        term.reset()
        term.write('\x1b[36m[Session respawned]\x1b[0m\r\n')
      }
    })

    // Ctrl+Wheel → font size + toast
    function handleWheel(e) {
      if (!e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      const next = Math.min(28, Math.max(10, fontSizeRef.current - Math.sign(e.deltaY)))
      if (next === fontSizeRef.current) return
      fontSizeRef.current = next
      term.options.fontSize = next
      setFontSize(next)
      showToast(`${next}px`)
      try { fitAddon.fit() } catch (_) {}
      // Note: we intentionally skip resizePty here.
      // Notifying PTY of dimension changes would cause pwsh to re-render
      // the current line, which gets appended to the session buffer and
      // creates duplicated content on repeated zoom in/out.
    }
    containerRef.current.addEventListener('wheel', handleWheel, { passive: false, capture: true })

    // Resize PTY when container changes
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        window.terminal.resizePty(term.cols, term.rows)
      } catch (_) {}
    })
    resizeObserver.observe(containerRef.current)

    // Create first PTY session
    window.terminal.createPty(term.cols, term.rows).then((session) => {
      if (session && onSessionCreated) {
        shownIdRef.current = session.id
        if (!buffersRef.current.has(session.id)) {
          buffersRef.current.set(session.id, '')
        }
        onSessionCreated(session)
      }
    })

    return () => {
      containerRef.current?.removeEventListener('wheel', handleWheel, { capture: true })
      clearTimeout(toastTimerRef.current)
      resizeObserver.disconnect()
      unsubOutput()
      unsubExit()
      unsubSwitched()
      unsubRespawned()
      term.dispose()
    }
  }, [])

  // Effect 2: React to session switch from App state (sidebar click / new session)
  useEffect(() => {
    if (activeSessionId && activeSessionId !== shownIdRef.current) {
      switchDisplay(activeSessionId)
    }
  }, [activeSessionId])

  const title = sessionName ? `${sessionName} — pwsh` : 'pwsh — galaxy-terminal'

  return (
    <div className="h-full flex flex-col terminal-area overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <div className="terminal-chrome-bar">
        <div className="terminal-chrome-dots">
          <div className="terminal-dot red" />
          <div className="terminal-dot yellow" />
          <div className="terminal-dot green" />
        </div>
        <span className="terminal-chrome-title">{title}</span>
        <div className="ml-auto flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>
          <span>Connected</span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {searchOpen && (
        <SearchBar
          searchAddon={searchAddonRef.current}
          term={termRef.current}
          onClose={closeSearch}
        />
        )}

        {toast && (
        <div
          className={`font-toast ${toast.visible ? 'toast-in' : 'toast-out'}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 30,
            pointerEvents: 'none'
          }}
        >
          <span className="toast-badge">{toast.text}</span>
        </div>
        )}

        <div ref={containerRef} className="w-full h-full" style={{ background: 'transparent' }} />
      </div>

      <div className="status-bar">
        <div className="status-bar-left">
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>
          <span>{sessionName || 'pwsh'}</span>
          <span>·</span>
          <span>pwsh</span>
        </div>
        <div className="status-bar-right">
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  )
}