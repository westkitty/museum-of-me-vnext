#!/usr/bin/env node
/**
 * RUNTIME PROFILE — measured counters from the real, shipped runtime.
 *
 * This boots `release/The_Reliquary_of_Iterative_Becoming.html` from file://
 * with the browser context offline, then samples the visitor's arrival, entry,
 * Rotunda and dome views. It does not substitute for a human visual, audio,
 * pointer-lock, or representative-device check.
 *
 * Usage:
 *   npm run build:standalone && npm run profile
 *   PROFILE_FRAMES=45 npm run profile
 *   PROFILE_HTML=/tmp/baseline.html PROFILE_SOURCE_REVISION=<sha> \
 *     PROFILE_SOURCE_STATE='clean archive baseline' \
 *     PROFILE_OUTPUT=validation/metrics/runtime-profile-before.json npm run profile
 *   PROFILE_RING_TRANSMISSION=0.03 \
 *     PROFILE_OUTPUT=validation/metrics/runtime-profile-transmission-control.json npm run profile
 *
 * `PROFILE_HTML` selects an artifact; `PROFILE_OUTPUT` selects the JSON path;
 * `PROFILE_SOURCE_REVISION` / `PROFILE_SOURCE_STATE` identify its source, and
 * `PROFILE_RING_TRANSMISSION` is a diagnostic runtime-only material override.
 * Output is diffable. `PROFILE_FRAMES` controls per-view rAF samples. The 1% /
 * 0.1% tail estimates are low-confidence unless at least 1,000 frames are sampled.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = process.env.PROFILE_HTML
  ? resolve(process.env.PROFILE_HTML)
  : join(root, 'release', 'The_Reliquary_of_Iterative_Becoming.html');
const outDir = join(root, 'validation', 'metrics');
const outFile = process.env.PROFILE_OUTPUT
  ? resolve(process.env.PROFILE_OUTPUT)
  : join(outDir, 'runtime-profile.json');
const BOOT_TIMEOUT_MS = 90_000;
const requestedFrames = Number.parseInt(process.env.PROFILE_FRAMES || '45', 10);
const FRAMES_PER_VIEW = Number.isFinite(requestedFrames) ? Math.max(10, requestedFrames) : 45;
const requestedRingTransmission = process.env.PROFILE_RING_TRANSMISSION;
const ringTransmissionOverride = requestedRingTransmission === undefined
  ? null
  : Number.parseFloat(requestedRingTransmission);
const profileSourceRevision = process.env.PROFILE_SOURCE_REVISION ?? 'UNSPECIFIED';
const profileSourceState = process.env.PROFILE_SOURCE_STATE ?? 'UNSPECIFIED';
if (ringTransmissionOverride !== null
  && (!Number.isFinite(ringTransmissionOverride) || ringTransmissionOverride < 0 || ringTransmissionOverride > 1)) {
  throw new Error('PROFILE_RING_TRANSMISSION must be a number between 0 and 1');
}
const VIEWPORT = { width: 640, height: 360 };

if (!existsSync(htmlPath)) {
  console.error('runtime-profile: missing release standalone — run `npm run build:standalone` first');
  process.exit(1);
}

/**
 * Fixed compositions keep each profile tied to a defined visitor viewpoint.
 * Their exact coordinates are part of the snapshot so later runs can reproduce it.
 */
const VIEWS = [
  {
    id: 'arrival-plaza',
    label: 'Arrival Plaza spawn, facing north toward the entrance',
    position: [0, 0, 138],
    yaw: 0,
    pitch: 0,
    expectedZone: 'plaza',
  },
  {
    id: 'vestibule',
    label: 'South vestibule, facing north into the Rotunda',
    position: [0, 0, 121],
    yaw: 0,
    pitch: 0.02,
    expectedZone: 'south',
  },
  {
    id: 'rotunda',
    label: 'Rotunda floor, facing north from the south approach',
    position: [0, 0, 6],
    yaw: 0,
    pitch: 0.02,
    expectedZone: 'rotunda',
  },
  {
    id: 'rotunda-dome',
    label: 'Rotunda centre, looking up at the dome',
    position: [0, 0, 0],
    yaw: 0,
    pitch: 1.2,
    expectedZone: 'rotunda',
  },
];

