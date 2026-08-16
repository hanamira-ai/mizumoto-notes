import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'icons/icon-192x192.png',
          'icons/icon-512x512.png',
          'icons/icon-512x512-maskable.png',
          'icons/icon-192x192.svg',
          'icons/icon-512x512.svg',
          'icons/icon-512x512-maskable.svg',
        ],
        manifest: {
          name: 'Mizumoto Notes',
          short_name: 'Notes',
          description: 'A fast, offline-first note-taking web app powered by IndexedDB and Dexie.js.',
          theme_color: '#A3242A',
          background_color: '#FFFFFF',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Precache all compiled static assets
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
          // Runtime caching with Cache First for static resources
          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                request.destination === 'style' ||
                request.destination === 'script' ||
                request.destination === 'worker' ||
                request.destination === 'image' ||
                request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'mizumoto-static-assets',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
