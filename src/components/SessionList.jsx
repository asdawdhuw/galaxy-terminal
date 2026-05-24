import { useRef, useState, useEffect, useCallback } from 'react'
import SessionItem from './SessionItem'
import FileTree from './FileTree'

export default function SessionList({ sessions, activeId, onSwitch, onRename, onClose, onNew, viewMode, onViewModeChange, focusMode, onFileOpen, cwd }) {
  const isFiles = viewMode === 'files'
  const sidebarRef = useRef(null)
  const [sidebarWidth, setSidebarWidth] = useState(176)

  // Resize logic
  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarRef.current?.offsetWidth || sidebarWidth
    function onMove(ev) {
      const w = Math.max(140, Math.min(500, startW + (ev.clientX - startX)))
      setSidebarWidth(w)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar-left flip-perspective ${focusMode ? 'panel-focus-out' : ''}`}
      style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
    >
      {/* Resize handle */}
      <div className="sidebar-resize-handle" onMouseDown={handleResizeStart} />

      <div className="sidebar-left-header">
        <h2 className="sidebar-left-title">{isFiles ? 'File Tree' : 'Sessions'}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isFiles && (
            <button
              onClick={onNew}
              className="sidebar-left-add"
              title="New Session"
              style={{ fontSize: 18, lineHeight: 1 }}
            >
              +
            </button>
          )}
          <button
            onClick={() => onViewModeChange?.(isFiles ? 'sessions' : 'files')}
            className="sidebar-left-flip-btn"
            title={isFiles ? 'Switch to Sessions' : 'Switch to File Tree'}
            style={{ fontSize: 13 }}
          >
            {isFiles ? '\u{1F4C4}' : '\u{1F4C1}'}
          </button>
        </div>
      </div>

      {/* 3D Flip Container */}
      <div className={`flip-container ${isFiles ? 'flipped' : ''}`}>
        {/* Front face: Sessions */}
        <div className="flip-face flip-front">
          <div className="sidebar-left-list">
            {sessions.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.4, fontStyle: 'italic' }}>
                  No sessions
                </p>
                <button
                  onClick={onNew}
                  style={{
                    marginTop: 8, fontSize: 10, color: 'var(--accent)', opacity: 0.6,
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  + New pwsh
                </button>
              </div>
            ) : (
              sessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === activeId}
                  canClose={sessions.length > 1}
                  onSwitch={onSwitch}
                  onRename={onRename}
                  onClose={onClose}
                />
              ))
            )}
          </div>
          {!isFiles && (
            <div className="sidebar-left-footer">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Back face: File Tree */}
        <div className="flip-face flip-back">
          <FileTree onFileOpen={onFileOpen} basePath={cwd} />
        </div>
      </div>
    </aside>
  )
}
