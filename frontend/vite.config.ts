import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import redev from 'redev-vite-plugin'

export default defineConfig({
  plugins: [
    redev({ backendUrl: 'http://localhost:5050' }),
    react(),
  ],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      }
    }
  }
})
