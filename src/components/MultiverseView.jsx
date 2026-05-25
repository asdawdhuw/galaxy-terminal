import { ReactFlowProvider } from '@xyflow/react'
import MultiverseCanvas from './MultiverseCanvas'

export default function MultiverseView({ sessions, focusId, onNodeClick, onCanvasClick, onNodeClose, onNodeFocus }) {
  return (
    <ReactFlowProvider>
      <MultiverseCanvas sessions={sessions} focusId={focusId} onNodeClick={onNodeClick} onCanvasClick={onCanvasClick} onNodeClose={onNodeClose} onNodeFocus={onNodeFocus} />
    </ReactFlowProvider>
  )
}
