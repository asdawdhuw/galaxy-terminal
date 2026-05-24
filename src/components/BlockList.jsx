import { useRef, useEffect, useMemo } from 'react'
import AnsiToHtml from 'ansi-to-html'
import CommandBlock from './CommandBlock'

const converter = new AnsiToHtml({
  fg: '#c8d8f0',
  bg: 'transparent',
  colors: {
    0: '#0a1030', 1: '#ff5f57', 2: '#28c840', 3: '#febc2e',
    4: '#3d7fff', 5: '#7c6ff7', 6: '#22b8cf', 7: '#c8d8f0',
    8: '#1a3060', 9: '#ff7f77', 10: '#40e060', 11: '#ffd040',
    12: '#609fff', 13: '#a090ff', 14: '#40d8e8', 15: '#e8f0ff'
  }
})

export default function BlockList({ blocks, prelude }) {
  const bottomRef = useRef(null)

  const preludeHtml = useMemo(() => {
    if (!prelude) return null
    return converter.toHtml(prelude)
  }, [prelude])

  // Auto-scroll to bottom when blocks change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [blocks])

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {/* Prelude: pwsh banner / prompts before first command */}
      {preludeHtml && (
        <div
          className="mx-3 mb-3 px-4 py-2 text-sm font-mono leading-relaxed"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: preludeHtml }}
        />
      )}

      {blocks.map((block) => (
        <CommandBlock key={block.id} block={block} />
      ))}

      {/* Empty state */}
      {blocks.length === 0 && !prelude && (
        <div className="flex items-center justify-center h-full text-sm font-mono select-none" style={{ color: 'var(--text-dim)', opacity: 0.3 }}>
          Ready — type a command below
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
