import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

function ResourcePodNode({ data, selected }) {
  function handleOpen() {
    window.dispatchEvent(new CustomEvent('galaxy:openFile', {
      detail: { name: data.label, path: data.filePath }
    }))
  }

  return (
    <>
      <div
        className={`resource-pod-node ${selected ? 'pod-selected' : ''}`}
        onDoubleClick={handleOpen}
        title={`${data.label}\nDouble-click to open`}
      >
        <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />

        <div className="pod-core">
          <span className="pod-icon">{'\u{1F4C4}'}</span>
        </div>
        <svg className="pod-ring" viewBox="0 0 54 54">
          <circle cx="27" cy="27" r="24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="5 4" opacity={0.35} />
        </svg>
        <span className="pod-label">{data.label}</span>
      </div>
    </>
  )
}

export default memo(ResourcePodNode)
