import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Firebase
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          // UI & utilities
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'date-fns'],
          // Charts & data
          'vendor-charts': ['recharts', '@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
})
