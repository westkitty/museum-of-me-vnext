import { describe, expect, it, vi } from 'vitest';
import type { InteractionManager } from '../src/interaction/InteractionManager';
import { applyInstallationKey, defaultStateFor, describeInstallationState } from '../src/content/installationState';
import { INSTALLATION_PLACEMENT_BY_ID } from '../src/world/installationPlacement';
import { PLACEMENTS } from '../src/world/layout';
import { MEANINGFUL_ACTIONS, MEANING_MAX_DISTANCE, meaningProblem } from '../src/workshop/MeaningfulObjects';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import {
  MEANINGFUL_ACTION_IDS, downgradeWorkshopManifestToV1, validateWorkshopManifest,
  type WorkshopPlacementManifest, type WorkshopPlacementRecord, type WorkshopVec3,
} from '../src/workshop/schema';

const installation = INSTALLATION_PLACEMENT_BY_ID.get('drakken-sandbox')!;
const bay = PLACEMENTS.find((placement) => placement.exhibitId === 'E07')!;
const lever = (position: WorkshopVec3, extra: Partial<WorkshopPlacementRecord> = {}): WorkshopPlacementRecord => ({
  id: 'strain-lever', label: 'Strain lever', prefab: 'sign-post', anchor: 'floor', position, rotation: [0, 0, 0], scale: [1, 1, 1],
  worldId: 'interior', meaning: 'e07-strain-3', ...extra,
});
const manifest = (...objects: WorkshopPlacementRecord[]): WorkshopPlacementManifest => ({ schemaVersion: 2, objects });

/** A real, conservation-valid spot in the E07 bay near its installation. */
const inBay: WorkshopVec3 = (() => {
  const { c, h } = bay.bounds;
  const candidates: WorkshopVec3[] = [];
  for (let x = c[0] - h[0] + 1; x <= c[0] + h[0] - 1; x += 0.5) for (let z = c[2] - h[2] + 1; z <= c[2] + h[2] - 1; z += 0.5) {
    candidates.push([x, installation.position[1], z]);
  }
  const d = (p: WorkshopVec3) => Math.hypot(p[0] - installation.position[0], p[2] - installation.position[2]);
  candidates.sort((a, b) => d(a) - d(b));
  const found = candidates.find((p) => d(p) <= MEANING_MAX_DISTANCE && validateWorkshopManifestForMuseum(manifest(lever(p)), []).ok);
  if (!found) throw new Error('No valid E07 bay position');
  return found;
})();

describe('Meaningful Objects', () => {
  it('binds only to allowlisted actions, each a real control the E07 installation already accepts', () => {
    expect(Object.keys(MEANINGFUL_ACTIONS).sort()).toEqual([...MEANINGFUL_ACTION_IDS].sort());
    for (const action of Object.values(MEANINGFUL_ACTIONS)) {
      expect(action.installation).toBe('drakken-sandbox');
      // From a state where the control has an effect, the exhibit's own reducer changes state.
      const start = { ...defaultStateFor('drakken-sandbox'), strain: 4, step: 2 };
      const result = applyInstallationKey('drakken-sandbox', start, action.code);
      expect(result.changed).toBe(true);
      expect(describeInstallationState('drakken-sandbox', result.state)).not.toBe(describeInstallationState('drakken-sandbox', start));
    }
    const bad = (meaning: unknown) => validateWorkshopManifest(manifest({ ...lever(inBay), meaning } as never)).ok;
    expect(bad('e07-strain-3')).toBe(true);
    for (const value of ['run-script', 'javascript:alert(1)', 'e07-strain-6', '', 7, { code: 'Space' }]) expect(bad(value)).toBe(false);
  });

  it('is meaningful only in the E07 bay near its installation, and conservation enforces that', () => {
    expect(meaningProblem(lever(inBay))).toBeNull();
    expect(validateWorkshopManifestForMuseum(manifest(lever(inBay)), []).ok).toBe(true);
    expect(meaningProblem(lever(inBay, { worldId: 'exterior' }))).toContain('inside the museum');
    const other = PLACEMENTS.find((placement) => placement.exhibitId === 'E01')!;
    expect(meaningProblem(lever([other.anchor[0], other.anchor[1], other.anchor[2]]))).toContain('E07 bay');
    const refused = validateWorkshopManifestForMuseum(manifest(lever([other.anchor[0], other.anchor[1], other.anchor[2]])), []);
    expect(refused.ok).toBe(false);
    expect(refused.errors.join(' ')).toContain('E07 bay');
    // Without a binding, the same object is subject only to the usual rules.
    const { meaning: _unused, ...plain } = lever(inBay);
    expect(meaningProblem(plain)).toBeNull();
  });

  it('refuses schema version 1 and a v1 downgrade rather than silently dropping bindings', () => {
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [lever(inBay)] }).ok).toBe(false);
    expect(downgradeWorkshopManifestToV1(manifest(lever(inBay))).ok).toBe(false);
  });

  it('routes activation through the exhibit control path only, and reports when the exhibit is not loaded', () => {
    const activations = new Map<string, { activate: () => void; label: () => string }>();
    const manager = {
      register: vi.fn((id: string, control: { activate: () => void; label: () => string }) => { activations.set(id, control); return vi.fn(); }),
    } as unknown as InteractionManager;
    const announce = vi.fn();
    const placements = new MuseumPlacements(manifest(lever(inBay), { ...lever(inBay), id: 'plain-sign', meaning: undefined }));
    placements.bindInteractions(manager, announce);
    expect([...activations.keys()]).toEqual(['workshop:strain-lever']);
    expect(activations.get('workshop:strain-lever')!.label()).toBe('Select strain 3: third terraforming strain (Strain lever)');

    // No exhibit loaded yet: nothing is triggered, and the visitor is told.
    activations.get('workshop:strain-lever')!.activate();
    expect(announce).toHaveBeenCalledWith('Strain lever: E07 is not responding here.');

    const trigger = vi.fn((_installation: string, _code: string) => true);
    placements.bindMeaningfulActions(trigger);
    activations.get('workshop:strain-lever')!.activate();
    expect(trigger.mock.calls).toEqual([['drakken-sandbox', 'Digit3']]);
    placements.dispose();
  });
});
