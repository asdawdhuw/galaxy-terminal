import { useMemo } from 'react'
import AnsiToHtml from 'ansi-to-html'

const converter = new AnsiToHtml({
  fg: '#e0e0f0',
  bg: 'transparent',
  colors: {
    0: '#1a1a2e',
    1: '#ff6b6b',
    2: '#69db7c',
    3: '#ffd43b',
    4: '#7c6ff7',
    5: '#da77f2',
    6: '#22b8cf',
    7: '#c8c8d8',
    8: '#4a4a6a',
    9: '#ff8787',
    10: '#8ce99a',
    11: '#ffe066',
    12: '#a78bfa',
    13: '#e599f7',
    14: '#66d9e8',
    15: '#f0f0f8'
  }
})

export default function CommandBlock({ block }) {
  const outputHtml = useMemo(() => {
    if (!block.output) return null
    return converter.toHtml(block.output)
  }, [block.output])

  return (
    <div className="command-block mx-3 mb-3 rounded-xl overflow-hidden border border-white/[0.06]"
         style={{ background: 'rgba(12, 12, 35, 0.45)', backdropFilter: 'blur(8px)' }}>
      {/* Command header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]"
           style={{ background: 'rgba(8, 8, 24, 0.3)' }}>
        <span className="text-cosmos-accent text-xs font-mono shrink-0">{'>'}</span>
        <span className="text-sm text-cosmos-text/90 font-mono truncate">{block.input}</span>
        {block.status === 'running' && (
          <span className="ml-auto w-2 h-2 rounded-full bg-cosmos-accent animate-pulse shrink-0" />
        )}
        {block.status === 'interrupted' && (
          <span className="ml-auto text-[10px] text-yellow-400/70 shrink-0">^C</span>
        )}
        {block.status === 'completed' && (
          <span className="ml-auto w-2 h-2 rounded-full bg-green-500/40 shrink-0" />
        )}
      </div>

      {/* Output body */}
      {outputHtml && (
        <div
          className="px-4 py-2.5 text-sm font-mono leading-relaxed overflow-x-auto"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: outputHtml }}
        />
      )}
    </div>
  )
}
