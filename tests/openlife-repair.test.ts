import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { repairOpenLifeGlb, type OpenLifeRepairPlan } from '../scripts/openlife-repair';
import { hasValidLocalGLB } from '../scripts/workshop-save-plugin';
import catalog from '../src/workshop/builderAssets.json';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const plans = JSON.parse(readFileSync('scripts/openlife-repair-plan.json', 'utf8')) as Record<string, OpenLifeRepairPlan>;
type Entry = { id: string; path: string; sha256: string; bytes: number; sourceSha256?: string; sourceBytes?: number; repair?: string };
const models = (catalog as unknown as { models: Entry[] }).models;

describe('repaired OpenLife models', () => {
  it('are exactly what the repair plan makes from the pinned sources', () => {
    let repaired = 0;
    for (const model of models) {
      const label = model.id.replace('openlife:', '');
      const source = new Uint8Array(readFileSync(`assets-source/openlife/${model.path.split('/').pop()}`));
      const served = new Uint8Array(readFileSync(`public/${model.path}`));
      const plan = plans[label];
      expect(sha256(served), model.id).toBe(model.sha256);
      expect(served.byteLength, model.id).toBe(model.bytes);
      expect(hasValidLocalGLB(Buffer.from(served)), model.id).toBe(true);
      if (plan) {
        repaired++;
        expect(model.repair, model.id).toBe('scripts/openlife-repair-plan.json');
        expect(sha256(source), model.id).toBe(model.sourceSha256);
        expect(source.byteLength, model.id).toBe(model.sourceBytes);
        expect(sha256(repairOpenLifeGlb(source, plan).bytes), model.id).toBe(model.sha256);
      } else {
        expect(model.sourceSha256, model.id).toBeUndefined();
        expect(sha256(source), model.id).toBe(model.sha256);
      }
    }
    expect(repaired).toBe(Object.keys(plans).length);
  });

  it('refuses a plan that names a part the model does not have', () => {
    const source = new Uint8Array(readFileSync('assets-source/openlife/dining_chair.glb'));
    expect(() => repairOpenLifeGlb(source, { move: { no_such_part: [0, 0.1, 0] } })).toThrow();
  });
});
