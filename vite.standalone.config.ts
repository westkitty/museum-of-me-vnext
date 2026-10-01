import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  server: { allowedHosts: true },
  // Keep the offline bundle's asset handling aligned with the primary build:
  // local Quaternius visitor GLBs are runtime assets, never JavaScript.
  assetsInclude: ['**/*.glb'],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
