import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as THREE from 'three';
import { writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { describe, expect, it, vi } from 'vitest';
import {
  KIT_TEMPLATES, duplicateKit, kitFollowMember, kitLocalTransform, kitOf, kitOverrides, moveKit, placeKit, removeKit, resetKitSlot,
} from '../src/workshop/ExhibitKits';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { WorkshopHistory } from '../src/workshop/history';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import {
  canonicalizeWorkshopManifest, downgradeWorkshopManifestToV1, validateWorkshopManifest, type WorkshopPlacementManifest, type WorkshopVec3,
} from '../src/workshop/schema';
import { builderModelAllowed } from '../src/workshop/builderAssetCatalog';

const empty: WorkshopPlacementManifest = { schemaVersion: 2, objects: [] };
const origin = { position: [250, 0, 250] as WorkshopVec3, rotationY: 0, worldId: 'exterior' as const };
const record = (m: WorkshopPlacementManifest, id: string) => m.objects.find((item) => item.id === id)!;
const close = (a: readonly number[], b: readonly number[], eps = 2e-4) => a.every((v, i) => Math.abs(v - b[i]) <= eps);
/** Saved state is what matters: validate and canonicalize as a reload would. */
const reload = (m: WorkshopPlacementManifest) => {
  const parsed = validateWorkshopManifest(JSON.parse(JSON.stringify(m)));
  expect(parsed.errors).toEqual([]);
  return parsed.value!;
};

describe('Exhibit Kits', () => {
  it('places both example kits from the bundled library as valid, conservation-safe manifests', () => {
    for (const template of Object.values(KIT_TEMPLATES)) {
      for (const slot of template.slots) if (slot.record.assetId) expect(builderModelAllowed(slot.record.assetId)).toBe(true);
      const { manifest, kit } = placeKit(empty, template.id, origin);
      const saved = reload(manifest);
      expect(saved.kits).toEqual([expect.objectContaining({ id: template.id, template: template.id, worldId: 'exterior' })]);
      expect(kit.members.map((member) => member.slot).sort()).toEqual(template.slots.map((slot) => slot.slot).sort());
      expect(validateWorkshopManifestForMuseum(saved, []).errors).toEqual([]);
      expect(kitOverrides(saved, kit.id)).toEqual({ overridden: [], removed: [] });
    }
  });

  it('moves and rotates as a parent, keeping every child transform and overrides', () => {
    let { manifest } = placeKit(empty, 'archive-research-station', origin);
    // Override one child: nudge the chair and turn it.
    manifest = { ...manifest, objects: manifest.objects.map((item) => (item.id === 'archive-research-station-chair'
      ? { ...item, position: [item.position[0] + 0.3, 0, item.position[2]] as WorkshopVec3, rotation: [0, Math.PI * 0.75, 0] as WorkshopVec3 } : item)) };
    const kit = manifest.kits![0];
    const localsBefore = new Map(kit.members.map((member) => [member.slot, kitLocalTransform(kit, record(manifest, member.id))]));
    const moved = reload(moveKit(manifest, kit.id, { position: [270, 0, 240], rotationY: Math.PI / 2 }));
    const movedKit = moved.kits![0];
    expect(movedKit.position).toEqual([270, 0, 240]);
    expect(movedKit.members).toHaveLength(localsBefore.size);
    for (const member of movedKit.members) {
      const local = kitLocalTransform(movedKit, record(moved, member.id));
      expect(close(local.position, localsBefore.get(member.slot)!.position)).toBe(true);
      expect(close(local.scale, localsBefore.get(member.slot)!.scale)).toBe(true);
    }
    // A quarter turn about the origin: the desk stays put, the template's +z chair offset becomes +x.
    expect(close(record(moved, 'archive-research-station-desk').position, [270, 0, 240])).toBe(true);
    expect(close(record(moved, 'archive-research-station-chair').position, [270.75, 0, 239.7])).toBe(true);
    expect(kitOverrides(moved, movedKit.id).overridden).toEqual(['chair']);
  });

  it('moving one part as a kit moves the origin and keeps every part in place relative to it', () => {
    const manifest = reload(placeKit(empty, 'archive-research-station', origin).manifest);
    const chair = record(manifest, 'archive-research-station-chair');
    // The curator drags the chair 2 m along x and turns it a quarter turn.
    const moved = reload(kitFollowMember(manifest, 'archive-research-station', chair.id, {
      position: [chair.position[0] + 2, 0, chair.position[2]], rotation: [0, chair.rotation[1] + Math.PI / 2, 0], scale: chair.scale }));
    const kit = moved.kits![0];
    expect(Math.abs(Math.cos(kit.rotationY) - Math.cos(Math.PI / 2))).toBeLessThan(1e-3);
    expect(close(record(moved, chair.id).position, [chair.position[0] + 2, 0, chair.position[2]], 1e-3)).toBe(true);
    expect(kitOverrides(moved, kit.id)).toEqual({ overridden: [], removed: [] });
  });

  it('resets an overridden or removed child to the template without touching the others', () => {
    let manifest = reload(placeKit(empty, 'observatory-workstation', origin).manifest);
    manifest = { ...manifest, objects: manifest.objects.map((item) => (item.id === 'observatory-workstation-chart-easel'
      ? { ...item, position: [240, 0, 255] as WorkshopVec3 } : item)) };
    const chair = record(manifest, 'observatory-workstation-chair');
    manifest = { ...manifest, objects: manifest.objects.filter((item) => item.id !== 'observatory-workstation-desk'),
      kits: manifest.kits!.map((kit) => ({ ...kit, members: kit.members.filter((member) => member.slot !== 'desk') })) };
    expect(kitOverrides(manifest, 'observatory-workstation')).toEqual({ overridden: ['chart-easel'], removed: ['desk'] });
    manifest = reload(resetKitSlot(resetKitSlot(manifest, 'observatory-workstation', 'chart-easel'), 'observatory-workstation', 'desk'));
    expect(kitOverrides(manifest, 'observatory-workstation')).toEqual({ overridden: [], removed: [] });
    expect(record(manifest, 'observatory-workstation-chair')).toEqual(chair);
  });

  it('duplicates a kit with fresh ids, its overrides and finishes, leaving the original unchanged', () => {
    let { manifest } = placeKit(empty, 'archive-research-station', origin);
    manifest = { ...manifest, objects: manifest.objects.map((item) => (item.id === 'archive-research-station-document-table'
      ? { ...item, color: '#aa3300', position: [252.2, 0, 250.2] as WorkshopVec3 } : item)) };
    const before = canonicalizeWorkshopManifest(manifest);
    const { manifest: copied, kit } = duplicateKit(manifest, 'archive-research-station', { position: [260, 0, 250], rotationY: 0 });
    const saved = reload(copied);
    expect(kit.id).toBe('archive-research-station-copy');
    expect(saved.objects).toHaveLength(before.objects.length * 2);
    for (const original of before.objects) expect(record(saved, original.id)).toEqual(original);
    const table = record(saved, 'archive-research-station-copy-document-table');
    expect(table.color).toBe('#aa3300');
    expect(close(table.position, [262.2, 0, 250.2])).toBe(true);
    expect(kitOverrides(saved, kit.id).overridden).toEqual(['document-table']);
    expect(kitOf(saved, table.id)?.id).toBe(kit.id);
  });

  it('persists through the real local save path and reloads with grouping and overrides intact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-kits-'));
    const target = join(directory, 'workshop-placements.json');
    try {
      await writeFile(target, '{"schemaVersion":1,"objects":[]}\n');
      let { manifest } = placeKit(empty, 'observatory-workstation', origin);
      manifest = { ...manifest, objects: manifest.objects.map((item) => (item.id === 'observatory-workstation-chart-easel'
        ? { ...item, position: [247, 0, 251] as WorkshopVec3 } : item)) };
      const saved = await writeWorkshopManifest(manifest, target);
      expect(saved.errors ?? []).toEqual([]);
      const reloaded = validateWorkshopManifest(JSON.parse(await readFile(target, 'utf8')));
      expect(reloaded.value?.kits).toEqual(canonicalizeWorkshopManifest(manifest).kits);
      const placements = new MuseumPlacements(reloaded.value, null, async () => new THREE.Group());
      expect(kitOverrides(placements.captureManifest(), 'observatory-workstation').overridden).toEqual(['chart-easel']);
      placements.dispose();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects invalid kits instead of discarding grouping, and refuses a v1 downgrade', () => {
    const { manifest } = placeKit(empty, 'archive-research-station', origin);
    const kit = manifest.kits![0];
    const bad = (kits: unknown) => validateWorkshopManifest({ ...manifest, kits }).ok;
    expect(bad([{ ...kit, members: [...kit.members, { slot: 'extra', id: 'missing' }] }])).toBe(false);
    expect(bad([kit, { ...kit, id: 'second', members: [kit.members[0]] }])).toBe(false);
    expect(bad([{ ...kit, id: kit.members[0].id }])).toBe(false);
    expect(bad([{ ...kit, template: 'unknown-kit' }])).toBe(false);
    expect(bad([{ ...kit, worldId: 'interior' }])).toBe(false);
    expect(bad([{ ...kit, script: 'x' }])).toBe(false);
    expect(validateWorkshopManifest({ ...manifest, schemaVersion: 1 }).ok).toBe(false);
    expect(downgradeWorkshopManifestToV1(manifest).ok).toBe(false);
    expect(downgradeWorkshopManifestToV1(removeKit(manifest, kit.id, { keepMembers: true })).ok).toBe(true);
  });

  it('lives in the runtime as ordinary placements: undo, residency, ungroup and cleanup', async () => {
    const geometry = new THREE.BoxGeometry();
    const dispose = vi.spyOn(geometry, 'dispose');
    const loader = vi.fn(async () => { const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())); return root; });
    const placements = new MuseumPlacements(empty, null, loader);
    const history = new WorkshopHistory();
    const before = placements.captureManifest();
    const placed = placements.replaceManifest(placeKit(before, 'observatory-workstation', origin).manifest);
    history.push('Place kit', before, placed);
    await new Promise<void>((done) => setTimeout(done, 0));
    expect(placements.objectCount).toBe(5);
    expect(placements.residentCount).toBe(5);
    expect(placements.captureManifest().kits).toHaveLength(1);

    // Removing one member through the normal path also drops its kit membership.
    const beforeRemove = placements.captureManifest();
    history.push('Remove computer', beforeRemove, placements.removeRecord('observatory-workstation-computer'));
    expect(kitOverrides(placements.captureManifest(), 'observatory-workstation').removed).toEqual(['computer']);
    expect(validateWorkshopManifest(placements.captureManifest()).ok).toBe(true);

    // Delete the kit: every member is released; shared model resources are disposed once nothing uses them.
    const beforeDelete = placements.captureManifest();
    history.push('Delete kit', beforeDelete, placements.replaceManifest(removeKit(beforeDelete, 'observatory-workstation')));
    expect(placements.objectCount).toBe(0);
    expect(placements.residentCount).toBe(0);
    expect(dispose).toHaveBeenCalled();

    // Undo restores the kit step by step.
    placements.replaceManifest(history.undo()!.manifest);
    expect(placements.captureManifest().kits?.[0].members).toHaveLength(4);
    expect(placements.objectCount).toBe(4);
    placements.replaceManifest(history.undo()!.manifest);
    expect(placements.captureManifest().kits?.[0].members).toHaveLength(5);
    expect(placements.objectCount).toBe(5);
    placements.dispose();
  });
});
