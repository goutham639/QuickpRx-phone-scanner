import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Worker bundling configuration
  worker: {
    format: 'es',
  },
  build: {
    // Ensure workers are properly bundled
    rollupOptions: {
      output: {
        // Keep worker chunks separate for better caching
        manualChunks: (id) => {
          if (id.includes('worker')) {
            return undefined; // Let Vite handle workers automatically
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'QuickPRx Scanner',
        short_name: 'Scanner',
        description: 'Scan barcodes remotely for QuickPRx Portal',
        theme_color: '#1e40af',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
    }),
  ],
});
