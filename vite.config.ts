import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the game from /AI-game/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  build: {
    // three.js + R3F is one ~375 KB gzipped bundle, well under the PRD's 5 MB initial-load budget.
    chunkSizeWarningLimit: 1600,
  },
})
