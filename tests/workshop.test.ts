import placementManifest from '../data/workshop-placements.json';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { INSTALLATION_PLACEMENTS } from '../src/world/installationPlacement';
import { PLACEMENT_BY_EXHIBIT, SANCTUARY_DIR, SANCTUARY_RAMP_FROM, place } from '../src/world/layout';
import { writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { validateWorkshopManifestForMuseum, validateWorkshopConservation } from '../src/workshop/conservation';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { WorkshopHistory } from '../src/workshop/history';
import { AuthorableSceneRegistry } from '../src/workshop/AuthorableSceneRegistry';
import { CollisionWorld } from '../src/world/CollisionWorld';
import {
  EMPTY_WORKSHOP_MANIFEST,
  serializeWorkshopManifest,
  validateWorkshopManifest,
  type WorkshopPlacementManifest,
} from '../src/workshop/schema';

const sample: WorkshopPlacementManifest = {
  schemaVersion: 1,
  objects: [
    {
      id: 'bench-01',
      label: 'Bench 01',
      prefab: 'museum-bench',
      anchor: 'floor',
      position: [30.234567, 0, 42],
      rotation: [0, 0.5, 0],
      scale: [1, 1, 1],
    },
  ],
};

describe('Museum Workshop schema', () => {
  it('keeps the checked-in build placement manifest valid', () => {
    expect(validateWorkshopManifest(placementManifest).ok).toBe(true);
  });

  it('accepts the empty canonical manifest', () => {
    const result = validateWorkshopManifest(EMPTY_WORKSHOP_MANIFEST);
    expect(result.ok).toBe(true);
    expect(result.value?.objects).toHaveLength(0);
  });

  it('rejects fields that this schema would otherwise silently discard', () => {
    const cases = [
      { schemaVersion: 1, objects: [], future: true },
      { schemaVersion: 1, objects: [{ ...sample.objects[0], future: true }] },
      { schemaVersion: 1, objects: [], sceneOverrides: [{ id: 'item', position: [1, 2, 3],
        rotation: [0, 0, 0], scale: [1, 1, 1], future: true }] },
      { schemaVersion: 1, objects: [], surfaceOverrides: [{ id: 'exterior:0', worldId: 'exterior',
        color: '#ffffff', future: true }] },
    ];
    for (const input of cases) {
      const result = validateWorkshopManifest(input);
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/unsupported field.*future/);
    }
  });

  it('rejects duplicate ids, unsupported prefabs and invalid scales', () => {
    const result = validateWorkshopManifest({
      schemaVersion: 1,
      objects: [
        sample.objects[0],
        { ...sample.objects[0], prefab: 'not-real' },
        { ...sample.objects[0], id: 'tiny', scale: [0, 1, 1] },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/duplicate|prefab|scale/i);
  });

  it('serializes deterministically and rounds transform noise', () => {
    const text = serializeWorkshopManifest({
      schemaVersion: 1,
      objects: [
        { ...sample.objects[0], id: 'z-last' },
        { ...sample.objects[0], id: 'a-first', position: [1.234567, -0, 3] },
      ],
    });
    expect(text.indexOf('a-first')).toBeLessThan(text.indexOf('z-last'));
    expect(text).toContain('1.2346');
    expect(text).not.toContain('-0');
  });
});

describe('Museum Workshop conservation', () => {
  const at = (position: readonly [number, number, number]): WorkshopPlacementManifest => ({
    schemaVersion: 1,
    objects: [{ ...sample.objects[0]!, position: [...position] as [number, number, number] }],
  });

  it('accepts an ordinary safe placement outside authoritative paths', () => {
    const result = validateWorkshopManifestForMuseum(at([30, 0, 42]));
    expect(result.ok).toBe(true);
  });

  it('accepts the browser journey safe placement after its position edit', () => {
    const result = validateWorkshopManifestForMuseum(at([12.5, 0, 134]));
    expect(result.ok).toBe(true);
  });

  it('constructs the two-object browser-authored manifest', () => {
    const first = { ...sample.objects[0]!, id: 'display-plinth-01', prefab: 'display-plinth' as const, label: 'Display plinth', position: [12.5, 0, 134] as [number, number, number] };
    const second = { ...first, id: 'display-plinth-02', label: 'Display plinth copy', position: [13.3, 0, 134.8] as [number, number, number] };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [first, second] });
    expect(placements.objectCount).toBe(2);
    placements.dispose();
  });

  it('rejects the protected Rotunda circulation and names the rule', () => {
    const result = validateWorkshopConservation(at([10, 0, 0]));
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      placementId: 'bench-01',
      placementLabel: 'Bench 01',
      protectedArea: 'Rotunda circulation floor',
      rule: 'rotunda-circulation',
    });
  });

  it('rejects the Dexter Sanctuary access geometry', () => {
    const point = place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 10, 0, 0);
    const result = validateWorkshopConservation(at(point));
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('sanctuary-access');
  });

  it('rejects an exhibit interaction/read zone from authoritative placement data', () => {
    const spot = PLACEMENT_BY_EXHIBIT.get('E24')!.visitorSpot;
    const result = validateWorkshopConservation(at(spot));
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('exhibit-read-zone:E24');
  });

  it('rejects a source installation interaction/read zone from authoritative placement data', () => {
    const spot = INSTALLATION_PLACEMENTS[0]!.interactionPoint;
    const result = validateWorkshopConservation(at(spot));
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toMatch(/^source-installation-/);
  });

  it('rejects a manually corrupted source before constructing runtime objects', () => {
    const raw = at([10, 0, 0]);
    expect(validateWorkshopManifestForMuseum(raw).ok).toBe(false);
    expect(() => new MuseumPlacements(raw)).toThrow(/Rotunda circulation floor/);
  });

  it('rejects invalid saves without changing the target bytes and accepts a valid save', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-'));
    const target = join(directory, 'workshop-placements.json');
    const original = '{"schemaVersion":1,"objects":[]}\n';
    try {
      await writeFile(target, original, 'utf8');
      const rejected = await writeWorkshopManifest(at([10, 0, 0]), target);
      expect(rejected.ok).toBe(false);
      expect(rejected.violations?.[0]).toMatchObject({
        placementId: 'bench-01',
        protectedArea: 'Rotunda circulation floor',
        rule: 'rotunda-circulation',
      });
      expect(await readFile(target, 'utf8')).toBe(original);

      const rejectedScene = await writeWorkshopManifest({
        schemaVersion: 1,
        objects: [],
        sceneOverrides: [{ id: 'rotunda-information-counter', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
      }, target);
      expect(rejectedScene.ok).toBe(false);
      expect(rejectedScene.violations?.[0]?.placementId).toBe('rotunda-information-counter');
      expect(await readFile(target, 'utf8')).toBe(original);

      const accepted = await writeWorkshopManifest(at([30, 0, 42]), target);
      expect(accepted.ok).toBe(true);
      expect(await readFile(target, 'utf8')).toBe(serializeWorkshopManifest(at([30, 0, 42])));
      const hash = createHash('sha256').update(original).digest('hex');
      expect(await readFile(join(directory, '.workshop-backups', `${hash}.json`), 'utf8')).toBe(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('preserves each prior version for concurrent saves and refuses a corrupt backup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-backup-'));
    const target = join(directory, 'workshop-placements.json');
    const original = '{"schemaVersion":1,"objects":[]}\n';
    try {
      await writeFile(target, original);
      const first = at([30, 0, 42]);
      const second = at([31, 0, 42]);
      const results = await Promise.all([writeWorkshopManifest(first, target), writeWorkshopManifest(second, target)]);
      expect(results.every((result) => result.ok)).toBe(true);
      const backupDir = join(directory, '.workshop-backups');
      const backups = await Promise.all((await readdir(backupDir)).map((name) => readFile(join(backupDir, name), 'utf8')));
      expect(backups).toContain(original);
      expect(backups).toContain(serializeWorkshopManifest(first));
      expect(await readFile(target, 'utf8')).toBe(serializeWorkshopManifest(second));

      const bytes = await readFile(target);
      const hash = createHash('sha256').update(bytes).digest('hex');
      await writeFile(join(backupDir, `${hash}.json`), 'corrupt');
      await expect(writeWorkshopManifest(first, target)).rejects.toThrow(/backup does not match/);
      expect(await readFile(target)).toEqual(bytes);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('leaves the original untouched if the backup directory cannot be used', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-backup-fail-'));
    const target = join(directory, 'workshop-placements.json');
    const original = '{"schemaVersion":1,"objects":[]}\n';
    try {
      await writeFile(target, original);
      await mkdir(join(directory, '.workshop-backups'));
      await rm(join(directory, '.workshop-backups'), { recursive: true });
      await writeFile(join(directory, '.workshop-backups'), 'not a directory');
      await expect(writeWorkshopManifest(at([30, 0, 42]), target)).rejects.toThrow();
      expect(await readFile(target, 'utf8')).toBe(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('refuses to overwrite a corrupt or newer on-disk save', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-unknown-'));
    const target = join(directory, 'workshop-placements.json');
    try {
      for (const existing of ['{broken', '{"schemaVersion":2,"objects":[]}',
        '{"schemaVersion":1,"objects":[],"futureDecision":"preserve"}']) {
        await writeFile(target, existing);
        const result = await writeWorkshopManifest(at([30, 0, 42]), target);
        expect(result.status).toBe(409);
        expect(await readFile(target, 'utf8')).toBe(existing);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('accepts one editor revision and refuses a second stale save', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-revision-'));
    const target = join(directory, 'workshop-placements.json');
    try {
      const baseline = '{"schemaVersion":1,"objects":[]}\n';
      await writeFile(target, baseline);
      const revision = createHash('sha256').update(baseline).digest('hex');
      const first = at([30, 0, 42]);
      const second = at([31, 0, 42]);
      const [accepted, rejected] = await Promise.all([
        writeWorkshopManifest(first, target, revision), writeWorkshopManifest(second, target, revision),
      ]);
      expect(accepted.ok).toBe(true);
      expect(rejected.status).toBe(409);
      expect(rejected.errors?.join(' ')).toMatch(/changed since/);
      expect(await readFile(target, 'utf8')).toBe(serializeWorkshopManifest(first));
      expect(accepted.revision).toBe(createHash('sha256').update(await readFile(target)).digest('hex'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects byte changes even when schema normalization would round them equally', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-byte-revision-'));
    const target = join(directory, 'workshop-placements.json');
    try {
      const first = JSON.stringify(at([30.00001, 0, 42]));
      const changed = JSON.stringify(at([30.00002, 0, 42]));
      await writeFile(target, changed);
      const revision = createHash('sha256').update(first).digest('hex');
      const result = await writeWorkshopManifest(at([30, 0, 42]), target, revision);
      expect(result.status).toBe(409);
      expect(await readFile(target, 'utf8')).toBe(changed);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});

describe('MuseumPlacements', () => {
  it('builds authorable roots and captures transformed values', () => {
    const placements = new MuseumPlacements(sample);
    expect(placements.objectCount).toBe(1);
    const object = placements.getObject('bench-01');
    expect(object).not.toBeNull();
    object!.position.x = 9.5;
    const captured = placements.captureManifest();
    expect(captured.objects[0]?.position[0]).toBe(9.5);
    expect(placements.getRecord('bench-01')).toEqual(captured.objects[0]);
    const detached = placements.getRecord('bench-01')!;
    detached.position[0] = 123;
    expect(placements.getRecord('bench-01')?.position[0]).toBe(9.5);
    expect(placements.getRecord('missing')).toBeNull();
    placements.dispose();
  });

  it('replaces, removes and releases placement objects deterministically', () => {
    const placements = new MuseumPlacements(sample);
    placements.removeRecord('bench-01');
    expect(placements.objectCount).toBe(0);
    expect(placements.getRecord('bench-01')).toBeNull();
    placements.replaceManifest(sample);
    expect(placements.objectCount).toBe(1);
    expect(placements.getRecord('bench-01')).toEqual(placements.captureManifest().objects[0]);
    placements.dispose();
  });

  it('preserves authored roots when only surface or registered scene overrides change', () => {
    const shrub = new THREE.Group();
    shrub.position.set(30, 0, 42);
    const registry = new AuthorableSceneRegistry([{ id: 'arrival-garden-shrub-01', root: shrub }]);
    const placements = new MuseumPlacements(sample, registry);
    const original = placements.getObject('bench-01');
    const exteriorRoot = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: '#445566' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    exteriorRoot.add(mesh);
    placements.syncWorld('exterior', new CollisionWorld(), undefined, exteriorRoot);
    placements.setSurfaceOverride({ id: 'exterior:0', worldId: 'exterior', color: '#abcdef' });
    expect(placements.getObject('bench-01')).toBe(original);
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('abcdef');
    placements.setSceneOverride('arrival-garden-shrub-01', { position: [31, 0, 42], rotation: [0, 0, 0], scale: [1, 1, 1] });
    expect(placements.getObject('bench-01')).toBe(original);
    expect(shrub.position.x).toBe(31);
    placements.removeSurfaceOverride('exterior:0');
    expect(mesh.material).toBe(material);
    expect(placements.getObject('bench-01')).toBe(original);
    placements.dispose();
    mesh.geometry.dispose(); material.dispose();
  });

  it('restores live gizmo changes and preserves roots across transform-only edits', () => {
    const solid: WorkshopPlacementManifest = { schemaVersion: 1, objects: [{ ...sample.objects[0],
      position: [30, 0, 42], collision: 'solid', worldId: 'exterior' }] };
    const placements = new MuseumPlacements(solid);
    const world = new CollisionWorld();
    placements.syncWorld('exterior', world);
    const root = placements.getObject('bench-01')!;
    root.position.x = 40; // unsaved gizmo motion: the stored manifest is still at 30
    placements.replaceManifest(solid);
    expect(placements.getObject('bench-01')).toBe(root);
    expect(root.position.x).toBe(30);
    placements.syncWorld('exterior', world);
    expect(world.resolveHorizontal({ x: 30, y: 0, z: 42 }, 0.2, 1.7)).toBe(true);
    const moved: WorkshopPlacementManifest = { ...solid, objects: [{ ...solid.objects[0], position: [40, 0, 42] }] };
    placements.replaceManifest(moved);
    expect(placements.getObject('bench-01')).toBe(root);
    placements.syncWorld('exterior', world);
    expect(world.resolveHorizontal({ x: 30, y: 0, z: 42 }, 0.2, 1.7)).toBe(false);
    expect(world.resolveHorizontal({ x: 40, y: 0, z: 42 }, 0.2, 1.7)).toBe(true);
    placements.dispose();
  });

  it('applies existing-scene overrides through the explicit registry', () => {
    const root = new THREE.Group();
    const registry = new AuthorableSceneRegistry([{ id: 'arrival-garden-shrub-01', root }]);
    const placements = new MuseumPlacements({
      schemaVersion: 1,
      objects: [],
      sceneOverrides: [{ id: 'arrival-garden-shrub-01', position: [30, 0, 42], rotation: [0, 0.2, 0], scale: [1, 1, 1] }],
    }, registry);
    expect(root.position.toArray()).toEqual([30, 0, 42]);
    expect(placements.captureManifest().sceneOverrides?.[0]?.rotation[1]).toBe(0.2);
    root.position.x = 31;
    expect(placements.captureManifest().sceneOverrides?.[0]?.position[0]).toBe(31);
    placements.setRecord(sample.objects[0]!);
    expect(placements.captureManifest().sceneOverrides?.[0]?.position[0]).toBe(31);
    placements.dispose();
  });

  it('rejects an existing-scene override that enters protected circulation', () => {
    const result = validateWorkshopManifestForMuseum({
      schemaVersion: 1,
      objects: [],
      sceneOverrides: [{ id: 'rotunda-information-counter', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('rotunda-information-counter');
    expect(result.errors[0]).toContain('Rotunda flight-pad operating area');
  });
});

describe('WorkshopHistory', () => {
  it('treats one edit as one undo/redo command', () => {
    const history = new WorkshopHistory();
    const after: WorkshopPlacementManifest = {
      schemaVersion: 1,
      objects: [{ ...sample.objects[0], position: [5, 0, 0] }],
    };
    expect(history.push('Move Bench 01', sample, after)).toBe(true);
    expect(history.undo()?.manifest.objects[0]?.position[0]).toBeCloseTo(30.2346);
    expect(history.redo()?.manifest.objects[0]?.position[0]).toBe(5);
  });

  it('shares unchanged records across a large edit history and preserves undo isolation', () => {
    const history = new WorkshopHistory();
    const initial: WorkshopPlacementManifest = { schemaVersion: 1, objects: Array.from({ length: 2000 }, (_, i) => ({
      ...sample.objects[0]!, id: `bench-${String(i).padStart(4, '0')}`, position: [30, 0, 42] as [number, number, number],
    })), sceneOverrides: [{ id: 'arrival-garden-shrub-01', position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] }],
    surfaceOverrides: [{ id: 'exterior:0', worldId: 'exterior', color: '#123456' }] };
    let current = initial;
    for (let i = 1; i <= 20; i++) {
      const next: WorkshopPlacementManifest = { ...current, objects: current.objects.map((record, index) =>
        index === 0 ? { ...record, position: [30 + i, 0, 42] } : record) };
      expect(history.push(`move ${i}`, current, next)).toBe(true);
      current = next;
    }
    expect(history.retainedRecordCount).toBe(2022);
    let undone: WorkshopPlacementManifest | undefined;
    for (let i = 0; i < 20; i++) undone = history.undo()?.manifest;
    expect(undone?.objects[0].position[0]).toBe(30);
    expect(undone?.surfaceOverrides?.[0].color).toBe('#123456');
    (undone!.objects[1].position as number[])[0] = 99;
    let redone: WorkshopPlacementManifest | undefined;
    for (let i = 0; i < 20; i++) redone = history.redo()?.manifest;
    expect(redone?.objects[0].position[0]).toBe(50);
    expect(redone?.objects[1].position[0]).toBe(30);
    history.clear();
    expect(history.retainedRecordCount).toBe(0);
  });

  it('preserves atomic changes and clears redo when editing after undo', () => {
    const history = new WorkshopHistory();
    const added: WorkshopPlacementManifest = { ...sample, objects: [sample.objects[0],
      { ...sample.objects[0], id: 'bench-02' }], surfaceOverrides: [{ id: 'exterior:0', worldId: 'exterior', color: '#abcdef' }] };
    history.push('add group and finish', sample, added);
    expect(history.undo()?.manifest.objects).toHaveLength(1);
    const alternative: WorkshopPlacementManifest = { ...sample, objects: [{ ...sample.objects[0], label: 'Alternate' }] };
    history.push('alternate', sample, alternative);
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.manifest.objects[0].label).toBe('Bench 01');
    expect(history.redo()?.manifest.objects[0].label).toBe('Alternate');
  });
});
