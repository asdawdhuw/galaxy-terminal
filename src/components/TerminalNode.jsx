import { memo, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'

function TerminalNodeComponent({ data, selected, id }) {
  const containerRef = useRef(null)
  const [compact, setCompact] = useState(false)

  function handleClose(e) {
    e.stopPropagation()
    data.onClose?.(id)
  }

  function handleMinimize(e) {
    e.stopPropagation()
    setCompact(!compact)
  }

  function handleZoom(e) {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('canvas:focus-node', { detail: id }))
  }

  return (
    <motion.div
      className="terminal-node-wrapper"
      animate={{
        opacity: data.isDimmed ? 0.3 : 1,
        filter: data.isDimmed ? 'blur(4px)' : 'blur(0px)',
        boxShadow: selected
          ? '0 0 20px rgba(var(--accent-r, 61), var(--accent-g, 127), var(--accent-b, 255), 0.4), 0 0 60px rgba(var(--accent-r, 61), var(--accent-g, 127), var(--accent-b, 255), 0.1)'
          : '0 0 8px rgba(0,0,0,0.3)',
      }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ width: data.width || 320, borderRadius: 12, overflow: 'hidden' }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: 'none', width: 8, height: 8 }} />

      <div className="terminal-node-chrome" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="flex items-center gap-1.5">
          <button className="node-dot node-dot-red" onClick={handleClose} title="Close" />
          <button className="node-dot node-dot-yellow" onClick={handleMinimize} title={compact ? 'Expand' : 'Minimize'} />
          <button className="node-dot node-dot-green" onClick={handleZoom} title="Zoom in" />
        </div>
        <span className="terminal-node-title">{data.label || 'Terminal'}</span>
      </div>

      <motion.div
        className="terminal-node-body"
        ref={containerRef}
        animate={{ height: compact ? 0 : 180, opacity: compact ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="terminal-node-preview">
          {data.session ? (
            <span style={{ color: 'var(--accent)', fontSize: 12 }}>● {data.session.name} — pwsh</span>
          ) : (
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Inactive session</span>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default memo(TerminalNodeComponent)
