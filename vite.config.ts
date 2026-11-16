import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works at any URL (GitHub Pages serves it under
  // /<repo-name>/, which changes if the repo is renamed). Set BASE_PATH to override.
  base: process.env.BASE_PATH ?? './',
  build: {
    // three.js + R3F is one ~375 KB gzipped bundle, well under the PRD's 5 MB initial-load budget.
    chunkSizeWarningLimit: 1600,
  },
})
