import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { museumWorkshopSavePlugin } from './scripts/workshop-save-plugin';

export default defineConfig({
  // GitHub Pages serves this repository below /museum-of-me-vnext/. Normal
  // local/release builds keep the portable relative base unless explicitly set.
  base: process.env.VITE_PUBLIC_BASE || './',
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
          // Keep deliberately deferred Three addons out of the startup vendor
          // chunk; otherwise Rollup's broad `three` bucket defeats import().
          if (id.includes('/three/examples/jsm/environments/RoomEnvironment.js')) return 'three-environment';
          if (
            id.includes('/three/examples/jsm/loaders/')
            || id.includes('/three/examples/jsm/libs/meshopt_decoder.module.js')
          ) return 'three-asset-loaders';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/exhibits/')) return 'exhibits';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: false, allowedHosts: true },
});