const fileUrl = pathToFileURL(resolve(htmlPath)).href;
const artifact = readFileSync(htmlPath);
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files',
  ],
});
const context = await browser.newContext({ viewport: VIEWPORT });
await context.setOffline(true);
const page = await context.newPage();

// Observe only WebGL/image method calls; this is CPU-side call duration, not
// asynchronous GPU completion. The wrappers run for boot and all sampled views.
await page.addInitScript(() => {
  const meters = {
    pageStartMs: performance.now(),
    shaderCompileCalls: 0,
    shaderCompileCallMs: 0,
    programLinkCalls: 0,
    programLinkCallMs: 0,
    textureUploadCalls: 0,
    textureUploadCallMs: 0,
    textureUploadKnownBytes: 0,
    bufferUploadCalls: 0,
    bufferUploadCallMs: 0,
    bufferUploadKnownBytes: 0,
    imageDecodeCalls: 0,
    imageDecodeCallMs: 0,
    imageSrcSetCalls: 0,
    imageLoadEvents: 0,
    imageSrcToLoadMs: 0,
    imageLoadErrors: 0,
    imageBitmapCalls: 0,
    imageBitmapCallMs: 0,
    app: {
      fixedUpdateMs: 0,
      fixedUpdateCalls: 0,
      variableUpdateMs: 0,
      variableUpdateCalls: 0,
      appRenderMs: 0,
      appRenderCalls: 0,
      rendererSubmitMs: 0,
      rendererSubmitCalls: 0,
    },
    gpuTimerAvailable: false,
    gpuQueries: [],
    gpuSamplesMs: [],
    gpuDisjoint: false,
  };
  Object.defineProperty(window, '__runtimeProfileMetrics', { value: meters });

  const wrap = (prototype, method, countKey, timeKey, bytesKey = null) => {
    const original = prototype?.[method];
    if (typeof original !== 'function') return;
    prototype[method] = function (...args) {
      const started = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        meters[countKey]++;
        meters[timeKey] += performance.now() - started;
        if (bytesKey) {
          const data = args.find((value) => ArrayBuffer.isView(value));
          if (data) meters[bytesKey] += data.byteLength;
          else if (typeof args[0] === 'number' && method === 'bufferData') meters[bytesKey] += args[0];
        }
      }
    };
  };

  const prototypes = new Set([
    window.WebGLRenderingContext?.prototype,
    window.WebGL2RenderingContext?.prototype,
  ].filter(Boolean));
  for (const prototype of prototypes) {
    wrap(prototype, 'compileShader', 'shaderCompileCalls', 'shaderCompileCallMs');
    wrap(prototype, 'linkProgram', 'programLinkCalls', 'programLinkCallMs');
    for (const method of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'compressedTexSubImage2D']) {
      wrap(prototype, method, 'textureUploadCalls', 'textureUploadCallMs', 'textureUploadKnownBytes');
    }
    for (const method of ['bufferData', 'bufferSubData']) {
      wrap(prototype, method, 'bufferUploadCalls', 'bufferUploadCallMs', 'bufferUploadKnownBytes');
    }
  }

  const imageDecode = window.HTMLImageElement?.prototype?.decode;
  if (typeof imageDecode === 'function') {
    window.HTMLImageElement.prototype.decode = function (...args) {
      const started = performance.now();
      meters.imageDecodeCalls++;
      return imageDecode.apply(this, args).finally(() => {
        meters.imageDecodeCallMs += performance.now() - started;
      });
    };
  }

  const imageSrc = Object.getOwnPropertyDescriptor(window.HTMLImageElement?.prototype ?? {}, 'src');
  if (imageSrc?.set && imageSrc.get && imageSrc.configurable) {
    Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
      configurable: imageSrc.configurable,
      enumerable: imageSrc.enumerable,
      get: imageSrc.get,
      set(value) {
        const started = performance.now();
        let settled = false;
        meters.imageSrcSetCalls++;
        const finish = (loaded) => {
          if (settled) return;
          settled = true;
          if (loaded) meters.imageLoadEvents++;
          else meters.imageLoadErrors++;
          meters.imageSrcToLoadMs += performance.now() - started;
        };
        this.addEventListener('load', () => finish(true), { once: true });
        this.addEventListener('error', () => finish(false), { once: true });
        imageSrc.set.call(this, value);
      },
    });
  }

  const createBitmap = window.createImageBitmap;
  if (typeof createBitmap === 'function') {
    window.createImageBitmap = function (...args) {
      const started = performance.now();
      meters.imageBitmapCalls++;
      return createBitmap.apply(this, args).finally(() => {
        meters.imageBitmapCallMs += performance.now() - started;
      });
    };
  }
});

