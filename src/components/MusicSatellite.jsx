import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

function MusicSatellite({ data, selected }) {
  return (
    <div
      className={`music-satellite ${selected ? 'music-satellite-selected' : ''}`}
      onClick={() => data?.onMusicOpen?.()}
      title="Click to open music player"
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />

      <span className="music-satellite-label">{'\u{1F3B5}'}</span>

      {/* Spectrum bars */}
      <div className="music-satellite-bars">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="music-satellite-bar" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

export default memo(MusicSatellite)
