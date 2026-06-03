import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TerminalNode from './TerminalNode'
import EnergyBeamEdge from './EnergyBeamEdge'
import AudioRadarNode from './AudioRadarNode'
import FileWatcherNode from './FileWatcherNode'
import ResourcePodNode from './ResourcePodNode'
import MemoPageNode from './MemoPageNode'
import BlackHoleNode from './BlackHoleNode'

const BH_X = 20, BH_Y = 20, BH_R = 70

const nodeTypes = {
  terminalNode: TerminalNode,
  musicRadar: AudioRadarNode,
  fileWatcher: FileWatcherNode,
  resourcePod: ResourcePodNode,
  memoPage: MemoPageNode,
  blackHole: BlackHoleNode,
}

const edgeTypes = { energyBeam: EnergyBeamEdge }

let _podId = 0
let _memoId = 0

const INITIAL_NODES = [
  { id: 'n1', type: 'terminalNode', position: { x: 120, y: 120 }, data: { label: 'Session 1', width: 320 } },
  { id: 'n2', type: 'terminalNode', position: { x: 540, y: 100 }, data: { label: 'Session 2', width: 320 } },
  { id: 'n3', type: 'terminalNode', position: { x: 320, y: 400 }, data: { label: 'Session 3', width: 320 } },
  { id: 's-music', type: 'musicRadar', position: { x: 80, y: 340 }, data: {} },
  // Black hole — solid node inside ReactFlow viewport
  { id: 'bh-singularity', type: 'blackHole', position: { x: BH_X, y: BH_Y },
    draggable: true, selectable: false, deletable: false,
    style: { zIndex: 9999 },
    data: {}
  },
]

