import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { museumWorkshopSavePlugin } from './scripts/workshop-save-plugin';

export default defineConfig({
  // GitHub Pages serves this repository below /museum-of-me-vnext/. Normal
  // local/release builds keep the portable relative base unless explicitly set.
  base: process.env.VITE_PUBLIC_BASE || './',
  assetsInclude: ['**/*.glb'],
  plugins: [museumWorkshopSavePlugin(), {
    name: 'museum-private-workshop-assets',
    apply: 'build',
    async buildStart() {
      const manifest = JSON.parse(await readFile(resolve('data/workshop-placements.json'), 'utf8')) as {
        objects?: { assetId?: string; image?: string; texture?: string }[];
        surfaceOverrides?: { texture?: string }[];
      };
      const references = [
        ...(manifest.objects ?? []).flatMap((object) => [object.assetId, object.image, object.texture]),
        ...(manifest.surfaceOverrides ?? []).map((surface) => surface.texture),
      ];
      if (references.some((value) => value?.startsWith('workshop-models/') || value?.startsWith('workshop-media/'))) {
        this.error('Public builds cannot include private Workshop imports. Preserve the manifest and use the local standalone workflow or remove references only with owner approval.');
      }
    },
    async writeBundle(options) {
      const output = resolve(options.dir ?? 'dist');
      await Promise.all(['workshop-models', 'workshop-media'].map((name) =>
        rm(resolve(output, name), { recursive: true, force: true })));
    },
  }, {
    name: 'museum-workbench-directory-index',
    configureServer(server) {
      // Vite's public-file lookup indexes files, not directories. Without this
      // rewrite /workbench/ falls through to the museum SPA's index.html.
      server.middlewares.use((req, _res, next) => {
        const [path, query] = (req.url ?? '').split('?');
        const base = server.config.base;
        if ((req.method === 'GET' || req.method === 'HEAD') && path === `${base}workbench/`) {
          req.url = `${base}workbench/index.html${query === undefined ? '' : `?${query}`}`;
        }
        next();
      });
    },
  }],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 4096,
    modulePreload: {
      resolveDependencies: (_filename, deps) => {
        return deps.filter((dep) => !dep.includes('interior'));
      },
    },
    rollupOptions: {
      input: {
        museum: fileURLToPath(new URL('./index.html', import.meta.url)),
        workbench3d: fileURLToPath(new URL('./workbench3d/index.html', import.meta.url)),
      },
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
          if (
            id.includes('/src/exhibits/')
            || id.includes('/src/world/InteriorWorld')
            || id.includes('/src/world/Museum')
          ) return 'interior';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: false, allowedHosts: true },
});
