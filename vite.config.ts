import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // GitHub Pages serves project sites from /<repo>/ — the deploy workflow sets this.
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    build: {
      // Firebase alone is ~500 kB; split vendors so app updates don't re-download them.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase'
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Overload — Workout Tracker',
          short_name: 'Overload',
          description: 'Plan, log and progress your training. Works offline.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0c1117',
          theme_color: '#0c1117',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // Never let the service worker intercept Firebase auth/firestore traffic.
          navigateFallbackDenylist: [/^\/__\//],
        },
      }),
    ],
  }
})
