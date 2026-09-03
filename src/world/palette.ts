import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { ZoneId } from './layout';

/**
 * Museum-wide colour grammar. The Rotunda and balcony are the bright neutral
 * baseline; every wing then owns a distinct family so visitors can understand
 * where they are before reading a sign.
 */
export interface Palette {
  readonly floor: THREE.Material;
  readonly wall: THREE.Material;
  readonly trim: THREE.Material;
  readonly ceiling: THREE.Material;
  readonly accent: THREE.Material;
}

const HEX: Record<ZoneId | 'shell' | 'sanctuaryZone', { floor: number; wall: number; trim: number; ceiling: number; accent: number }> = {
  // Baseline zero: luminous museum white with restrained warm metal.
  rotunda:   { floor: 0xf2f1ed, wall: 0xf8f7f2, trim: 0xc8ad72, ceiling: 0xffffff, accent: 0xd8c18d },
  balcony:   { floor: 0xe9e8e3, wall: 0xf5f4ef, trim: 0xbfa66f, ceiling: 0xffffff, accent: 0xd3bc87 },

  // Starsilk & Drakken: near-black, deep blue, and an azure signal.
  north:     { floor: 0x061521, wall: 0x0b2334, trim: 0x1a789f, ceiling: 0x020914, accent: 0x45c8ff },

  // Dex systems / technical systems: cool teal, cyan, slate.
  east:      { floor: 0x244248, wall: 0x31575d, trim: 0x52a9a4, ceiling: 0x172d32, accent: 0x72d2cc },

  // Games & play: coral, amber, orange with warm depth.
  south:     { floor: 0x6d3f32, wall: 0x8f5741, trim: 0xd26a46, ceiling: 0x44281f, accent: 0xf1a35d },

  // Archive & canon: plum, ink-violet, muted rose.
  west:      { floor: 0x3d304d, wall: 0x554064, trim: 0xa978ae, ceiling: 0x261e31, accent: 0xd0a0cc },

  // Music / promptcraft / media: ochre, amber, warm gold.
  media:     { floor: 0x5b4329, wall: 0x765538, trim: 0xd1a04c, ceiling: 0x352717, accent: 0xf0c36d },

  // Local systems: moss, forest, restrained mint.
  infra:     { floor: 0x314334, wall: 0x405946, trim: 0x78a86b, ceiling: 0x202d22, accent: 0xa8d696 },

  // Exterior stays pale so garden colour and the building silhouette dominate.
  plaza:     { floor: 0xd8d4ca, wall: 0xe4e0d7, trim: 0xb8a47a, ceiling: 0xf0ede6, accent: 0xd7bd83 },

  sanctuary: { floor: 0x3a342d, wall: 0x453e35, trim: 0x9c8b68, ceiling: 0x24201b, accent: 0xd9c69a },
  shell:     { floor: 0xd1cdc4, wall: 0xe2ded5, trim: 0xb8a47a, ceiling: 0xbdb8ad, accent: 0xd7bd83 },
  sanctuaryZone: { floor: 0x2a2622, wall: 0x35302a, trim: 0x8a7a5c, ceiling: 0x1c1916, accent: 0xd9c69a },
};

/** Builds and caches one palette per zone. All materials belong to `scope`. */
export class PaletteSet {
  private readonly cache = new Map<string, Palette>();

  constructor(private readonly scope: ResourceScope) {}

  get(zone: ZoneId | 'shell'): Palette {
    const cached = this.cache.get(zone);
    if (cached) return cached;
    const hex = HEX[zone] ?? HEX.shell;
    const p: Palette = {
      floor: this.mat(hex.floor, 0.94),
      wall: this.mat(hex.wall, 0.9),
      trim: this.mat(hex.trim, 0.55, 0.25),
      ceiling: this.mat(hex.ceiling, 1),
      accent: this.mat(hex.accent, 0.45, 0.35),
    };
    this.cache.set(zone, p);
    return p;
  }

  private mat(color: number, roughness: number, metalness = 0): THREE.Material {
    return this.scope.track(
      new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: false }),
    );
  }

  /** Glass for the dome and clerestories. */
  glass(): THREE.Material {
    const cached = this.cache.get('__glass');
    if (cached) return cached.floor;
    const m = this.scope.track(
      new THREE.MeshStandardMaterial({
        color: 0xd4ebf5,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      }),
    );
    this.cache.set('__glass', { floor: m, wall: m, trim: m, ceiling: m, accent: m });
    return m;
  }
}
