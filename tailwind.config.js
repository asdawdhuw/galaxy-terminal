/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,html}'],
  theme: {
    extend: {
      colors: {
        cosmos: {
          bg: '#06060f',
          panel: '#0c0c1d',
          border: '#1e1e3a',
          text: '#c8c8d8',
          dim: '#6b6b8a',
          accent: '#7c6ff7',
          glow: '#a78bfa'
        }
      },
      fontFamily: {
        mono: ['Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'monospace']
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
}
