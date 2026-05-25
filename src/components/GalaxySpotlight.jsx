import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const ALL_COMMANDS = [
  { cmd: '/shh',   desc: 'Toggle focus mode' },
  { cmd: '/chill', desc: 'Toggle ambient flow' },
  { cmd: '/theme',   desc: 'Switch gravity field' },
  { cmd: '/mode',    desc: 'Toggle glass / solid terminal' },
  { cmd: '/canvas',  desc: 'Toggle multiverse canvas' },
  { cmd: '/music',   desc: 'Open local music player' },
  { cmd: '/files',   desc: 'Show file tree' },
  { cmd: '/sessions',desc: 'Show session list' },
]

export default function GalaxySpotlight({ onCommand }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const filtered = query
    ? ALL_COMMANDS.filter(c => c.cmd.startsWith(query.toLowerCase()))
    : ALL_COMMANDS

  const openSpotlight = useCallback(() => {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closeSpotlight = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  // Custom event from TerminalCanvas + global Ctrl+S
  useEffect(() => {
    function handleSpotlight() {
      if (open) closeSpotlight()
      else openSpotlight()
    }
    function handleKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        handleSpotlight()
      }
      if (e.key === 'Escape' && open) {
        closeSpotlight()
      }
    }
    window.addEventListener('galaxy:spotlight', handleSpotlight)
    window.addEventListener('keydown', handleKeydown, { capture: true })
    return () => {
      window.removeEventListener('galaxy:spotlight', handleSpotlight)
      window.removeEventListener('keydown', handleKeydown, { capture: true })
    }
  }, [open, openSpotlight, closeSpotlight])

  const runCommand = useCallback((cmd) => {
    if (cmd === '/shh' || cmd === '/focus') {
      onCommand?.('focusToggle')
    } else if (cmd === '/chill') {
      onCommand?.('chillToggle')
    } else if (cmd === '/files') {
      onCommand?.('viewMode', 'files')
    } else if (cmd === '/sessions') {
      onCommand?.('viewMode', 'sessions')
    } else if (cmd === '/theme') {
      onCommand?.('themePick')
    } else if (cmd === '/mode') {
      onCommand?.('modeToggle')
    } else if (cmd === '/music') {
      onCommand?.('musicPlayer')
    } else if (cmd === '/canvas') {
      onCommand?.('canvasToggle')
    } else if (cmd) {
      onCommand?.('terminal', cmd)
    }
    closeSpotlight()
  }, [onCommand, closeSpotlight])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      runCommand(query.trim())
    }
    if (e.key === 'Escape') {
      closeSpotlight()
    }
  }

  return createPortal(
    <>
      {/* Black hole overlay */}
      {open && (
        <div
          className="spotlight-overlay"
          onClick={closeSpotlight}
          aria-hidden
        />
      )}

      {/* Spotlight modal */}
      {open && (
        <div className="spotlight-modal">
          <div className="spotlight-inner">
            <svg className="spotlight-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              spellCheck={false}
              autoComplete="off"
              className="spotlight-input"
            />
            <div className="spotlight-hint">
              <kbd>Enter</kbd> run · <kbd>Esc</kbd> close · <kbd>Ctrl+S</kbd> toggle
            </div>
          </div>

          {/* Filtered commands — always visible */}
          <div className="spotlight-commands">
            {filtered.length > 0 ? filtered.map((c) => (
              <div key={c.cmd} className="spotlight-cmd-row"
                onClick={() => runCommand(c.cmd)}>
                <span className="spotlight-cmd-key">{c.cmd}</span>
                <span className="spotlight-cmd-desc">{c.desc}</span>
              </div>
            )) : (
              <div className="spotlight-cmd-row">
                <span className="spotlight-cmd-desc" style={{ opacity: 0.4 }}>No match — press Enter to send to terminal</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
