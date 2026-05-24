import { createPortal } from 'react-dom'

const THEMES = [
  {
    id: 'orion',
    name: 'Orion',
    desc: 'Deep-space void',
    color: '#38bdf8',
    bg: '#05070f',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    desc: 'Glacial cyan',
    color: '#22d3ee',
    bg: '#020617',
  },
  {
    id: 'sagittarius',
    name: 'Sagittarius',
    desc: 'Plasma orange',
    color: '#f97316',
    bg: '#0f0a05',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    desc: 'Hacker green',
    color: '#22c55e',
    bg: '#050505',
  },
  {
    id: 'supernova',
    name: 'Supernova',
    desc: 'Pure daylight',
    color: '#000000',
    bg: '#ffffff',
  },
]

export default function ThemePicker({ current, onSelect, onClose }) {
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div className="theme-picker-overlay" onClick={handleOverlayClick}>
      <div className="theme-picker-panel">
        <div className="theme-picker-header">
          <span>Gravity Field</span>
          <button className="file-viewer-close" onClick={onClose}>×</button>
        </div>

        <div className="theme-picker-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-card ${current === t.id ? 'theme-active' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <div
                className="theme-swatch"
                style={{
                  background: `linear-gradient(135deg, ${t.color}, ${t.bg})`,
                  boxShadow: current === t.id ? `0 0 20px ${t.color}55` : 'none',
                }}
              >
                <span className="theme-swatch-star" style={{ color: t.color }}>✧</span>
              </div>
              <div className="theme-card-name">{t.name}</div>
              <div className="theme-card-desc">{t.desc}</div>
              {current === t.id && (
                <div className="theme-active-badge" style={{ color: t.color }}>● Active</div>
              )}
            </button>
          ))}
        </div>

        <div className="theme-picker-hint">
          <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>,
    document.body
  )
}
