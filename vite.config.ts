import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const pkg = JSON.parse(readFileSync(r('./package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'compose.yaml'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/compose\.yaml$/],
      },
      manifest: {
        name: 'burnmark',
        short_name: 'burnmark',
        description: 'Design beautiful labels',
        theme_color: '#f59e0b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        file_handlers: [
          {
            action: '/open',
            accept: {
              'application/json': ['.label'],
              'application/zip': ['.zip'],
            },
            launch_type: 'single-client',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': r('./src'),
      // Browser shims for designer-core's Node-only fallbacks. The runtime
      // code never enters those branches in a browser, but the bundler
      // still needs to resolve the imports.
      'node:crypto': r('./src/shims/node-crypto.ts'),
      'node:url': r('./src/shims/node-url.ts'),
      'node:path': r('./src/shims/node-path.ts'),
      '@napi-rs/canvas': r('./src/shims/napi-canvas.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
});
