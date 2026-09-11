import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri expects a relative base and a fixed dev port
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
