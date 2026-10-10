import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { MANIFEST } from './src/pwa/manifest.ts'

export default defineConfig({
  plugins: [
    react(),
    // The service worker is a build-time concern; skip it under the test runner.
    ...(process.env.VITEST
      ? []
      : [
          VitePWA({
            // "prompt": a new version waits until the user chooses to refresh, so a
            // workout in progress is never reloaded underneath them.
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
            manifest: MANIFEST,
            workbox: {
              // Static app files only. User data lives in IndexedDB, never in this cache.
              globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
              navigateFallback: '/index.html',
              cleanupOutdatedCaches: true,
            },
          }),
        ]),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
