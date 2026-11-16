import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js + R3F is one ~375 KB gzipped bundle, well under the PRD's 5 MB initial-load budget.
    chunkSizeWarningLimit: 1600,
  },
})
