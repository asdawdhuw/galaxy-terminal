import { useMemo } from 'react'
import AnsiToHtml from 'ansi-to-html'

const converter = new AnsiToHtml({
  fg: '#c8d8f0',
  bg: 'transparent',
  colors: {
    0: '#0a1030',
    1: '#ff5f57',
    2: '#28c840',
    3: '#febc2e',
    4: '#3d7fff',
    5: '#7c6ff7',
    6: '#22b8cf',
    7: '#c8d8f0',
    8: '#1a3060',
    9: '#ff7f77',
    10: '#40e060',
    11: '#ffd040',
    12: '#609fff',
    13: '#a090ff',
    14: '#40d8e8',
    15: '#e8f0ff'
  }
})

export default function CommandBlock({ block }) {
  const outputHtml = useMemo(() => {
    if (!block.output) return null
    return converter.toHtml(block.output)
  }, [block.output])

  return (
    <div className="command-block mx-3 mb-3 rounded-xl overflow-hidden">
      <div className="command-block-header flex items-center gap-2 px-4 py-2.5">
        <span style={{ color: 'var(--accent)', fontSize: 13, fontFamily: 'monospace', flexShrink: 0 }}>{'>'}</span>
        <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.input}</span>
        {block.status === 'running' && (
          <span className="ml-auto" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
        )}
        {block.status === 'interrupted' && (
          <span className="ml-auto" style={{ fontSize: 10, color: 'var(--dot-yellow)', opacity: 0.7, flexShrink: 0 }}>^C</span>
        )}
        {block.status === 'completed' && (
          <span className="ml-auto" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5, flexShrink: 0, boxShadow: '0 0 4px var(--accent)' }} />
        )}
      </div>

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
