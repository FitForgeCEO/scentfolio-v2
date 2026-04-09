import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor splits ──
          if (id.includes('node_modules/react-dom')) return 'vendor-react'
          if (id.includes('node_modules/react-router')) return 'vendor-react'
          if (id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'

          // ── Shared app core (hooks, contexts, UI components) ──
          // These are imported by many screens; bundling them together
          // avoids duplicating across lazy-loaded screen chunks.
          if (id.includes('/src/contexts/')) return 'app-core'
          if (id.includes('/src/hooks/')) return 'app-core'
          if (id.includes('/src/lib/')) return 'app-core'
          if (id.includes('/src/components/ui/')) return 'app-core'
          if (id.includes('/src/components/layout/')) return 'app-core'
        },
      },
    },
  },
})
