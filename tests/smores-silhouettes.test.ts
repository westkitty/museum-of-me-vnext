import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { buildCollectibleSilhouette } from '../src/exhibits/games/CollectibleSilhouettes';
import { GalleryPlinthKit } from '../src/world/GalleryPlinth';
import { PaletteSet } from '../src/world/palette';

describe('authored, bounded physical museum forms', () => {
  it('replaces five generic spheres with exactly five resource-owned vertex-colour shapes', () => {
    const scope = new ResourceScope('smores-shapes');
    const sizes = [0.05, 0.09, 0.16, 0.28, 0.48];
    const names = ['bottle-caps', 'garden-gnomes', 'mailboxes', 'parked-cars', 'sheds'];
    const shapes = sizes.map((size, tier) => buildCollectibleSilhouette(scope, tier, size));
    expect(shapes.map((geometry) => geometry.name)).toEqual(
      names.map((name) => 'smores-collectible:' + name),
    );
    for (const [i, geometry] of shapes.entries()) {
      expect(geometry.getAttribute('color')).toBeTruthy();
      expect(geometry.getAttribute('normal')).toBeTruthy();
      expect(geometry.getAttribute('position').count).toBeGreaterThan(80);
      expect(geometry.boundingSphere!.radius).toBeCloseTo(sizes[i], 5);
      expect(geometry.boundingBox).not.toBeNull();
    }
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('reuses four bevelled pedestal geometries across wing themes and bounds them within the original height', () => {
    const scope = new ResourceScope('plinth-contract');
    const palette = new PaletteSet(scope);
    const kit = new GalleryPlinthKit(scope);
    const first = kit.build('E01', palette.get('north'));
    const second = kit.build('E32', palette.get('south'));
    expect(first.children).toHaveLength(4);
    expect(second.children).toHaveLength(4);
    expect(first.children.every((child) => child instanceof THREE.Mesh)).toBe(true);
    expect(first.children[0].name).toBe('plinth-foot:E01');
    expect((first.children[0] as THREE.Mesh).geometry).toBe(
      (second.children[0] as THREE.Mesh).geometry,
    );
    const bounds = new THREE.Box3().setFromObject(first);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeLessThanOrEqual(0.902);
    expect(bounds.max.x).toBeLessThanOrEqual(1.38);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-1.38);
    let lights = 0;
    first.traverse((node) => { if (node instanceof THREE.Light) lights++; });
    expect(lights).toBe(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
