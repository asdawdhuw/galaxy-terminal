import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import SearchBar from './SearchBar'
import useAudioEngine from '../hooks/useAudioEngine'

const COSMIC_THEME = {
  background: 'rgba(8, 8, 24, 0.08)',
  foreground: '#e0e0f0',
  cursor: '#6eb5d9',
  cursorAccent: '#06060f',
  selectionBackground: '#6eb5d944',
  selectionForeground: '#f0f0f8',
  black: '#1a1a2e',
  red: '#ff6b6b',
  green: '#66d9e8',
  yellow: '#ffd43b',
  blue: '#6eb5d9',
  magenta: '#da77f2',
  cyan: '#22b8cf',
  white: '#c8c8d8',
  brightBlack: '#4a4a6a',
  brightRed: '#ff8787',
  brightGreen: '#8ce8f0',
  brightYellow: '#ffe066',
  brightBlue: '#a78bfa',
  brightMagenta: '#e599f7',
  brightCyan: '#66d9e8',
  brightWhite: '#f0f0f8'
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
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: 'JetBrainsMono NF, JetBrainsMonoNL NF, JetBrains Mono, Cascadia Code, Consolas, monospace',
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return false
      }
      // Ctrl+V: always let browser handle paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        return false
      }
      // Ctrl+C: copy if text selected, otherwise send \x03 directly via IPC
      // Bypassing xterm's internal handler prevents windowsMode from crashing the PTY session
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (term.hasSelection()) {
          return false // browser copy
        }
        // No selection → send SIGINT explicitly through IPC, NOT through xterm
        window.terminal.sendInput('\x03')
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
    <div className="h-full flex flex-col bg-cosmos-bg/80 backdrop-blur-sm rounded-lg overflow-hidden border border-cosmos-border/50">
      <div className="terminal-chrome flex items-center gap-2 px-4 py-2 border-b border-cosmos-border/50 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-cosmos-accent/70 shadow-[0_0_6px_rgba(110,181,217,0.5)]" />
        </div>
        <span className="text-sm text-cosmos-dim font-mono ml-2 truncate">{title}</span>
        <div className="ml-auto flex items-center gap-2 text-xs text-cosmos-dim font-mono shrink-0">
          <span className="animate-pulse text-cosmos-accent">●</span>
          <span>已连接</span>
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

        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div className="px-4 py-1.5 terminal-chrome border-t border-cosmos-border/50 flex items-center justify-between text-xs text-cosmos-dim font-mono shrink-0">
        <span>Galaxy Terminal · xterm</span>
        <div className="flex items-center gap-2">
          <span className="text-cosmos-accent">●</span>
          <span>UTF-8</span>
          <span>|</span>
          <span>pwsh</span>
        </div>
      </div>
    </div>
  )
}