const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const nodeStart = performance.now();
await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: BOOT_TIMEOUT_MS });
const domLoadedMs = performance.now() - nodeStart;
await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: BOOT_TIMEOUT_MS });
const appReadyMs = performance.now() - nodeStart;
await page.waitForFunction(() => (window.__museum?.renderer?.renderer?.info?.render?.frame ?? 0) > 0, null, {
  timeout: BOOT_TIMEOUT_MS,
});
const firstRenderMs = performance.now() - nodeStart;
const ringTransmissionOriginal = await page.evaluate(() => {
  const material = window.__museum?.sky?.bloodRing?.material;
  return material && !Array.isArray(material) && 'transmission' in material
    ? Number(material.transmission)
    : null;
});
if (ringTransmissionOverride !== null) {
  await page.evaluate((value) => {
    const material = window.__museum?.sky?.bloodRing?.material;
    if (!material || Array.isArray(material) || !('transmission' in material)) {
      throw new Error('Blood Ring physical material is unavailable for transmission override');
    }
    material.transmission = value;
    material.needsUpdate = true;
  }, ringTransmissionOverride);
}

/** Install frame-phase and optional timer-query probes after the first real frame. */
await page.evaluate(() => {
  const app = window.__museum;
  const meters = window.__runtimeProfileMetrics;
  if (!app || !meters) throw new Error('profile instrumentation or museum app missing');

  const wrapApp = (name, msKey, countKey) => {
    const original = app[name].bind(app);
    app[name] = (...args) => {
      const started = performance.now();
      try {
        return original(...args);
      } finally {
        meters.app[msKey] += performance.now() - started;
        meters.app[countKey]++;
      }
    };
  };
  wrapApp('fixedUpdate', 'fixedUpdateMs', 'fixedUpdateCalls');
  wrapApp('variableUpdate', 'variableUpdateMs', 'variableUpdateCalls');
  wrapApp('render', 'appRenderMs', 'appRenderCalls');

  const renderer = app.renderer.renderer;
  const gl = renderer.getContext();
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  meters.gpuTimerAvailable = Boolean(timer);
  const originalRender = renderer.render.bind(renderer);
  renderer.render = (...args) => {
    const started = performance.now();
    let query = null;
    if (timer) {
      try {
        query = gl.createQuery();
        gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      } catch {
        query = null;
      }
    }
    try {
      return originalRender(...args);
    } finally {
      meters.app.rendererSubmitMs += performance.now() - started;
      meters.app.rendererSubmitCalls++;
      if (query) {
        try {
          gl.endQuery(timer.TIME_ELAPSED_EXT);
          meters.gpuQueries.push(query);
        } catch {
          gl.deleteQuery(query);
        }
      }
    }
  };
  return { gpuTimerAvailable: Boolean(timer) };
});

/** The renderer's own capability report, read from a throwaway context. */
const capability = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return { webgl2: false };
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    webgl2: true,
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    anisotropy: Boolean(gl.getExtension('EXT_texture_filter_anisotropic')),
    colorBufferFloat: Boolean(gl.getExtension('EXT_color_buffer_float')),
    timerQuery: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')),
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory ?? null,
  };
});

const bootState = await page.evaluate(() => {
  const app = window.__museum;
  const m = window.__runtimeProfileMetrics;
  const memory = performance.memory;
  const streaming = app.streaming.telemetry;
  return {
    pageElapsedMs: Number((performance.now() - m.pageStartMs).toFixed(2)),
    heap: memory ? {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    } : null,
    streaming: { ...streaming },
    quality: {
      effective: { ...app.renderer.quality },
      preference: app.preferences?.quality ?? null,
      governor: app.governor?.snapshot ?? null,
    },
  };
});

