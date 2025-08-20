import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'electron-app/build',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  base: './',
})