import { useState } from 'react'

const MOCK_TREE = [
  { name: 'src', type: 'dir', children: [
    { name: 'components', type: 'dir', children: [
      { name: 'TerminalCanvas.jsx', type: 'file' },
      { name: 'SessionList.jsx', type: 'file' },
      { name: 'BlockList.jsx', type: 'file' },
      { name: 'TopMenuBar.jsx', type: 'file' },
    ]},
    { name: 'hooks', type: 'dir', children: [
      { name: 'useAudioEngine.js', type: 'file' },
      { name: 'useNeteaseMusicController.js', type: 'file' },
    ]},
    { name: 'App.jsx', type: 'file' },
    { name: 'App.css', type: 'file' },
  ]},
  { name: 'electron', type: 'dir', children: [
    { name: 'main', type: 'dir', children: [
      { name: 'index.js', type: 'file' },
    ]},
    { name: 'preload', type: 'dir', children: [
      { name: 'index.js', type: 'file' },
    ]},
  ]},
  { name: 'package.json', type: 'file' },
  { name: 'tailwind.config.js', type: 'file' },
]

function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className="file-tree-node"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <span className="file-tree-arrow" style={{ opacity: hasChildren ? 1 : 0 }}>
          {open ? '▾' : '▸'}
        </span>
        <span className="file-tree-icon">
          {node.type === 'dir' ? (open ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}'}
        </span>
        <span className="file-tree-name">{node.name}</span>
      </div>
      {hasChildren && open && node.children.map((child, i) => (
        <TreeNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function FileTree() {
  return (
    <div className="file-tree-list">
      {MOCK_TREE.map((node, i) => (
        <TreeNode key={i} node={node} depth={0} />
      ))}
    </div>
  )
}