export default function MultiverseCanvas({ sessions, focusId, onNodeClick, onCanvasClick, onNodeClose, onNodeFocus, onMusicOpen }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [focusedId, setFocusedId] = useState(null)
  const [explosions, setExplosions] = useState([])
  const { setCenter, fitView, screenToFlowPosition, getNodes } = useReactFlow()
  const containerRef = useRef(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes  // always current, avoids stale closure in drag callback

  // Sync terminal nodes from sessions
  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      setNodes((nds) => nds.filter((n) => n.type !== 'terminalNode'))
      setFocusedId(null)
      return
    }
    setNodes((nds) => {
      const terminalNodes = nds.filter((n) => n.type === 'terminalNode')
      const otherNodes = nds.filter((n) => n.type !== 'terminalNode')
      const existing = new Map(terminalNodes.map((n) => [n.id, n]))
      const newNodes = sessions.map((s, i) => {
        const existingNode = existing.get(s.id)
        return {
          id: s.id,
          type: 'terminalNode',
          position: existingNode?.position || { x: 120 + (i % 3) * 420, y: 120 + Math.floor(i / 3) * 320 },
          data: {
            label: s.name, width: 320, session: s,
            isDimmed: focusedId ? focusedId !== s.id : false,
            onClose: onNodeClose, onFocus: onNodeFocus,
          },
        }
      })
      return [...newNodes, ...otherNodes]
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

  /* ================================================================
     Black Hole — check node overlap on drag stop
     ================================================================ */
  function isOverBlackHole(nodeX, nodeY) {
    const bhNode = nodesRef.current.find(n => n.id === 'bh-singularity')
    if (!bhNode) return false
    const bhCX = bhNode.position.x + BH_R, bhCY = bhNode.position.y + BH_R
    const dx = nodeX - bhCX, dy = nodeY - bhCY
    return Math.sqrt(dx * dx + dy * dy) < BH_R + 20
  }

  function triggerSuction(nodeId) {
    const bhNode = nodesRef.current.find(n => n.id === 'bh-singularity')
    const ex = bhNode ? bhNode.position.x + BH_R : BH_X + BH_R
    const ey = bhNode ? bhNode.position.y + BH_R : BH_Y + BH_R
    setExplosions(prev => [...prev, { id: 'exp-' + Date.now(), x: ex, y: ey }])
    setTimeout(() => {
      setNodes(nds => nds.filter(n => n.id !== nodeId))
      setExplosions(prev => prev.slice(1))
    }, 400)
  }

  const handleNodeDragStop = useCallback((_event, node) => {
    if (node.type === 'musicRadar' || node.id === 'bh-singularity') return
    const cx = (node.measured?.width || node.width || 50) / 2
    const cy = (node.measured?.height || node.height || 50) / 2
    if (isOverBlackHole(node.position.x + cx, node.position.y + cy)) {
      if (node.type === 'terminalNode') {
        onNodeClose?.(node.id)  // close the session
      }
      triggerSuction(node.id)
    }
  }, [])

  /* ================================================================
     File Drop — receive files dragged from FileTree
     ================================================================ */
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/galaxy-file')
    if (!raw) return
    try {
      const file = JSON.parse(raw)
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = `pod-${++_podId}`
      setNodes(nds => {
        if (nds.some(n => n.type === 'resourcePod' && n.data?.filePath === file.path)) return nds
        return [...nds, {
          id,
          type: 'resourcePod',
          position: { x: pos.x - 30, y: pos.y - 30 },
          data: { label: file.name, filePath: file.path }
        }]
      })
    } catch (_) {}
  }, [screenToFlowPosition, setNodes])

  /* ================================================================
     Memo Page — create new
     ================================================================ */
  function createMemo() {
    const id = `memo-${++_memoId}`
    setNodes(nds => [...nds, {
      id,
      type: 'memoPage',
      position: { x: 160 + _memoId * 25, y: 500 + _memoId * 20 },
      style: { width: 240, height: 180 },
      data: {
        label: 'New Page',
        content: '',
        onClose: () => setNodes(nds => nds.filter(n => n.id !== id))
      }
    }])
  }

  /* ================================================================
     Node click / pane click
     ================================================================ */
  const handleNodeClick = useCallback(
    (_event, node) => {
      if (node.id === 'bh-singularity') return
      if (node.type === 'musicRadar') return
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

  /* ================================================================
     Edge connect — energy always flowing when edge exists
     ================================================================ */
  const handleConnect = useCallback(
    (connection) => {
      const eid = `e-${connection.source}-${connection.target}`
      setEdges((eds) => {
        if (eds.some(e => e.id === eid)) return eds
        return [...eds, {
          ...connection,
          id: eid,
          type: 'energyBeam',
          data: { energy: 'flowing' },
          animated: true,
        }]
      })
    },
    [setEdges]
  )

  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 300)
    function onResize() { fitView({ padding: 0.3, duration: 300 }) }
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize) }
  }, [fitView])

  // Keyboard: Delete/Backspace removes selected edges + deletable nodes
  useEffect(() => {
    const deletableTypes = new Set(['terminalNode', 'resourcePod', 'memoPage'])
    function onKey(e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      // Remove selected edges
      setEdges(eds => eds.filter(e => !e.selected))
      // Remove selected deletable nodes
      const selectedNodes = getNodes().filter(n => n.selected && deletableTypes.has(n.type))
      if (selectedNodes.length > 0) {
        selectedNodes.forEach(n => {
          if (n.type === 'terminalNode') onNodeClose?.(n.id)
        })
        setNodes(nds => nds.filter(n => !selectedNodes.some(sn => sn.id === n.id)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setEdges, setNodes, getNodes, onNodeClose])

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div ref={containerRef} className="multiverse-canvas">
      {/* New memo page button — bottom-left */}
      <div className="multiverse-left-panel">
        <button className="mv-panel-btn" onClick={createMemo} title="Create memo page">
          <span className="mv-panel-icon">+</span>
        </button>
      </div>

      {/* Explosions */}
      {explosions.map(exp => (
        <div
          key={exp.id}
          className="mv-bh-explosion"
          style={{ left: exp.x - 40, top: exp.y - 40 }}
        />
      ))}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.55 }}
        minZoom={0.15}
        maxZoom={2}
        deleteKeyCode={[]}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(61,127,255,0.12)" />
        <MiniMap
          style={{ background: 'rgba(8,14,24,0.85)', border: '1px solid var(--border)' }}
          maskColor="rgba(0,0,0,0.4)"
          nodeColor="var(--accent)"
        />
      </ReactFlow>
    </div>
  )
}
