import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { museumWorkshopSavePlugin } from './scripts/workshop-save-plugin';

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: [museumWorkshopSavePlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/exhibits/')) return 'exhibits';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: false },
});
