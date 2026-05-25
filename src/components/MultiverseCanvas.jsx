import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TerminalNode from './TerminalNode'

const nodeTypes = { terminalNode: TerminalNode }

const INITIAL_NODES = [
  { id: 'n1', type: 'terminalNode', position: { x: 100, y: 100 }, data: { label: 'Session 1', width: 320 } },
  { id: 'n2', type: 'terminalNode', position: { x: 500, y: 80 }, data: { label: 'Session 2', width: 320 } },
  { id: 'n3', type: 'terminalNode', position: { x: 300, y: 380 }, data: { label: 'Session 3', width: 320 } },
]

export default function MultiverseCanvas({ sessions, focusId, onNodeClick, onCanvasClick, onNodeClose, onNodeFocus }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [focusedId, setFocusedId] = useState(null)
  const { setCenter, fitView } = useReactFlow()
  const containerRef = useRef(null)

  // Sync nodes from sessions
  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      setNodes([])
      setFocusedId(null)
      return
    }
    const existing = new Map(nodes.map((n) => [n.id, n]))
    const newNodes = sessions.map((s, i) => {
      const existingNode = existing.get(s.id)
      return {
        id: s.id,
        type: 'terminalNode',
        position: existingNode?.position || { x: 100 + (i % 3) * 400, y: 80 + Math.floor(i / 3) * 320 },
        data: { label: s.name, width: 320, session: s, isDimmed: focusedId ? focusedId !== s.id : false, onClose: onNodeClose, onFocus: onNodeFocus },
      }
    })
    setNodes(newNodes)
  }, [sessions])

  // Auto-focus on a node when entering canvas from terminal yellow button
  useEffect(() => {
    if (!focusId) return
    const node = nodes.find((n) => n.id === focusId)
    if (!node) return
    setFocusedId(focusId)
    setTimeout(() => {
      setCenter(node.position.x + 160, node.position.y + 120, { zoom: 1.0, duration: 800 })
    }, 100)
  }, [focusId, nodes])

  // Update dimmed state when focus changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isDimmed: focusedId ? focusedId !== n.id : false },
      }))
    )
  }, [focusedId])

  // Focus a node — warp zoom
  const handleNodeClick = useCallback(
    (_event, node) => {
      if (focusedId === node.id) return
      setFocusedId(node.id)
      setCenter(node.position.x + 160, node.position.y + 120, { zoom: 1.0, duration: 800 })
      onNodeClick?.(node.id)
    },
    [focusedId, setCenter, onNodeClick]
  )

  // Click canvas — reset to overview
  const handlePaneClick = useCallback(() => {
    setFocusedId(null)
    fitView({ padding: 0.3, duration: 800 })
    onCanvasClick?.()
  }, [fitView, onCanvasClick])

  // Connect nodes
  const handleConnect = useCallback(
    (connection) => {
      setEdges((eds) => [
        ...eds,
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}`,
          animated: true,
          style: { stroke: 'rgba(61,127,255,0.35)', strokeWidth: 1.5 },
        },
      ])
    },
    [setEdges]
  )

  // Init fit view
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={containerRef} className="multiverse-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.55 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(61,127,255,0.12)" />
        <Controls className="multiverse-controls" />
        <MiniMap
          style={{ background: 'rgba(8,14,24,0.85)', border: '1px solid var(--border)' }}
          maskColor="rgba(0,0,0,0.4)"
          nodeColor="var(--accent)"
        />
      </ReactFlow>
    </div>
  )
}
