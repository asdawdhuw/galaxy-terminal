import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import SearchBar from './SearchBar'

const COSMIC_THEME = {
  background: 'rgba(8, 8, 24, 0.35)',
  foreground: '#e0e0f0',
  cursor: '#a78bfa',
  cursorAccent: '#06060f',
  selectionBackground: '#7c6ff744',
  selectionForeground: '#f0f0f8',
  black: '#1a1a2e',
  red: '#ff6b6b',
  green: '#69db7c',
  yellow: '#ffd43b',
  blue: '#7c6ff7',
  magenta: '#da77f2',
  cyan: '#22b8cf',
  white: '#c8c8d8',
  brightBlack: '#4a4a6a',
  brightRed: '#ff8787',
  brightGreen: '#8ce99a',
  brightYellow: '#ffe066',
  brightBlue: '#a78bfa',
  brightMagenta: '#e599f7',
  brightCyan: '#66d9e8',
  brightWhite: '#f0f0f8'
}

export default function TerminalCanvas({ activeSessionId, onSessionCreated }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const searchAddonRef = useRef(null)
  const buffersRef = useRef(new Map())   // sessionId → output string
  const shownIdRef = useRef(null)        // which session xterm is currently showing
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  // Switch display to a different session
  function switchDisplay(toId) {
    const term = termRef.current
    if (!term) return

    const oldId = shownIdRef.current
    if (oldId === toId) return

    shownIdRef.current = toId

    term.reset()
    try { fitRef.current?.fit() } catch (_) {}

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

    // Global Ctrl+F → toggle search bar
    term.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return false
      }
      return true
    })

    // Forward keystrokes
    term.onData((data) => {
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
      resizeObserver.disconnect()
      unsubOutput()
      unsubExit()
      unsubSwitched()
      term.dispose()
    }
  }, [])

  // Effect 2: React to session switch from App state (sidebar click / new session)
  useEffect(() => {
    if (activeSessionId && activeSessionId !== shownIdRef.current) {
      switchDisplay(activeSessionId)
    }
  }, [activeSessionId])

  return (
    <div className="relative w-full h-full">
      {searchOpen && (
        <SearchBar
          searchAddon={searchAddonRef.current}
          term={termRef.current}
          onClose={closeSearch}
        />
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}