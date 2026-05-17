import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

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
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())

    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // Forward keystrokes
    term.onData((data) => {
      window.terminal.sendInput(data)
    })

    // Receive PTY output
    const unsubOutput = window.terminal.onOutput((data) => {
      term.write(data)
    })

    // Handle PTY exit
    const unsubExit = window.terminal.onExit(({ id, exitCode }) => {
      term.write(`\r\n\x1b[33m[${id} exited with code ${exitCode}]\x1b[0m\r\n`)
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
        onSessionCreated(session)
      }
    })

    return () => {
      resizeObserver.disconnect()
      unsubOutput()
      unsubExit()
      term.dispose()
    }
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
