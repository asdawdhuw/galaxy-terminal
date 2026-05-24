import { ReactFlowProvider } from '@xyflow/react'
import MultiverseCanvas from './MultiverseCanvas'

export default function MultiverseView({ sessions, onNodeClick, onCanvasClick, onNodeClose, onNodeFocus }) {
  return (
    <ReactFlowProvider>
      <MultiverseCanvas sessions={sessions} onNodeClick={onNodeClick} onCanvasClick={onCanvasClick} onNodeClose={onNodeClose} onNodeFocus={onNodeFocus} />
    </ReactFlowProvider>
  )
}
