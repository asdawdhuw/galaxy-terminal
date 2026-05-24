import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function GalaxySpotlight({ onCommand }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const openSpotlight = useCallback(() => {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closeSpotlight = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  // Global Ctrl+K listener
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closeSpotlight()
        else openSpotlight()
      }
      if (e.key === 'Escape' && open) {
        closeSpotlight()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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
      } else if (cmd === '/files') {
        onCommand?.('viewMode', 'files')
        closeSpotlight()
      } else if (cmd === '/sessions') {
        onCommand?.('viewMode', 'sessions')
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
              placeholder="Type a command... /shh /unshh /files /sessions"
              spellCheck={false}
              autoComplete="off"
              className="spotlight-input"
            />
            <div className="spotlight-hint">
              <kbd>Enter</kbd> run · <kbd>Esc</kbd> close · <kbd>Ctrl+K</kbd> toggle
            </div>
          </div>

          {/* Quick commands */}
          <div className="spotlight-commands">
            <div className="spotlight-cmd-group">
              <span className="spotlight-cmd-label">MODE</span>
              <span className="spotlight-cmd">/shh — Focus mode on</span>
              <span className="spotlight-cmd">/unshh — Focus mode off</span>
            </div>
            <div className="spotlight-cmd-group">
              <span className="spotlight-cmd-label">VIEW</span>
              <span className="spotlight-cmd">/files — Switch to File Tree</span>
              <span className="spotlight-cmd">/sessions — Switch to Sessions</span>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
