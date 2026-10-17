import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { InteractionManager } from '../interaction/InteractionManager';
import { createTextTexture, canRenderText, createFallbackTexture } from '../assets/TextTexture';
import { SOURCE_SUPPLEMENTARY, SUPPLEMENTARY_TO_VNEXT } from '../content/sourceParity';
import { faceDirection, place, ROTUNDA_APOTHEM, GROUND_Y, type Vec3 } from './layout';
import type { Journal } from '../state/Journal';

/**
 * Fifteen shallow finished wall cases from the Reliquary supplementary contract.
 * They sit on rotunda interior faces so they do not occupy exhibit bays.
 */
interface SupplementaryTexture {
  readonly pos: Vec3;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly preview: THREE.Texture;
  readonly material: THREE.MeshStandardMaterial;
  full: THREE.Texture | null;
}

export class SupplementaryCases {
  readonly group = new THREE.Group();
  private readonly unbind: (() => void)[] = [];
  private readonly readableTextures: SupplementaryTexture[] = [];
  private textureElapsed = 0;

  constructor(
    private readonly scope: ResourceScope,
    interaction: InteractionManager,
    journal: Journal,
    onOpen: (id: string, title: string, summary: string) => void,
  ) {
    this.group.name = 'source-supplementary-cases';
    // 'nw' is deliberately excluded: it is the Dexter Sanctuary threshold, not
    // a blind wall, and mounting generic wall cases there read as the
    // Sanctuary being "guarded" by unrelated supplementary content instead of
    // opening as a plain passage. The 15 cases split evenly across the
    // remaining three faces (5 apiece) instead.
    const faces = ['ne', 'se', 'sw'] as const;
    SOURCE_SUPPLEMENTARY.forEach((spec, index) => {
      const face = faces[index % faces.length];
      const dir = faceDirection(face);
      const slot = Math.floor(index / faces.length);
      const lateral = (slot - 2) * 2.6;
      const pos = place(dir, ROTUNDA_APOTHEM - 0.42, lateral, GROUND_Y + 1.7);
      const caseGroup = this.buildCase(scope, spec.title, spec.stage, spec.summary, spec.accent, pos, dir);
      caseGroup.name = `supplementary:${spec.id}`;
      caseGroup.userData = { sourceId: spec.id, vNext: SUPPLEMENTARY_TO_VNEXT[spec.id] };
      this.group.add(caseGroup);
      const hit = caseGroup.children.find((c) => c.userData.hit) ?? caseGroup;
      this.unbind.push(interaction.register(`supplementary:${spec.id}`, {
        object: hit,
        label: `Read ${spec.title}`,
        description: `${spec.stage}. ${spec.summary}`,
        activate: () => {
          journal.markSupplementaryRead(spec.id);
          journal.recordHistory({ kind: 'supplementary', id: spec.id }, spec.title);
          onOpen(spec.id, spec.title, spec.summary);
        },
      }));
    });
  }

  get count(): number {
    return SOURCE_SUPPLEMENTARY.length;
  }

  get highResolutionResidentCount(): number {
    return this.readableTextures.filter((entry) => entry.full !== null).length;
  }

  /** Keep at most two near-field 1024x640 canvases resident at a time. */
  update(viewerX: number, viewerZ: number, dt: number): void {
    this.textureElapsed += dt;
    if (this.textureElapsed < 0.2 || !canRenderText()) return;
    this.textureElapsed = 0;

    const wanted = this.readableTextures
      .map((entry, index) => {
        const distanceSq = (entry.pos[0] - viewerX) ** 2 + (entry.pos[2] - viewerZ) ** 2;
        return { index, distanceSq,
          // Prefer current texture until another case is materially closer.
          priority: distanceSq - (entry.full ? 16 : 0),
          keepRadiusSq: (entry.full ? 15 : 12) ** 2,
        };
      })
      .filter((item) => item.distanceSq < item.keepRadiusSq)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 2);
    let upgraded = false;
    for (let index = 0; index < this.readableTextures.length; index++) {
      const entry = this.readableTextures[index];
      const near = wanted.some((item) => item.index === index);
      if (near && !entry.full && !upgraded) {
        upgraded = true;
        const full = createTextTexture(this.scope, [entry.stage, entry.summary], {
          width: 1024, height: 640, background: '#1c1914', color: '#e8e1d2',
          title: entry.title, titleColor: '#d4bd7a', titleSize: 48,
          bodySize: 26, padding: 48,
        });
        entry.full = full;
        entry.material.map = full; // Same shader MAP variant as preview.
      } else if (!near && entry.full) {
        entry.material.map = entry.preview;
        entry.full.dispose();
        this.scope.untrack(entry.full);
        entry.full = null;
      }
    }
  }

  private buildCase(
    scope: ResourceScope,
    title: string,
    stage: string,
    summary: string,
    accent: readonly number[],
    pos: Vec3,
    dir: Vec3,
  ): THREE.Group {
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    g.lookAt(pos[0] - dir[0], pos[1], pos[2] - dir[2]);
    const color = (Math.round(accent[0] * 255) << 16) | (Math.round(accent[1] * 255) << 8) | Math.round(accent[2] * 255);
    const backing = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(1.55, 1.15, 0.08)),
      scope.track(new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 0.8 })),
    );
    backing.userData.hit = true;
    const trim = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(1.62, 1.22, 0.04)),
      scope.track(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.12 })),
    );
    trim.position.z = -0.03;
    const map = canRenderText()
      ? createTextTexture(scope, [stage, summary], {
          width: 384, height: 240, background: '#1c1914', color: '#e8e1d2',
          title, titleColor: '#d4bd7a', titleSize: 18, bodySize: 10, padding: 18,
        })
      : createFallbackTexture(scope, 0x1c1914);
    const material = scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    const plate = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(1.42, 1.02)),
      material,
    );
    plate.name = 'supplementary-plate';
    plate.position.z = 0.05;
    this.readableTextures.push({ pos, title, stage, summary, preview: map, material, full: null });
    g.add(trim, backing, plate);
    return g;
  }

  dispose(): void {
    for (const entry of this.readableTextures) {
      if (entry.full) {
        entry.full.dispose();
        this.scope.untrack(entry.full);
        entry.full = null;
      }
    }
    this.readableTextures.length = 0;
    for (const fn of this.unbind) fn();
    this.group.removeFromParent();
  }
}
