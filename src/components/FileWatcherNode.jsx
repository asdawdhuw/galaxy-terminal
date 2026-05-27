import { memo, useState, useEffect, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'

function FileWatcherNode({ data, selected }) {
  const [pulsing, setPulsing] = useState(false)
  const [fileCount, setFileCount] = useState(data?.fileCount ?? 0)

  // Listen for file change events
  const onFsChange = useCallback((_event, info) => {
    if (info?.dirPath === data?.watchPath) {
      setFileCount(info.fileCount ?? (c => c + 1))
      setPulsing(true)
      setTimeout(() => setPulsing(false), 1200)
    }
  }, [data?.watchPath])

  useEffect(() => {
    if (!data?.watchPath) return
    window.terminal.watchDir(data.watchPath)
    const unsub = window.terminal.onFsChanged?.(onFsChange)
    return () => { unsub?.() }
  }, [data?.watchPath])

  const label = data?.label || 'Watcher'
  return (
    <div className={`file-watcher-node ${pulsing ? 'pulsing' : ''} ${selected ? 'watcher-selected' : ''}`}>
      {/* Pulse rings */}
      {pulsing && (
        <>
          <span className="watcher-pulse-ring" style={{ animationDelay: '0s' }} />
          <span className="watcher-pulse-ring" style={{ animationDelay: '0.3s' }} />
          <span className="watcher-pulse-ring" style={{ animationDelay: '0.6s' }} />
        </>
      )}

      <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />

      <span className="watcher-icon">{'\u{1F4C1}'}</span>
      <span className="watcher-label">{label}</span>
      <span className="watcher-count">{fileCount} files</span>
    </div>
  )
}

export default memo(FileWatcherNode)
