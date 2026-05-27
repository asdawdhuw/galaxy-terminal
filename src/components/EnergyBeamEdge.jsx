import { BaseEdge, getBezierPath } from '@xyflow/react'

export default function EnergyBeamEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
  selected,
  style = {}
}) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition
  })

  const isActive = data?.energy === 'active' || selected
  const glowColor = isActive
    ? 'rgba(56,189,248,0.9)'
    : 'rgba(61,127,255,0.35)'
  const glowFilter = isActive
    ? 'drop-shadow(0 0 8px rgba(56,189,248,0.7)) drop-shadow(0 0 2px rgba(56,189,248,0.5))'
    : 'drop-shadow(0 0 3px rgba(61,127,255,0.2))'

  return (
    <g style={{ filter: glowFilter }}>
      {/* Base edge — the "pipe" */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: glowColor,
          strokeWidth: isActive ? 2 : 1.2,
          strokeOpacity: isActive ? 1 : 0.6,
          ...style
        }}
      />

      {/* Flowing energy dot — animated dash */}
      <path
        d={edgePath}
        fill="none"
        stroke={isActive ? '#bae6fd' : 'rgba(56,189,248,0.6)'}
        strokeWidth={isActive ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray="8 200"
        className="energy-beam-dash"
        style={{
          filter: isActive
            ? 'drop-shadow(0 0 6px rgba(186,230,253,0.9))'
            : 'drop-shadow(0 0 3px rgba(56,189,248,0.4))'
        }}
      />
    </g>
  )
}
