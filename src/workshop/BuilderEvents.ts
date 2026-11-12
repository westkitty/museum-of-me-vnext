import * as THREE from 'three';
import type { WorkshopPlacementRecord } from './schema';

interface MaterialState {
  readonly material: THREE.Material;
  readonly color: THREE.Color | null;
  readonly emissive: THREE.Color | null;
  readonly intensity: number | null;
}

/** Materials can be standard, physical, basic or imported GLB variants. */
function colorOf(material: THREE.Material, property: 'color' | 'emissive'): THREE.Color | null {
  const candidate = (material as unknown as Record<string, unknown>)[property];
  return candidate instanceof THREE.Color ? candidate : null;
}

/**
 * All authored reactions are local, deterministic and reversible. No scripts,
 * persistent transform changes, new frame loops, remote assets or collision
 * mutations are involved. On first activation, each participating material
 * is cloned so unrelated meshes sharing a GLB/primitive material cannot change.
 *
 * The return value can be wired directly to InteractionManager.activate().
 * Late-loaded GLB children are discovered on whichever activation sees them.
 */
export function createWorkshopActivation(
  record: WorkshopPlacementRecord,
  root: THREE.Object3D,
  trackMaterial: (material: THREE.Material) => THREE.Material,
  announce: (message: string) => void,
): () => void {
  const mode = record.event ?? 'none';
  const message = record.eventMessage?.trim();
  const targetColor = new THREE.Color(record.eventColor ?? '#ffc96b');
  const owned = new WeakMap<THREE.Mesh, readonly MaterialState[]>();
  let active = false;

  return () => {
    if (mode === 'none') return;
    if (mode === 'announce') {
      announce(`Museum object: ${record.label}`);
      return;
    }
    if (mode === 'message') {
      announce(message || record.label);
      return;
    }

    active = !active;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;

      let states = owned.get(mesh);
      if (!states) {
        const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        states = originals.map((original): MaterialState => {
          const material = trackMaterial(original.clone());
          const emissiveIntensity = (material as THREE.MeshStandardMaterial).emissiveIntensity;
          return {
            material,
            color: colorOf(material, 'color')?.clone() ?? null,
            emissive: colorOf(material, 'emissive')?.clone() ?? null,
            intensity: typeof emissiveIntensity === 'number' ? emissiveIntensity : null,
          };
        });
        const wasArray = Array.isArray(mesh.material);
        mesh.material = wasArray ? states.map((state) => state.material) : states[0].material;
        owned.set(mesh, states);
      }

      for (const state of states) {
        const color = colorOf(state.material, 'color');
        const emissive = colorOf(state.material, 'emissive');
        if (mode === 'toggle-tint' || (mode === 'toggle-glow' && !emissive)) {
          if (color && state.color) color.copy(active ? targetColor : state.color);
        }
        if (mode === 'toggle-glow' && emissive && state.emissive) {
          emissive.copy(active ? targetColor : state.emissive);
          if (state.intensity !== null) {
            (state.material as THREE.MeshStandardMaterial).emissiveIntensity =
              active ? Math.max(0.8, state.intensity) : state.intensity;
          }
        }
        state.material.needsUpdate = true;
      }
    });

    const defaultMessage = `${record.label}: ${active ? 'activated' : 'reset'}`;
    announce(message || defaultMessage);
  };
}
