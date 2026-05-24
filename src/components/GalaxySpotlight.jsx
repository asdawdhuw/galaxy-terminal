import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const ALL_COMMANDS = [
  { cmd: '/shh',     desc: 'Enter focus mode' },
  { cmd: '/unshh',   desc: 'Exit focus mode' },
  { cmd: '/chill',   desc: 'Ambient nebula flow' },
  { cmd: '/unchill', desc: 'Exit ambient mode' },
  { cmd: '/theme',   desc: 'Switch gravity field' },
  { cmd: '/mode',    desc: 'Toggle glass / solid terminal' },
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

  // Custom event from TerminalCanvas + global Ctrl+K
  useEffect(() => {
    function handleSpotlight() {
      if (open) closeSpotlight()
      else openSpotlight()
    }
    function handleKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        handleSpotlight()
      }
      if (e.key === 'Escape' && open) {
        closeSpotlight()
      }
    }
    window.addEventListener('galaxy:spotlight', handleSpotlight)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('galaxy:spotlight', handleSpotlight)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [open, openSpotlight, closeSpotlight])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = query.trim()
      if (cmd === '/shh' || cmd === '/focus') {
        onCommand?.('focus', true)
        closeSpotlight()
      } else if (cmd === '/unshh') {
        onCommand?.('focus', false)
        closeSpotlight()
      } else if (cmd === '/chill') {
        onCommand?.('chill', true)
        closeSpotlight()
      } else if (cmd === '/unchill') {
        onCommand?.('chill', false)
        closeSpotlight()
      } else if (cmd === '/files') {
        onCommand?.('viewMode', 'files')
        closeSpotlight()
      } else if (cmd === '/sessions') {
        onCommand?.('viewMode', 'sessions')
        closeSpotlight()
      } else if (cmd === '/theme') {
        onCommand?.('themePick')
        closeSpotlight()
      } else if (cmd === '/mode') {
        onCommand?.('modeToggle')
        closeSpotlight()
      } else if (cmd) {
        // Unknown command — send to terminal
        onCommand?.('terminal', cmd)
        closeSpotlight()
      }
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
              <kbd>Enter</kbd> run · <kbd>Esc</kbd> close · <kbd>Ctrl+K</kbd> toggle
            </div>
          </div>

          {/* Filtered commands — always visible */}
          <div className="spotlight-commands">
            {filtered.length > 0 ? filtered.map((c) => (
              <div key={c.cmd} className="spotlight-cmd-row"
                onClick={() => { setQuery(c.cmd); inputRef.current?.focus() }}
                onDoubleClick={() => { onCommand?.('terminal', c.cmd); setQuery(''); closeSpotlight() }}>
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
