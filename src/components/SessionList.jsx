import SessionItem from './SessionItem'

export default function SessionList({ sessions, activeId, onSwitch, onRename, onClose, onNew }) {
  return (
    <aside
      className="w-60 shrink-0 border-r border-white/10 flex flex-col"
      style={{ background: 'rgba(8, 8, 24, 0.03)', backdropFilter: 'blur(4px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-xs font-semibold text-cosmos-dim/70 uppercase tracking-widest">
          Sessions
        </span>
        <button
          onClick={onNew}
          className="text-cosmos-dim hover:text-cosmos-accent transition-colors text-xl leading-none"
          title="New session"
        >
          +
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-cosmos-dim/40 italic">No sessions</p>
            <button
              onClick={onNew}
              className="mt-2 text-[10px] text-cosmos-accent/60 hover:text-cosmos-accent
                         transition-colors"
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
              onSwitch={onSwitch}
              onRename={onRename}
              onClose={onClose}
            />
          ))
        )}
      </div>
    </aside>
  )
}