/** Frame-time sampling, app CPU phases and renderer counters at one composition. */
const sampleView = (view, frames) => page.evaluate(async ({ view, frames }) => {
  const app = window.__museum;
  const meters = window.__runtimeProfileMetrics;
  app.player.teleport(view.position, view.yaw);
  app.player.pitch = view.pitch;
  app.player.applyToCamera(app.camera, 1);
  // Let the real loop, frustum, light director and streaming manager settle.
  await new Promise((done) => setTimeout(done, 900));

  const takeCounterSnapshot = () => ({ ...meters.app });
  const before = takeCounterSnapshot();
  const gpuStart = meters.gpuSamplesMs.length;
  const samples = [];
  const gpu = app.renderer.renderer.getContext();
  const timer = meters.gpuTimerAvailable ? gpu.getExtension('EXT_disjoint_timer_query_webgl2') : null;

  const drainGpuQueries = () => {
    if (!timer) return;
    const disjoint = gpu.getParameter(timer.GPU_DISJOINT_EXT);
    if (disjoint) meters.gpuDisjoint = true;
    while (meters.gpuQueries.length) {
      const query = meters.gpuQueries[0];
      if (!gpu.getQueryParameter(query, gpu.QUERY_RESULT_AVAILABLE)) break;
      meters.gpuQueries.shift();
      if (!disjoint) meters.gpuSamplesMs.push(gpu.getQueryParameter(query, gpu.QUERY_RESULT) / 1e6);
      gpu.deleteQuery(query);
    }
  };

  await new Promise((done) => {
    let previous = performance.now();
    const step = () => {
      const now = performance.now();
      samples.push(now - previous);
      previous = now;
      drainGpuQueries();
      if (samples.length < frames) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
  drainGpuQueries();

  const info = app.renderer.renderer.info;
  const sorted = samples.slice().sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const after = takeCounterSnapshot();
  const appFrames = Math.max(1, after.appRenderCalls - before.appRenderCalls);
  const phase = (key) => after[key] - before[key];
  const deltaMs = {
    fixedUpdate: phase('fixedUpdateMs'),
    variableUpdate: phase('variableUpdateMs'),
    appRender: phase('appRenderMs'),
    rendererSubmit: phase('rendererSubmitMs'),
  };
  const memory = performance.memory;
  const streaming = { ...app.streaming.telemetry };
  const mountedIds = [...app.streaming.hosts.values()]
    .filter((host) => host.currentState === 'mounted' || host.currentState === 'active')
    .map((host) => host.id ?? host.record?.id ?? host.record?.name ?? 'unknown');

  return {
    zone: app.currentZone,
    frames: samples.length,
    frameMs: {
      mean: Number(mean.toFixed(2)),
      p50: Number(at(0.5).toFixed(2)),
      p95: Number(at(0.95).toFixed(2)),
      p99: Number(at(0.99).toFixed(2)),
      onePercentLowMs: Number(at(0.99).toFixed(2)),
      pointOnePercentLowMs: Number(at(0.999).toFixed(2)),
      over33ms: samples.filter((sample) => sample > 33).length,
      tailConfidence: samples.length >= 1000 ? 'moderate' : 'low: fewer than 1000 samples; tail values are order statistics',
    },
    cpu: {
      samples: appFrames,
      jsFixedUpdateMeanMs: Number((deltaMs.fixedUpdate / appFrames).toFixed(3)),
      jsVariableUpdateMeanMs: Number((deltaMs.variableUpdate / appFrames).toFixed(3)),
      jsAppRenderMeanMs: Number((deltaMs.appRender / appFrames).toFixed(3)),
      rendererSubmitMeanMs: Number((deltaMs.rendererSubmit / appFrames).toFixed(3)),
      jsTrackedTotalMeanMs: Number(((deltaMs.fixedUpdate + deltaMs.variableUpdate + deltaMs.appRender) / appFrames).toFixed(3)),
      note: 'Main-thread wall time in instrumented application callbacks. Renderer submission is CPU-side and is included in jsAppRenderMeanMs; GPU execution is asynchronous.',
    },
    gpu: {
      status: timer ? (meters.gpuDisjoint ? 'PARTIAL_DISJOINT_SAMPLES' : 'MEASURED') : 'UNKNOWN_UNSUPPORTED_TIMER_QUERY',
      timerQueryExtension: Boolean(timer),
      samplesMs: meters.gpuSamplesMs.length - gpuStart,
      p50Ms: meters.gpuSamplesMs.length > gpuStart
        ? Number(meters.gpuSamplesMs.slice(gpuStart).sort((a, b) => a - b)[Math.floor((meters.gpuSamplesMs.length - gpuStart - 1) * 0.5)].toFixed(3))
        : null,
      note: timer
        ? 'EXT_disjoint_timer_query_webgl2 TIME_ELAPSED; disjoint samples excluded.'
        : 'The measured Chromium/SwiftShader context does not expose EXT_disjoint_timer_query_webgl2; GPU time cannot be separated from CPU/browser wall time here.',
    },
    render: {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      programs: info.programs?.length ?? null,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    },
    memory: {
      jsHeap: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null,
      rendererGeometries: info.memory.geometries,
      rendererTextures: info.memory.textures,
    },
    streaming,
    mountedIds,
    quality: {
      effective: { ...app.renderer.quality },
      preference: app.preferences?.quality ?? null,
      governor: app.governor?.snapshot ?? null,
    },
  };
}, { view, frames });

const views = {};
try {
  for (const view of VIEWS) {
    const sample = await sampleView(view, FRAMES_PER_VIEW);
    views[view.id] = { label: view.label, expectedZone: view.expectedZone, ...sample };
    if (sample.zone !== view.expectedZone) {
      errors.push(`${view.id} expected zone ${view.expectedZone}, observed ${sample.zone}`);
    }
    console.log(`runtime-profile: ${view.id} (${sample.zone}) — ${sample.render.drawCalls} draw calls, ` +
      `${sample.render.triangles} triangles, p50 ${sample.frameMs.p50} ms`);
  }

  const endState = await page.evaluate(() => {
    const app = window.__museum;
    const memory = performance.memory;
    const m = window.__runtimeProfileMetrics;
    const resources = performance.getEntriesByType('resource');
    const byInitiator = {};
    for (const entry of resources) byInitiator[entry.initiatorType] = (byInitiator[entry.initiatorType] ?? 0) + 1;
    return {
      pageElapsedMs: Number((performance.now() - m.pageStartMs).toFixed(2)),
      heap: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null,
      rendererMemory: {
        geometries: app.renderer.renderer.info.memory.geometries,
        textures: app.renderer.renderer.info.memory.textures,
      },
      streaming: { ...app.streaming.telemetry },
      quality: {
        effective: { ...app.renderer.quality },
        preference: app.preferences?.quality ?? null,
        governor: app.governor?.snapshot ?? null,
      },
      resources: {
        count: resources.length,
        byInitiator,
        transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        encodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
        decodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
        durationTotalMs: Number(resources.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)),
      },
      meters: { ...m, app: { ...m.app }, gpuQueries: undefined, gpuSamplesMs: undefined },
    };
  });

  const startup = {
    navigationToDOMContentLoadedMs: Number(domLoadedMs.toFixed(2)),
    navigationToAppReadyMs: Number(appReadyMs.toFixed(2)),
    navigationToFirstRenderedFrameMs: Number(firstRenderMs.toFixed(2)),
    pageBootAndProfileElapsedMs: endState.pageElapsedMs,
    standaloneBytes: statSync(htmlPath).size,
    standaloneSha256: createHash('sha256').update(artifact).digest('hex'),
  };
  const meter = endState.meters;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedFrom: `${htmlPath} (file://, browser context offline)`,
    sourceIdentity: { revision: profileSourceRevision, state: profileSourceState },
    browser: { name: 'Chromium', version: await browser.version() },
    methodology: {
      viewport: VIEWPORT,
      framesPerView: FRAMES_PER_VIEW,
      settleMsPerView: 900,
      coordinateConvention: 'view.position is the player foot position; camera eye height is supplied by PlayerController. Yaw 0 faces north (-Z). Each sampled view verifies the expected app.currentZone.',
      views: VIEWS,
      note: 'Draw calls, triangles, programs, geometries and textures are THREE.WebGLRenderer.info counters. frameMs is requestAnimationFrame wall time under the renderer named by capability.renderer; SwiftShader is CPU rasterization, not device FPS.',
      percentileConfidence: FRAMES_PER_VIEW >= 1000
        ? 'Moderate for tail percentiles; still one renderer/browser configuration.'
        : 'Low for 1% and 0.1% tails with this sample count; values are retained as order statistics, not stable device percentiles.',
      instrumentation: 'Per-call WebGL and App callback wrappers collect JavaScript call duration; overhead is included in frameMs. Upload durations are CPU submission-call time, not asynchronous GPU completion.',
      runtimeOverrides: ringTransmissionOverride === null
        ? []
        : [{ target: 'app.sky.bloodRing.material.transmission', original: ringTransmissionOriginal, value: ringTransmissionOverride, purpose: 'controlled material-cost experiment; not part of the shipped artifact' }],
      limitations: [
        'No representative-device performance claim: the render backend is recorded in capability.renderer.',
        'GPU/CPU separation is UNKNOWN when EXT_disjoint_timer_query_webgl2 is absent; do not infer GPU time from frameMs.',
        'File:// standalone resources are bundled in one HTML file, so browser resource timing does not identify each embedded asset transfer/decode.',
        'textureUploadKnownBytes counts only typed-array sources; HTMLImageElement/Canvas/Video source byte sizes are unknown.',
      ],
    },
    startup,
    capability,
    appStartup: {
      timeFromDocumentStartToFirstRenderMs: bootState.pageElapsedMs,
      firstFrameStreaming: bootState.streaming,
      initialQuality: bootState.quality,
    },
    scene: await page.evaluate(() => {
      let objects = 0;
      let meshes = 0;
      const materials = new Set();
      window.__museum?.renderer?.scene?.traverse((node) => {
        objects++;
        if (node.isMesh) {
          meshes++;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (material) materials.add(material);
          }
        }
      });
      return { objects, meshes, materialInstances: materials.size };
    }),
    assetAndShaderWork: {
      shaderCompileCalls: meter.shaderCompileCalls,
      shaderCompileCallMs: Number(meter.shaderCompileCallMs.toFixed(3)),
      programLinkCalls: meter.programLinkCalls,
      programLinkCallMs: Number(meter.programLinkCallMs.toFixed(3)),
      htmlImageDecodeCalls: meter.imageDecodeCalls,
      htmlImageDecodeCallMs: Number(meter.imageDecodeCallMs.toFixed(3)),
      imageBitmapCalls: meter.imageBitmapCalls,
      imageBitmapCallMs: Number(meter.imageBitmapCallMs.toFixed(3)),
      imageSrcSetCalls: meter.imageSrcSetCalls,
      imageLoadEvents: meter.imageLoadEvents,
      imageSrcToLoadMs: Number(meter.imageSrcToLoadMs.toFixed(3)),
      imageLoadErrors: meter.imageLoadErrors,
      imageSourceTimingMeaning: 'HTMLImageElement src assignment to load/error event; includes any request and browser decode, not a decode-only time.',
      textureUploadCalls: meter.textureUploadCalls,
      textureUploadCallMs: Number(meter.textureUploadCallMs.toFixed(3)),
      textureUploadKnownBytes: meter.textureUploadKnownBytes,
      bufferUploadCalls: meter.bufferUploadCalls,
      bufferUploadCallMs: Number(meter.bufferUploadCallMs.toFixed(3)),
      bufferUploadKnownBytes: meter.bufferUploadKnownBytes,
      uploadTimeMeaning: 'CPU-side WebGL method call duration; driver/GPU completion is asynchronous and not measured by this field.',
    },
    resourceTiming: endState.resources,
    memory: {
      start: bootState.heap,
      end: endState.heap,
      endMinusStartUsedJSHeapBytes: bootState.heap && endState.heap
        ? endState.heap.usedJSHeapSize - bootState.heap.usedJSHeapSize
        : null,
      rendererMemoryAtEnd: endState.rendererMemory,
      behaviorNote: 'Heap values are Chromium performance.memory samples and can move with garbage collection. Renderer geometry/texture counts are live Three.js resource counters, not GPU byte allocation.',
    },
    streaming: {
      endOfProfile: endState.streaming,
      qualityAtEnd: endState.quality,
      note: 'Per-view resident/active/pending counts, mounts/unmounts and mounted IDs are captured below after 900 ms of settling.',
    },
    views,
    errors,
  };

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`runtime-profile: wrote ${outFile}`);
  if (errors.length) {
    console.error('runtime-profile: page errors', errors);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
