import { useRef, useEffect, useMemo } from 'react'
import AnsiToHtml from 'ansi-to-html'
import CommandBlock from './CommandBlock'

const converter = new AnsiToHtml({
  fg: '#6b6b8a',
  bg: 'transparent',
  colors: {
    0: '#1a1a2e', 1: '#ff6b6b', 2: '#66d9e8', 3: '#ffd43b',
    4: '#7c6ff7', 5: '#da77f2', 6: '#22b8cf', 7: '#c8c8d8',
    8: '#4a4a6a', 9: '#ff8787', 10: '#8ce8f0', 11: '#ffe066',
    12: '#a78bfa', 13: '#e599f7', 14: '#66d9e8', 15: '#f0f0f8'
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
        <div className="flex items-center justify-center h-full text-cosmos-dim/30 text-sm font-mono select-none">
          Ready — type a command below
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
