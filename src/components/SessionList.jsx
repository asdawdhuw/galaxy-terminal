import SessionItem from './SessionItem'

export default function SessionList({ sessions, activeId, onSwitch, onRename, onClose, onNew }) {
  return (
    <aside className="w-64 h-full bg-sidebar/80 backdrop-blur-md border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase font-mono">
            Sessions
          </h2>
          <button
            onClick={onNew}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
            title="新建会话"
          >
            <svg className="w-4 h-4 text-sidebar-foreground/60 group-hover:text-sidebar-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-cosmos-dim/50 italic font-mono">No sessions</p>
            <button
              onClick={onNew}
              className="mt-2 text-[10px] text-cosmos-accent/70 hover:text-cosmos-accent transition-colors font-mono"
            >
              + New pwsh
            </button>
          </div>
        ) : (
          sessions.map((s, index) => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === activeId}
              index={index}
              canClose={sessions.length > 1}
              onSwitch={onSwitch}
              onRename={onRename}
              onClose={onClose}
            />
          ))
        )}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/50 font-mono">
          {sessions.length} 个会话
        </div>
        <div className="mt-2">
          <div className="flex-1 h-1 bg-sidebar-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cosmos-accent to-cosmos-accent2 transition-all duration-500"
              style={{ width: `${Math.min(sessions.length * 20, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
