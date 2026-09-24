import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const publicDir = resolve(__dirname, '../../assets-source');

export default defineConfig({
  plugins: [react()],
  publicDir,
  resolve: {
    alias: {
      '@tradeclass/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@tradeclass/world-engine': resolve(__dirname, '../../packages/world-engine/src/index.ts'),
      '@tradeclass/iso-office': resolve(__dirname, '../../packages/iso-office/src/index.ts'),
      '@tradeclass/iso-characters': resolve(__dirname, '../../packages/iso-characters/src/index.ts'),
    },
  },
  server: { port: 5174, open: false },
});
