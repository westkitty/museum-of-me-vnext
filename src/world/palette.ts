import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { ZoneId } from './layout';

/**
 * Wing identity through material. Plan §6.5 gives each wing a colour language;
 * the graybox uses flat, deliberately plain versions of it so the building is
 * readable while walking without pretending to be finished.
 */
export interface Palette {
  readonly floor: THREE.Material;
  readonly wall: THREE.Material;
  readonly trim: THREE.Material;
  readonly ceiling: THREE.Material;
  readonly accent: THREE.Material;
}

const HEX: Record<ZoneId | 'shell' | 'sanctuaryZone', { floor: number; wall: number; trim: number; ceiling: number; accent: number }> = {
  rotunda:   { floor: 0xd8d2c4, wall: 0xc4bdae, trim: 0xc9a227, ceiling: 0xa8a294, accent: 0xe8c65a },
  balcony:   { floor: 0xcfc8b9, wall: 0xbdb6a7, trim: 0xc9a227, ceiling: 0xa8a294, accent: 0xe8c65a },
  north:     { floor: 0x241f38, wall: 0x2e2748, trim: 0x6f5bd6, ceiling: 0x171426, accent: 0x9d8bff },
  east:      { floor: 0xcfd6d4, wall: 0xdde3e1, trim: 0x2f8f8a, ceiling: 0xb4bdba, accent: 0x3fb9b2 },
  south:     { floor: 0x6b4a34, wall: 0x8a6448, trim: 0xb5543a, ceiling: 0x503626, accent: 0xd97a4e },
  west:      { floor: 0x3a2f45, wall: 0x4a3c56, trim: 0x8a6bb5, ceiling: 0x281f30, accent: 0xb392e0 },
  media:     { floor: 0x4a3a26, wall: 0x5f4a30, trim: 0xb58b3a, ceiling: 0x33281a, accent: 0xe0b45a },
  infra:     { floor: 0x2b332a, wall: 0x374035, trim: 0x5f8a52, ceiling: 0x1e241d, accent: 0x8ec37c },
  plaza:     { floor: 0xb9b3a4, wall: 0xa8a294, trim: 0xc9a227, ceiling: 0x8f8a7d, accent: 0xe8c65a },
  sanctuary: { floor: 0x2a2622, wall: 0x35302a, trim: 0x8a7a5c, ceiling: 0x1c1916, accent: 0xd9c69a },
  shell:     { floor: 0x8f8a7d, wall: 0x9a9488, trim: 0xc9a227, ceiling: 0x6f6b60, accent: 0xe8c65a },
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
        color: 0xbfd8ea,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    this.cache.set('__glass', { floor: m, wall: m, trim: m, ceiling: m, accent: m });
    return m;
  }
}
