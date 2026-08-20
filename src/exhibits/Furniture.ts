import * as THREE from 'three';
import { createTextTexture, createFallbackTexture, canRenderText } from '../assets/TextTexture';
import type { ResourceScope } from '../assets/ResourceScope';
import type { ExhibitRecord, ProjectRecord } from '../content/types';

/**
 * Interpretation furniture, shared by every exhibit in the museum.
 *
 * Plan §9 defines three layers. Layers 1 and 2 are physical objects in the room
 * — a wall plaque and a reading lectern — and layer 3 lives in the DOM. These
 * builders are the permanent implementation of layers 1 and 2, not scaffolding.
 */

function textMaterial(scope: ResourceScope, paragraphs: readonly string[], opts: Parameters<typeof createTextTexture>[2]): THREE.MeshStandardMaterial {
  const map = canRenderText()
    ? createTextTexture(scope, paragraphs, opts)
    : createFallbackTexture(scope);
  return scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 }));
}

/**
 * The ten-second plaque. Mounted on the bay's back wall at reading height.
 * Returns the group so the caller can position it.
 */
export function buildPlaque(scope: ResourceScope, record: ExhibitRecord): THREE.Group {
  const group = new THREE.Group();
  group.name = `plaque:${record.id}`;

  const frame = new THREE.Mesh(
    scope.track(new THREE.BoxGeometry(2.5, 1.3, 0.09)),
    scope.track(new THREE.MeshStandardMaterial({ color: 0x2a2419, roughness: 0.5, metalness: 0.35 })),
  );
  group.add(frame);

  const face = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(2.34, 1.16)),
    textMaterial(scope, [record.copy.plaque], {
      width: 1024,
      height: 512,
      title: record.title,
      titleSize: 54,
      bodySize: 34,
      align: 'center',
      padding: 46,
    }),
  );
  face.position.z = 0.05;
  group.add(face);

  return group;
}

/**
 * The one-minute lectern. A tilted reading surface carrying the problem, what
 * was made, and the projects represented.
 */
export function buildLectern(
  scope: ResourceScope,
  record: ExhibitRecord,
  projects: readonly ProjectRecord[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = `lectern:${record.id}`;

  const stoneMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3b342a, roughness: 0.8 }));

  const column = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.9, 1.02, 0.5)), stoneMat);
  column.position.y = 0.51;
  group.add(column);

  const base = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.1, 0.1, 0.7)), stoneMat);
  base.position.y = 0.05;
  group.add(base);

  const represented =
    projects.length === 1
      ? `Represents ${projects[0].name}.`
      : `Represents ${projects.length} projects: ${projects.map((p) => p.name).join(', ')}.`;

  const surface = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(0.92, 0.66)),
    textMaterial(scope, [record.copy.problem, record.copy.made, represented], {
      width: 1024,
      height: 740,
      title: record.copy.subtitle,
      titleSize: 44,
      bodySize: 29,
      padding: 52,
    }),
  );
  surface.position.set(0, 1.08, 0.06);
  surface.rotation.x = -Math.PI / 3.4;
  group.add(surface);

  const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.0, 0.06, 0.72)), stoneMat);
  top.position.y = 1.03;
  top.rotation.x = -Math.PI / 3.4;
  group.add(top);

  return group;
}

/**
 * A small label for a control or sub-element inside an exhibit. Used wherever a
 * visitor needs to know what a thing is without opening a panel.
 */
export function buildLabel(scope: ResourceScope, text: string, width = 0.9): THREE.Mesh {
  const height = width * 0.32;
  return new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(width, height)),
    textMaterial(scope, [], {
      width: 512,
      height: 164,
      title: text,
      titleSize: 56,
      align: 'center',
      rule: false,
      padding: 24,
      background: '#1a1712',
      titleColor: '#e8d9b0',
    }),
  );
}

/** Wing signage over a hall threshold. */
export function buildWingSign(scope: ResourceScope, name: string, subtitle: string): THREE.Mesh {
  return new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(5.4, 1.5)),
    textMaterial(scope, [subtitle], {
      width: 1080,
      height: 300,
      title: name,
      titleSize: 76,
      bodySize: 34,
      align: 'center',
      rule: false,
      padding: 22,
      background: '#141118',
      titleColor: '#e8c65a',
      color: '#b9b2a5',
    }),
  );
}
