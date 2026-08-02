import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process', 'path'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      ws: fileURLToPath(new URL('./src/shims/ws.ts', import.meta.url)),
      'isomorphic-ws': fileURLToPath(new URL('./src/shims/ws.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/ledger-v8'],
  },
  build: {
    target: 'esnext',
  },
});
