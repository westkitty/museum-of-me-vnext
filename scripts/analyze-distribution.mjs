#!/usr/bin/env node
// Diagnostic only (not a gate; scripts/check-budgets.mjs is the budget and is
// unchanged). Classifies every emitted file of a build so size discussions use
// one vocabulary:
//
//   emitted      every file the build writes (what check-budgets.mjs counts,
//                minus its deferred iframe artifact)
//   entry JS     index.html's scripts plus their static-import closure: parsed
//                and executed before the first frame
//   lazy JS      every other JS chunk: fetched only when code asks (interior,
//                workshop, pocket worlds, ...)
//   world        pocket-world chunks and W01 stems (rehearsal builds only)
//   media        images, audio, models, video, fonts
//
// Each class is reported uncompressed, gzip -9 and brotli q11 (a transfer
// estimate; the host's real encoding decides the wire size).
//
//   node scripts/analyze-distribution.mjs [dist] [--json out.json] [--compare other-dist]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const jsonOut = flag('--json');
const compareDir = flag('--compare');
const root = args[0] ?? 'dist';

const DEFERRED = ['embedded/full-weasel/'];
const WORLD = /(^|\/)(create(W\d\d|L01)World|w01-(bass|drums|other))-[^/]+\.(js|m4a)$/;
const MEDIA = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.ktx2', '.glb', '.gltf', '.bin', '.ogg', '.mp3', '.m4a', '.opus', '.wav', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.otf']);
const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.json', '.svg', '.txt', '.webmanifest', '.wasm', '.gltf', '.bin']);

function files(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(p)); else out.push(p);
  }
  return out;
}

function entryClosure(dir, all) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const queue = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)]
    .map((m) => join(dir, m[1].replace(/^\.?\//, '')));
  const seen = new Set();
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !all.includes(f)) continue;
    seen.add(f);
    const src = readFileSync(f, 'utf8');
    // Static imports only: `import x from "./a.js"`, `import "./a.js"`, `export * from "./a.js"`.
    for (const m of src.matchAll(/(?:^|[;}\n])\s*(?:import|export)\s*(?:[\w$*{},\s]+?\s*from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      queue.push(join(dirname(f), m[1]));
    }
  }
  return seen;
}

function analyze(dir) {
  const all = files(dir).filter((f) => !f.endsWith('.map'));
  const entry = entryClosure(dir, all);
  const classes = {};
  const rows = [];
  for (const f of all) {
    const rel = relative(dir, f).split('\\').join('/');
    const ext = extname(f).toLowerCase();
    const deferred = DEFERRED.some((d) => rel.startsWith(d));
    const cls = deferred ? 'deferred iframe' : WORLD.test(rel) ? 'world'
      : ext === '.js' ? (entry.has(f) ? 'entry JS' : 'lazy JS')
        : MEDIA.has(ext) ? 'media' : ext === '.css' || ext === '.html' ? 'shell' : 'other';
    const buf = readFileSync(f);
    const raw = statSync(f).size;
    const gz = COMPRESSIBLE.has(ext) ? gzipSync(buf, { level: 9 }).length : raw;
    const br = COMPRESSIBLE.has(ext) ? brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length : raw;
    rows.push({ file: rel, cls, raw, gz, br });
    const c = (classes[cls] ??= { files: 0, raw: 0, gz: 0, br: 0 });
    c.files++; c.raw += raw; c.gz += gz; c.br += br;
  }
  const countedByChecker = rows.filter((r) => r.cls !== 'deferred iframe').reduce((a, r) => a + r.raw, 0);
  return { dir, classes, countedByChecker, rows: rows.sort((a, b) => b.raw - a.raw) };
}

const mb = (n) => (n / 1048576).toFixed(2);
function print(result) {
  console.log(`\n${result.dir}: counted by check-budgets.mjs ${mb(result.countedByChecker)} MB (budget 20 MB)`);
  console.log('class            files    raw MB   gzip MB  brotli MB');
  for (const [cls, c] of Object.entries(result.classes).sort((a, b) => b[1].raw - a[1].raw)) {
    console.log(`${cls.padEnd(16)} ${String(c.files).padStart(5)} ${mb(c.raw).padStart(9)} ${mb(c.gz).padStart(9)} ${mb(c.br).padStart(10)}`);
  }
  console.log('largest files:');
  for (const r of result.rows.slice(0, 15)) console.log(`  ${mb(r.raw).padStart(6)} MB  ${r.cls.padEnd(15)} ${r.file}`);
}

const main = analyze(root);
print(main);
let compare;
if (compareDir) {
  compare = analyze(compareDir);
  print(compare);
  const names = (r) => new Map(r.rows.map((row) => [row.file.replace(/-[\w-]{8}(\.\w+)$/, '$1'), row]));
  const a = names(main); const b = names(compare);
  const onlyB = [...b.entries()].filter(([k]) => !a.has(k)).map(([, row]) => row);
  console.log(`\nonly in ${compareDir}: ${onlyB.length} files, ${mb(onlyB.reduce((s, r) => s + r.raw, 0))} MB raw`);
  for (const r of onlyB.sort((x, y) => y.raw - x.raw).slice(0, 20)) console.log(`  ${mb(r.raw).padStart(6)} MB  ${r.cls.padEnd(15)} ${r.file}`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ main: { ...main, rows: main.rows }, compare }, null, 2));
