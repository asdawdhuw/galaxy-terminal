/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,html}'],
  theme: {
    extend: {
      colors: {
        space: {
          deep: '#070b14',
          panel: 'rgba(8,13,28,0.85)',
          terminal: 'rgba(4,8,18,0.75)',
          border: 'rgba(40,80,160,0.25)',
          accent: '#3d7fff',
          'accent-dim': '#1a3a80',
          text: '#c8d8f0',
          dim: '#4a6080',
          'session-active': 'rgba(30,60,140,0.6)',
        },
        dot: {
          red: '#ff5f57',
          yellow: '#febc2e',
          green: '#28c840',
        }
      },
      fontFamily: {
        mono: ['Cascadia Code', 'JetBrains Mono', 'Fira Code', 'monospace'],
        ui: ['-apple-system', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'breathing': 'breathing 3s ease-in-out infinite',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' }
        },
        'breathing': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        }
      },
    }
  },
  plugins: []
}
