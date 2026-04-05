import { defineConfig } from 'vite';
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
      ws: 'isomorphic-ws',
    },
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/ledger-v7'],
  },
  build: {
    target: 'esnext',
  },
});
