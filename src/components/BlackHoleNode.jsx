import { memo } from 'react'

function BlackHoleNode() {
  return (
    <div className="bh-node" style={{ width: 140, height: 140 }}>
      <div className="bh-node-core" />
      <div className="bh-node-accretion" />
      <svg className="bh-node-ring" viewBox="0 0 160 160">
        <ellipse cx="80" cy="80" rx="72" ry="28" fill="none" stroke="rgba(100,40,140,0.3)" strokeWidth="1.5" strokeDasharray="8 5">
          <animateTransform attributeName="transform" type="rotate" values="0 80 80;360 80 80" dur="8s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="80" cy="80" rx="28" ry="72" fill="none" stroke="rgba(100,40,140,0.2)" strokeWidth="1" strokeDasharray="5 7">
          <animateTransform attributeName="transform" type="rotate" values="360 80 80;0 80 80" dur="11s" repeatCount="indefinite" />
        </ellipse>
      </svg>
      <span className="bh-node-label">SINGULARITY</span>
    </div>
  )
}

export default memo(BlackHoleNode)
