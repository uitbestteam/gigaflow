import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'GigaFlow', short_name: 'GigaFlow', theme_color: '#0f0f0f', background_color: '#0f0f0f', display: 'standalone', icons: [] } })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
