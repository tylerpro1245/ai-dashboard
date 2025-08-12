import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ✅ Critical for Tauri release builds
  base: process.env.TAURI_DEBUG ? '/' : './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
