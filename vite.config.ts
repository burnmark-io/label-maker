import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue()],
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
