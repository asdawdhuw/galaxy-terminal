import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'

function MemoPageNode({ data, selected }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(data.label || 'New Page')
  const [content, setContentState] = useState(data.content || '')
  const taRef = useRef(null)

  useEffect(() => {
    if (editing) requestAnimationFrame(() => taRef.current?.focus())
  }, [editing])

  // Sync title/content back to node data for persistence
  useEffect(() => { data.onUpdate?.({ label: title, content }) }, [title, content])

  return (
    <div className={`memo-page-node ${selected ? 'memo-selected' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />

      <div className="memo-header">
        <input
          className="memo-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          spellCheck={false}
        />
        <button
          className="memo-close-btn"
          onClick={e => { e.stopPropagation(); data?.onClose?.() }}
        >×</button>
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          className="memo-textarea"
          value={content}
          onChange={e => setContentState(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <div className="memo-body" onDoubleClick={() => setEditing(true)}>
          {content || <span className="memo-placeholder">Double-click to write...</span>}
        </div>
      )}
    </div>
  )
}

export default memo(MemoPageNode)
