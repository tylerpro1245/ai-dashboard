import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.TAURI_DEBUG ? '/' : './',
  server: { port: 5174, strictPort: true }   // ← changed
})

