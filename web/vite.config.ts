import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev, the FastAPI backend runs on :8000 (uv run uvicorn api.main:app --reload).
    proxy: { '/api': 'http://localhost:8000' },
  },
})
