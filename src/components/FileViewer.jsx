import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const LANG_CLASS = {
  js: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx',
  css: 'css', html: 'html', json: 'json', md: 'md',
  py: 'py', c: 'c', cpp: 'cpp', java: 'java', go: 'go', rs: 'rs',
}

export default function FileViewer({ file, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [fontSize, setFontSize] = useState(13)
  const [toast, setToast] = useState(null)
  const overlayRef = useRef(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    if (!file) return

    // If file has a path property, read from disk
    if (file.path) {
      setLoading(true)
      setErr('')
      window.terminal.readFile(file.path).then((res) => {
        if (res.ok) {
          setContent(res.content)
        } else {
          setContent('')
          setErr(res.error)
        }
        setLoading(false)
      })
    } else {
      // Mock content for demo files
      setContent(generateMock(file.name))
      setLoading(false)
    }
  }, [file])

  function showToast(text) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(text)
    toastTimerRef.current = setTimeout(() => setToast(null), 1200)
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.()
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
  }, [onClose])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose?.()
  }

  if (!file) return null

  const lang = file.name?.split('.').pop() || 'txt'

  return createPortal(
    <div
      ref={overlayRef}
      className="file-viewer-overlay"
      onClick={handleOverlayClick}
    >
      <div className={`file-viewer-panel ${maximized ? 'file-viewer-max' : ''}`}>
        <div className="file-viewer-header">
          <div className="file-viewer-title">
            <span className="file-viewer-icon">{'\u{1F4C4}'}</span>
            <span>{file.name || file.path}</span>
            {file.size && (
              <span className="file-viewer-size">{formatSize(file.size)}</span>
            )}
          </div>
          <div className="file-viewer-actions">
            <button
              className="file-viewer-maximize"
              onClick={() => setMaximized(!maximized)}
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? '\u{25E3}' : '\u{25E2}'}
            </button>
            <button className="file-viewer-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="file-viewer-body">
          {loading && (
            <div className="file-viewer-loading">Reading file...</div>
          )}
          {err && (
            <div className="file-viewer-error">{err}</div>
          )}
          {!loading && !err && (
            <pre className="file-viewer-code" style={{ fontSize }}>
              <code>{content}</code>
            </pre>
          )}
          {toast && (
            <div className="font-toast" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 30, pointerEvents: 'none' }}>
              <span className="toast-badge">{toast}</span>
            </div>
          )}
        </div>

        <div className="file-viewer-footer">
          <span>{lang}</span>
          <span>{content.split('\n').length} lines</span>
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
