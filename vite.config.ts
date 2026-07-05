import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // pdfmake/build/vfs_fonts.js is ~3.5MB of base64-encoded fonts.
    // Raise the chunk size warning limit so Vite doesn't error on it.
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        // Split pdfmake into its own chunk so it doesn't block other transforms.
        manualChunks(id) {
          if (id.includes('pdfmake')) {
            return 'pdfmake';
          }
          if (id.includes('docx') || id.includes('xlsx')) {
            return 'office-export';
          }
        },
      },
    },
  },
})
