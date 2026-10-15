import * as THREE from 'three';
import type { ZoneId } from '../world/layout';

/**
 * No new lights, render passes, fog objects per frame, or camera movement.
 * The existing scene fog and tone-mapper adopt each wing's curatorial mood,
 * without hard cuts at thresholds or sacrificing the bright neutral Rotunda.
 */
interface Atmosphere {
  readonly color: THREE.Color;
  readonly near: number;
  readonly far: number;
  readonly exposure: number;
}

function atmosphere(color: number, near: number, far: number, exposure: number): Atmosphere {
  return { color: new THREE.Color(color), near, far, exposure };
}

const LOOKS: Record<ZoneId, Atmosphere> = {
  plaza: atmosphere(0x17304b, 70, 300, 1),
  rotunda: atmosphere(0x343743, 95, 315, 1.02),
  balcony: atmosphere(0x343743, 95, 315, 1.02),
  north: atmosphere(0x081f36, 60, 210, 1.02),
  east: atmosphere(0x173e46, 65, 220, 1.0),
  south: atmosphere(0x4a2b26, 70, 225, 1.0),
  west: atmosphere(0x302339, 65, 215, 1.01),
  media: atmosphere(0x473323, 70, 225, 1.0),
  infra: atmosphere(0x24372a, 65, 215, 1.01),
  sanctuary: atmosphere(0x211e24, 50, 175, 1.0),
};

export class AtmosphereDirector {
  private readonly fog: THREE.Fog;
  private readonly renderer: Pick<THREE.WebGLRenderer, 'toneMappingExposure'>;

  constructor(scene: THREE.Scene, renderer: Pick<THREE.WebGLRenderer, 'toneMappingExposure'>) {
    if (!(scene.fog instanceof THREE.Fog)) {
      throw new Error('AtmosphereDirector requires the existing linear museum fog');
    }
    this.fog = scene.fog;
    this.renderer = renderer;
    this.snap('plaza');
  }

  private snap(zone: ZoneId): void {
    const look = LOOKS[zone];
    this.fog.color.copy(look.color);
    this.fog.near = look.near;
    this.fog.far = look.far;
    this.renderer.toneMappingExposure = look.exposure;
  }

  update(zone: ZoneId, dt: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      this.snap(zone);
      return;
    }
    // Bounded frame-independent exponential smoothing, without changing
    // camera/gameplay motion or introducing a new timer/frame-loop owner.
    const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
    const t = 1 - Math.exp(-step * 1.9);
    const look = LOOKS[zone];
    this.fog.color.lerp(look.color, t);
    this.fog.near += (look.near - this.fog.near) * t;
    this.fog.far += (look.far - this.fog.far) * t;
    this.renderer.toneMappingExposure += (look.exposure - this.renderer.toneMappingExposure) * t;
  }
}
