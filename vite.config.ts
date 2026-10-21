import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const api = { '/api': { target: process.env.API_URL ?? 'http://localhost:3001', changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
})
