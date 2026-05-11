import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'frappe-gantt/dist/frappe-gantt.css': path.resolve(
        __dirname, 'node_modules/frappe-gantt/dist/frappe-gantt.css'
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'gantt': ['frappe-gantt'],
          'utils': ['axios', 'sonner', 'sileo'],
        },
      },
    },
  },
})
