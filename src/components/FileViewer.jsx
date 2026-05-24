import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function FileViewer({ file, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [fontSize, setFontSize] = useState(13)
  const [toast, setToast] = useState(null)
  const overlayRef = useRef(null)
  const toastTimerRef = useRef(null)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIdx, setSearchIdx] = useState(0)
  const [searchCase, setSearchCase] = useState(false)
  const [searchRegex, setSearchRegex] = useState(false)
  const searchInputRef = useRef(null)
  const codeContainerRef = useRef(null)

  useEffect(() => {
    if (!file) return
    const ext = (file.name?.split('.').pop() || 'txt').toLowerCase()
    const isMedia = ['png','jpg','jpeg','gif','webp','svg','bmp','ico','mp4','webm','mkv','avi','mov','wmv','flv'].includes(ext)
    // Media files: stream directly, no need to read content
    if (isMedia) { setLoading(false); return }

    if (file.path) {
      setLoading(true)
      setErr('')
      window.terminal.readFile(file.path).then((res) => {
        if (res.ok) { setContent(res.content) }
        else { setContent(''); setErr(res.error) }
        setLoading(false)
      })
    } else {
      setContent(generateMock(file.name))
      setLoading(false)
    }
  }, [file])

  // Find all match positions
  const matches = useMemo(() => {
    if (!searchQuery || !content) return []
    try {
      const q = searchRegex ? searchQuery : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const flags = searchCase ? 'g' : 'gi'
      const re = new RegExp(q, flags)
      const m = []
      let r
      while ((r = re.exec(content)) !== null) {
        m.push({ start: r.index, end: r.index + r[0].length })
        if (r[0].length === 0) re.lastIndex++ // avoid infinite loop on empty match
      }
      return m
    } catch (_) { return [] }
  }, [content, searchQuery, searchCase, searchRegex])

  // Highlighted HTML
  const highlightedHtml = useMemo(() => {
    if (!searchQuery || matches.length === 0) return null
    try {
      const q = searchRegex ? searchQuery : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const flags = searchCase ? 'g' : 'gi'
      const re = new RegExp(`(${q})`, flags)
      let idx = 0
      return content.replace(re, (match) => {
        const isCurrent = idx === searchIdx
        const cls = isCurrent ? 'file-search-current' : 'file-search-match'
        idx++
        return `<mark class="${cls}">${match}</mark>`
      })
    } catch (_) { return null }
  }, [content, searchQuery, searchCase, searchRegex, matches, searchIdx])

  // Scroll to current match
  useEffect(() => {
    if (!codeContainerRef.current) return
    const el = codeContainerRef.current.querySelector('.file-search-current')
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [searchIdx, highlightedHtml])

  function showToast(text) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(text)
    toastTimerRef.current = setTimeout(() => setToast(null), 1200)
  }

  // Keyboard: Esc, Ctrl+F, Ctrl+Wheel
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        if (searchOpen) {
          searchInputRef.current?.focus()
        } else {
          setSearchOpen(true)
          setSearchQuery('')
          setSearchIdx(0)
          setTimeout(() => searchInputRef.current?.focus(), 50)
        }
        return
      }
    }
    function handleWheel(e) {
      if (!e.ctrlKey) return
      e.preventDefault()
      setFontSize((prev) => {
        const next = Math.min(24, Math.max(9, prev - Math.sign(e.deltaY)))
        showToast(`${next}px`)
        return next
      })
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('wheel', handleWheel)
      clearTimeout(toastTimerRef.current)
    }
  }, [onClose, searchOpen])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose?.()
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        setSearchIdx((prev) => (prev <= 0 ? matches.length - 1 : prev - 1))
      } else {
        setSearchIdx((prev) => (prev >= matches.length - 1 ? 0 : prev + 1))
      }
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      setSearchOpen(false)
      setSearchQuery('')
      setSearchIdx(0)
    }
  }

  if (!file) return null

  const ext = (file.name?.split('.').pop() || 'txt').toLowerCase()
  const isImage = ['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext)
  const isVideo = ['mp4','webm','mkv','avi','mov','wmv','flv'].includes(ext)
  const isMedia = isImage || isVideo
  const mediaUrl = file.path ? `stream://audio?url=${encodeURIComponent(file.path)}` : ''

  return createPortal(
    <div ref={overlayRef} className="file-viewer-overlay" onClick={handleOverlayClick}>
      <div className={`file-viewer-panel ${maximized ? 'file-viewer-max' : ''}`}>
        <div className="file-viewer-header">
          <div className="file-viewer-title">
            <span className="file-viewer-icon">{'\u{1F4C4}'}</span>
            <span>{file.name || file.path}</span>
            {file.size && <span className="file-viewer-size">{formatSize(file.size)}</span>}
          </div>
          <div className="file-viewer-actions">
            <button className="file-viewer-maximize" onClick={() => setMaximized(!maximized)}
              title={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? '\u{25E3}' : '\u{25E2}'}
            </button>
            <button className="file-viewer-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="file-viewer-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0) }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Find..."
              spellCheck={false}
              className="file-viewer-search-input"
            />
            {searchQuery && (
              <span className="file-viewer-search-count">
                {matches.length > 0 ? `${searchIdx + 1}/${matches.length}` : '0/0'}
              </span>
            )}
            <button className={`search-toggle ${searchCase ? 'active' : ''}`}
              onClick={() => setSearchCase((v) => !v)} title="Case sensitive">Aa</button>
            <button className={`search-toggle ${searchRegex ? 'active' : ''}`}
              onClick={() => setSearchRegex((v) => !v)} title="Use regex">.*</button>
            <button className="file-viewer-search-close" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchCase(false); setSearchRegex(false); }}>×</button>
          </div>
        )}

        <div className={`file-viewer-body ${isMedia ? 'file-viewer-media' : ''}`} ref={codeContainerRef}>
          {loading && <div className="file-viewer-loading">Reading file...</div>}
          {err && <div className="file-viewer-error">{err}</div>}
          {!loading && !err && isImage && (
            <img src={mediaUrl} alt={file.name} />
          )}
          {!loading && !err && isVideo && (
            <video controls autoPlay src={mediaUrl}>
              Your browser does not support the video tag.
            </video>
          )}
          {!loading && !err && !isMedia && (
            <pre className="file-viewer-code" style={{ fontSize }}>
              {highlightedHtml ? (
                <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
              ) : (
                <code>{content}</code>
              )}
            </pre>
          )}
          {toast && (
            <div className="font-toast" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 30, pointerEvents: 'none' }}>
              <span className="toast-badge">{toast}</span>
            </div>
          )}
        </div>

        <div className="file-viewer-footer">
          <span>{ext}</span>
          {isImage && file.size && <span>{formatSize(file.size)}</span>}
          {isVideo && <span>Video</span>}
          {!isMedia && <span>{content.split('\n').length} lines</span>}
        </div>
      </div>
    </div>,
    document.body
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function generateMock(name) {
  const mocks = {
    'package.json': JSON.stringify({ name: 'galaxy-terminal', version: '0.1.0', type: 'module', scripts: { dev: 'electron-vite dev', build: 'electron-vite build' }, dependencies: { electron: '^28.0.0', react: '^18.2.0', 'node-pty': '^1.0.0', '@xterm/xterm': '^5.4.0' } }, null, 2),
    'App.jsx': `import { useState } from 'react'\nimport TerminalCanvas from './components/TerminalCanvas'\n\nexport default function App() {\n  const [sessions, setSessions] = useState([])\n  return (\n    <div className="app">\n      <TerminalCanvas />\n    </div>\n  )\n}`,
    'App.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --bg-deep: #070b14;\n  --accent: #3d7fff;\n}\n\n* { margin: 0; padding: 0; }`,
    'tailwind.config.js': `export default {\n  content: ['./src/**/*.{js,jsx,html}'],\n  theme: { extend: {} },\n  plugins: []\n}`,
    'index.js': `const { app, BrowserWindow } = require('electron')\nconst { join } = require('path')\n\nfunction createWindow() {\n  const win = new BrowserWindow({\n    width: 1200, height: 800\n  })\n  win.loadFile('index.html')\n}\n\napp.whenReady().then(createWindow)`,
  }
  return mocks[name] || `// Content of ${name}\n// (Sample preview)\n\nconst example = "This is a preview of the file content."\nconsole.log(example)\n`
}
