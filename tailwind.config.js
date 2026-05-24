/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,html}'],
  theme: {
    extend: {
      colors: {
        cosmos: {
          bg: '#0a0a14',
          panel: '#12121f',
          border: '#2a2a45',
          text: '#e8e8f5',
          dim: '#8b8ba8',
          accent: '#6eb5d9',
          glow: '#a78bfa',
          accent2: '#c98fd4'
        },
        sidebar: {
          DEFAULT: '#14141f',
          foreground: '#d8d8e8',
          accent: '#1e1e30',
          'accent-foreground': '#e8e8f5',
          primary: '#6eb5d9',
          border: '#2a2a40'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace']
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite'
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' }
        }
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
}
