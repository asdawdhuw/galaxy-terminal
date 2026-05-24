import SessionItem from './SessionItem'

export default function SessionList({ sessions, activeId, onSwitch, onRename, onClose, onNew }) {
  return (
    <aside className="sidebar-left">
      <div className="sidebar-left-header">
        <h2 className="sidebar-left-title">Sessions</h2>
        <button
          onClick={onNew}
          className="sidebar-left-add"
          title="New Session"
        >
          +
        </button>
      </div>

      <div className="sidebar-left-list">
        {sessions.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.4, fontStyle: 'italic' }}>
              No sessions
            </p>
            <button
              onClick={onNew}
              style={{
                marginTop: 8,
                fontSize: 10,
                color: 'var(--accent)',
                opacity: 0.6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
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

      <div className="sidebar-left-footer">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
    </aside>
  )
}
