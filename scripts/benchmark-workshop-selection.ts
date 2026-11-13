/** Matched local CPU microbenchmark; not a browser or GPU performance test. */
import { performance } from 'node:perf_hooks';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import type { WorkshopPlacementRecord } from '../src/workshop/schema';

const objects: WorkshopPlacementRecord[] = Array.from({ length: 256 }, (_, i) => ({
  id: `bench-${String(i).padStart(3, '0')}`, label: 'Bench', prefab: 'museum-bench', anchor: 'floor',
  position: [250, 0, 250], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior',
}));
const placements = new MuseumPlacements({ schemaVersion: 1, objects });
const target = 'bench-255';
const rounds = 5, iterations = 500;
function measure(fn: () => unknown): number {
  for (let i = 0; i < 50; i++) fn();
  const values: number[] = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    values.push(performance.now() - start);
  }
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}
try {
  const full = () => placements.captureManifest().objects.find((object) => object.id === target);
  const single = () => placements.getRecord(target);
  if (JSON.stringify(full()) !== JSON.stringify(single())) throw new Error('Lookups differ');
  console.log(JSON.stringify({ records: objects.length, iterations, rounds, metric: 'median milliseconds per 500 calls',
    fullManifest: measure(full), selectedRecord: measure(single), node: process.version }));
} finally { placements.dispose(); }
