import { useState, useRef, useEffect, useCallback } from 'react'

function countMatches(term, query, caseSensitive, useRegex) {
  if (!term || !query) return 0
  const buffer = term.buffer.active
  let count = 0
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    if (!line) continue
    const text = line.translateToString()
    try {
      if (useRegex) {
        const re = new RegExp(query, caseSensitive ? 'g' : 'gi')
        count += (text.match(re) || []).length
      } else {
        const haystack = caseSensitive ? text : text.toLowerCase()
        const needle = caseSensitive ? query : query.toLowerCase()
        let pos = 0
        while ((pos = haystack.indexOf(needle, pos)) !== -1) {
          count++
          pos += needle.length
        }
      }
    } catch (_) { /* invalid regex — skip */ }
  }
  return count
}

export default function SearchBar({ searchAddon, term, onClose }) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(0)
  const inputRef = useRef(null)
  const currentRef = useRef(0)  // avoid stale closures

  // Re-run search whenever query / options change
  useEffect(() => {
    if (!searchAddon || !term) return
    currentRef.current = 0
    setCurrent(0)

    if (!query) {
      setTotal(0)
      // clear decorations via a dummy search that matches nothing
      try { searchAddon.findNext('\0') } catch (_) {}
      return
    }

    const opts = { regex: useRegex, caseSensitive, decorations: undefined }
    const found = searchAddon.findNext(query, opts) ?? searchAddon.findNext(query, { ...opts, incremental: false })
    if (found) {
      currentRef.current = 1
      setCurrent(1)
    } else {
      setCurrent(0)
    }

    setTotal(countMatches(term, query, caseSensitive, useRegex))
  }, [query, caseSensitive, useRegex, searchAddon, term])

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // --- navigation ---

  const next = useCallback(() => {
    if (!searchAddon || !query) return
    const opts = { regex: useRegex, caseSensitive }
    searchAddon.findNext(query, opts)
    const t = total
    if (t > 0) {
      const n = currentRef.current + 1 > t ? 1 : currentRef.current + 1
      currentRef.current = n
      setCurrent(n)
    }
  }, [searchAddon, query, caseSensitive, useRegex, total])

  const prev = useCallback(() => {
    if (!searchAddon || !query) return
    const opts = { regex: useRegex, caseSensitive }
    searchAddon.findPrevious(query, opts)
    const t = total
    if (t > 0) {
      const n = currentRef.current - 1 < 1 ? t : currentRef.current - 1
      currentRef.current = n
      setCurrent(n)
    }
  }, [searchAddon, query, caseSensitive, useRegex, total])

  // --- keyboard ---

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      next()
    }
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      prev()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
    // Ctrl+F while open → close
    if (e.key === 'f' && e.ctrlKey) {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="search-bar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20
      }}
    >
      <div className="search-bar-inner">
        {/* Input */}
        <div className="search-input-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            spellCheck={false}
            className="search-input"
          />
        </div>

        {/* Match counter */}
        {query && (
          <span className="search-counter">
            {current > 0 ? current : '?'} / {total}
          </span>
        )}

        {/* Toggles */}
        <button
          className={`search-toggle ${caseSensitive ? 'active' : ''}`}
          onClick={() => setCaseSensitive((v) => !v)}
          title="Case sensitive"
        >
          Aa
        </button>
        <button
          className={`search-toggle ${useRegex ? 'active' : ''}`}
          onClick={() => setUseRegex((v) => !v)}
          title="Use regex"
        >
          .*
        </button>

        {/* Nav arrows */}
        <button className="search-nav-btn" onClick={prev} disabled={total === 0} title="Previous (Shift+Enter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        <button className="search-nav-btn" onClick={next} disabled={total === 0} title="Next (Enter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Close */}
        <button className="search-close-btn" onClick={onClose} title="Close (Esc)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
