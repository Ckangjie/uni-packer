import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  clearScreen: false,
  build: {
    emptyOutDir: true
  },
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1'
  }
})
