import { useState, useEffect, useCallback } from 'react'

function TreeNode({ node, depth = 0, onFileOpen, loadChildren }) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState(null)
  const [loading, setLoading] = useState(false)
  const hasChildren = node.type === 'dir'
  const loaded = children !== null

  const handleClick = useCallback(async () => {
    if (!hasChildren) return
    if (!loaded && loadChildren) {
      setLoading(true)
      const kids = await loadChildren(node.path)
      setChildren(kids)
      setLoading(false)
    }
    setOpen(!open)
  }, [hasChildren, loaded, loadChildren, node.path, open])

  return (
    <div>
      <div
        className="file-tree-node"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={handleClick}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (node.type === 'file' && onFileOpen) {
            onFileOpen({ name: node.name, path: node.path })
          }
        }}
      >
        <span className="file-tree-arrow" style={{ opacity: hasChildren ? 1 : 0 }}>
          {loading ? '···' : open ? '\u{25BE}' : '\u{25B8}'}
        </span>
        <span className="file-tree-icon">
          {hasChildren ? (open ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}'}
        </span>
        <span className="file-tree-name" title={node.name}>{node.name}</span>
      </div>
      {hasChildren && open && children && children.map((child, i) => (
        <TreeNode key={i} node={child} depth={depth + 1} onFileOpen={onFileOpen} loadChildren={loadChildren} />
      ))}
    </div>
  )
}

export default function FileTree({ onFileOpen, basePath }) {
  const [roots, setRoots] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const loadChildren = useCallback(async (dirPath) => {
    try {
      const res = await window.terminal.listDir(dirPath)
      if (res.ok) return res.children
      return []
    } catch (_) {
      return []
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    // Use the terminal's CWD if available, otherwise project root
    const dir = basePath || '.'
    loadChildren(dir)
      .then((kids) => {
        setRoots(kids)
        setLoading(false)
      })
      .catch((e) => {
        setErr(e.message)
        setLoading(false)
      })
  }, [loadChildren, basePath])

  return (
    <div className="file-tree-list">
      {loading && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', opacity: 0.4 }}>
          Reading directory...
        </div>
      )}
      {err && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: 10, color: 'var(--dot-red)', opacity: 0.6 }}>
          {err}
        </div>
      )}
      {roots.map((node, i) => (
        <TreeNode key={i} node={node} depth={0} onFileOpen={onFileOpen} loadChildren={loadChildren} />
      ))}
    </div>
  )
}
