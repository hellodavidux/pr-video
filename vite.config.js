import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@cal-simple': path.resolve(__dirname, 'cal-simple/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4174',
      '/renders': 'http://127.0.0.1:4174',
      '/captures': 'http://127.0.0.1:4174',
    },
  },
})
