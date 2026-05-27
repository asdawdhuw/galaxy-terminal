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
import EnergyBeamEdge from './EnergyBeamEdge'
import MusicSatellite from './MusicSatellite'
import FileWatcherNode from './FileWatcherNode'

const nodeTypes = {
  terminalNode: TerminalNode,
  musicSatellite: MusicSatellite,
  fileWatcher: FileWatcherNode,
}

const edgeTypes = { energyBeam: EnergyBeamEdge }

const INITIAL_NODES = [
  { id: 'n1', type: 'terminalNode', position: { x: 100, y: 100 }, data: { label: 'Session 1', width: 320 } },
  { id: 'n2', type: 'terminalNode', position: { x: 520, y: 80 }, data: { label: 'Session 2', width: 320 } },
  { id: 'n3', type: 'terminalNode', position: { x: 300, y: 380 }, data: { label: 'Session 3', width: 320 } },
  { id: 's-music', type: 'musicSatellite', position: { x: 80, y: 340 }, data: {} },
  { id: 's-watch', type: 'fileWatcher', position: { x: 700, y: 360 },
    data: { label: 'music/', watchPath: null, fileCount: 0 } },
]

export default function MultiverseCanvas({ sessions, focusId, onNodeClick, onCanvasClick, onNodeClose, onNodeFocus, onMusicOpen }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [focusedId, setFocusedId] = useState(null)
  const { setCenter, fitView } = useReactFlow()
  const containerRef = useRef(null)
  const onMusicOpenRef = useRef(onMusicOpen)
  onMusicOpenRef.current = onMusicOpen

  // Inject callbacks into satellite node data
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.type === 'musicSatellite'
          ? { ...n, data: { ...n.data, onMusicOpen: onMusicOpenRef.current } }
          : n
      )
    )
  }, [setNodes])

  // Sync terminal nodes from sessions
  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      // Keep satellite nodes, remove session nodes
      setNodes((nds) => nds.filter((n) => n.type !== 'terminalNode'))
      setFocusedId(null)
      return
    }
    setNodes((nds) => {
      const terminalNodes = nds.filter((n) => n.type === 'terminalNode')
      const satelliteNodes = nds.filter((n) => n.type !== 'terminalNode')
      const existing = new Map(terminalNodes.map((n) => [n.id, n]))
      const newNodes = sessions.map((s, i) => {
        const existingNode = existing.get(s.id)
        return {
          id: s.id,
          type: 'terminalNode',
          position: existingNode?.position || { x: 100 + (i % 3) * 420, y: 80 + Math.floor(i / 3) * 320 },
          data: {
            label: s.name, width: 320, session: s,
            isDimmed: focusedId ? focusedId !== s.id : false,
            onClose: onNodeClose, onFocus: onNodeFocus,
          },
        }
      })
      return [...newNodes, ...satelliteNodes]
    })
  }, [sessions])

  // Auto-focus
  useEffect(() => {
    if (!focusId) return
    const node = nodes.find((n) => n.id === focusId)
    if (!node) return
    setFocusedId(focusId)
    setTimeout(() => {
      setCenter(node.position.x + 160, node.position.y + 120, { zoom: 1.0, duration: 800 })
    }, 100)
  }, [focusId, nodes])

  // Update dimmed state
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isDimmed: focusedId ? focusedId !== n.id : false },
      }))
    )
  }, [focusedId])

  const handleNodeClick = useCallback(
    (_event, node) => {
      if (node.type === 'musicSatellite') {
        onMusicOpen?.()
        return
      }
      if (focusedId === node.id) return
      setFocusedId(node.id)
      setCenter(node.position.x + 160, node.position.y + 120, { zoom: 1.0, duration: 800 })
      onNodeClick?.(node.id)
    },
    [focusedId, setCenter, onNodeClick, onMusicOpen]
  )

  const handlePaneClick = useCallback(() => {
    setFocusedId(null)
    fitView({ padding: 0.3, duration: 800 })
    onCanvasClick?.()
  }, [fitView, onCanvasClick])

  const handleConnect = useCallback(
    (connection) => {
      setEdges((eds) => [
        ...eds,
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}`,
          type: 'energyBeam',
          data: { energy: 'idle' },
          animated: false,
        },
      ])
      // Flash energy active for 3s
      setTimeout(() => {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === `e-${connection.source}-${connection.target}`
              ? { ...e, data: { ...e.data, energy: 'active' } }
              : e
          )
        )
        // Reset after 3s
        setTimeout(() => {
          setEdges((eds) =>
            eds.map((e) =>
              e.id === `e-${connection.source}-${connection.target}`
                ? { ...e, data: { ...e.data, energy: 'idle' } }
                : e
            )
          )
        }, 3000)
      }, 100)
    },
    [setEdges]
  )

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
        edgeTypes={edgeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.55 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(61,127,255,0.12)" />
        <Controls className="multiverse-controls" showInteractive={false} />
        <MiniMap
          style={{ background: 'rgba(8,14,24,0.85)', border: '1px solid var(--border)' }}
          maskColor="rgba(0,0,0,0.4)"
          nodeColor="var(--accent)"
        />
      </ReactFlow>
    </div>
  )
}
