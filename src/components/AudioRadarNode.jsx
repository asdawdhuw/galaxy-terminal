import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { onMusicStateChange, getMusicState } from '../utils/musicState'

function AudioRadarNode({ selected }) {
  const [state, setState] = useState(() => getMusicState())

  useEffect(() => {
    return onMusicStateChange(s => setState({ ...s }))
  }, [])

  const reallyPlaying = state.playing && state.trackName
  const { trackName } = state

  return (
    <div className={`audio-radar-node ${reallyPlaying ? 'playing' : ''} ${selected ? 'radar-selected' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: 'none', width: 6, height: 6 }} />

      <div className={`radar-core ${reallyPlaying ? 'breathing' : ''}`}>
        <span className="radar-icon">{reallyPlaying ? '\u{266B}' : '\u{2669}'}</span>
      </div>

      {reallyPlaying && (
        <svg className="radar-spectrum-ring" viewBox="0 0 72 72">
          {[0,1,2,3,4,5,6,7].map(i => (
            <rect key={i} x={10 + i*7} y={24} width={3.5} height={24} rx={1.5} fill="var(--accent)" opacity={0.55}>
              <animate attributeName="height" values="6;22;10;18;8;20;12;6" dur="0.6s" repeatCount="indefinite" begin={`${i*0.08}s`} />
              <animate attributeName="y" values="33;24;30;26;32;25;29;33" dur="0.6s" repeatCount="indefinite" begin={`${i*0.08}s`} />
            </rect>
          ))}
        </svg>
      )}

      {!reallyPlaying && (
        <svg className="radar-idle-ring" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="5 7" opacity={0.35}>
            <animateTransform attributeName="transform" type="rotate" values="0 36 36;360 36 36" dur="14s" repeatCount="indefinite" />
          </circle>
        </svg>
      )}

      {trackName && (
        <span className="radar-label">{trackName.length > 16 ? trackName.slice(0, 16) + '..' : trackName}</span>
      )}
    </div>
  )
}

export default memo(AudioRadarNode)
