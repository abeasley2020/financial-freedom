/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Phones on the same Wi-Fi join via http://<laptop-ip>:5173
    host: true,
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
