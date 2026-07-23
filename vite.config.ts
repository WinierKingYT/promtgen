import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(), tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PromtGen · Yaşayan Proje Mimarı', short_name: 'PromtGen',
        description: 'Local-first AI destekli proje planlama çalışma alanı',
        theme_color: '#0b1020', background_color: '#0b1020', display: 'standalone',
        icons: [{ src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' }, { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }]
      }
    })
  ],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('jszip')) return 'archive';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('zod')) return 'schema';
          if (id.includes('@tauri-apps')) return 'tauri';
          return 'vendor';
        }
      }
    }
  }
});
