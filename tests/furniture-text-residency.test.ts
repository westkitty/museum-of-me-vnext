import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import {
  buildLectern,
  buildPlaque,
  highResolutionFurnitureTextCount,
  setFurnitureTextResolution,
} from '../src/exhibits/Furniture';
import { EXHIBITS_BY_ID, PROJECTS_BY_ID } from '../src/content/collection.generated';

class FakeCanvasContext {
  fillStyle = '';
  font = '';
  textAlign = 'left';
  textBaseline = 'top';
  fillRect(): void {}
  fillText(): void {}
  measureText(text: string): TextMetrics {
    return { width: text.length * 10 } as TextMetrics;
  }
}

interface FakeCanvas {
  width: number;
  height: number;
  getContext(type: string): FakeCanvasContext | null;
}

describe('interpretation furniture text residency', () => {
  const canvases: FakeCanvas[] = [];

  beforeEach(() => {
    canvases.length = 0;
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`unexpected element: ${tag}`);
        const context = new FakeCanvasContext();
        const canvas: FakeCanvas = {
          width: 0,
          height: 0,
          getContext: (type: string) => type === '2d' ? context : null,
        };
        canvases.push(canvas);
        return canvas;
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps previews resident until activation and releases full textures after deactivation', () => {
    const scope = new ResourceScope('furniture-residency');
    const record = EXHIBITS_BY_ID.get('E01')!;
    const projects = record.projectIds.map((id) => PROJECTS_BY_ID.get(id)!).filter(Boolean);
    const root = new THREE.Group();
    root.add(buildPlaque(scope, record), buildLectern(scope, record, projects));

    expect(canvases.map(({ width, height }) => [width, height])).toEqual([
      [512, 256],
      [512, 370],
    ]);
    expect(highResolutionFurnitureTextCount(root)).toBe(0);

    const materials: THREE.MeshStandardMaterial[] = [];
    root.traverse((node) => {
      const material = (node as THREE.Mesh).material;
      if (material instanceof THREE.MeshStandardMaterial && material.map) materials.push(material);
    });
    const previews = materials.map((material) => material.map);
    const versions = materials.map((material) => material.version);

    setFurnitureTextResolution(root, true);
    expect(canvases.slice(2).map(({ width, height }) => [width, height])).toEqual([
      [1024, 512],
      [1024, 740],
    ]);
    expect(highResolutionFurnitureTextCount(root)).toBe(2);
    expect(materials.map((material) => material.version)).toEqual(versions);
    expect(materials.every((material, index) => material.map !== previews[index])).toBe(true);

    setFurnitureTextResolution(root, false);
    expect(highResolutionFurnitureTextCount(root)).toBe(0);
    expect(materials.map((material) => material.map)).toEqual(previews);
    expect(materials.map((material) => material.version)).toEqual(versions);

    scope.releaseAll();
    expect(scope.size).toBe(0);
  });
});
