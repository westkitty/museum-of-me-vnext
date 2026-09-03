/**
 * Rebuild the three Phase-3 runtime GLBs from their retained official sources.
 * Originals live in ignored .asset-sources/ and never ship with the museum.
 *
 * Usage: node scripts/convert-quaternius-assets.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, '.asset-sources/quaternius');
const outputRoot = resolve(root, 'src/assets/npc');

// GLTFExporter is browser-oriented. These minimal compatible shims are only
// used by this local build utility; no runtime dependency is added.
if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      Object.assign(this, init);
    }
  };
}

if (!globalThis.FileReader) {
  globalThis.FileReader = class FileReader extends EventTarget {
    result = null;
    error = null;
    onload = null;
    onloadend = null;
    onerror = null;

    async readAsArrayBuffer(blob) {
      try {
        this.result = await blob.arrayBuffer();
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      } catch (error) {
        this.error = error;
        this.onerror?.({ target: this });
        this.onloadend?.({ target: this });
      }
    }
  };
}

function asArrayBuffer(data) {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function parseGltf(path) {
  const loader = new GLTFLoader();
  return readFile(path).then((source) => new Promise((resolveGltf, reject) => {
    loader.parse(asArrayBuffer(source), `${dirname(path)}/`, resolveGltf, reject);
  }));
}

function parseFbx(path) {
  const loader = new FBXLoader();
  return readFile(path).then((source) => loader.parse(asArrayBuffer(source), `${dirname(path)}/`));
}

function exportGlb(scene, animations = []) {
  const exporter = new GLTFExporter();
  return new Promise((resolveGlb, reject) => {
    exporter.parse(scene, resolveGlb, reject, { binary: true, animations });
  });
}

const conversions = [
  {
    source: resolve(sourceRoot, 'ultimate-modular-men/selected/Casual_2.gltf'),
    output: resolve(outputRoot, 'quaternius-men-casual.glb'),
    load: parseGltf,
  },
  {
    source: resolve(sourceRoot, 'ultimate-modular-women/selected/Casual.gltf'),
    output: resolve(outputRoot, 'quaternius-women-casual.glb'),
    load: parseGltf,
  },
  {
    source: resolve(sourceRoot, 'background-posed-humans/selected/Female_Sitting.fbx'),
    output: resolve(outputRoot, 'quaternius-posed-sitting.glb'),
    load: parseFbx,
  },
];

for (const conversion of conversions) {
  const loaded = await conversion.load(conversion.source);
  const scene = loaded.scene ?? loaded;
  const animations = loaded.animations ?? [];
  const glb = await exportGlb(scene, animations);
  if (!(glb instanceof ArrayBuffer)) throw new Error(`Expected binary GLB from ${conversion.source}`);
  await writeFile(conversion.output, new Uint8Array(glb));
  console.log(`${conversion.output}: ${glb.byteLength} bytes`);
}
