import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('electron/main/index.js')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('electron/preload/index.js')
      }
    }
  },
  renderer: {
    root: resolve('src'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve('src/index.html')
      }
    }
  }
})
