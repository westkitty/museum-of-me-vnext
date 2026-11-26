import * as THREE from 'three';

/**
 * The two light rooms every reflective surface in the museum sees: a lit
 * gallery indoors and the moonlit island outdoors. Both are a handful of
 * unlit shapes rendered once into PMREM targets of the same size, so moving
 * between worlds swaps one texture and never recompiles a shader.
 */
export type EnvironmentKind = 'gallery' | 'night';

function panel(scene: THREE.Scene, color: number, intensity: number, size: readonly [number, number, number], at: readonly [number, number, number]): void {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
  );
  mesh.position.set(at[0], at[1], at[2]);
  scene.add(mesh);
}

function gradientDome(top: THREE.Color, horizon: THREE.Color, ground: THREE.Color, radius: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 24, 16);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const h = position.getY(i) / radius;
    if (h >= 0) c.copy(horizon).lerp(top, Math.min(1, h * 1.8));
    else c.copy(horizon).lerp(ground, Math.min(1, -h * 3));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}

function galleryScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(gradientDome(
    new THREE.Color(0.86, 0.84, 0.8), new THREE.Color(0.62, 0.61, 0.6), new THREE.Color(0.28, 0.27, 0.26), 30,
  ));
  // Long skylight softboxes give brass and polished stone a readable streak.
  for (const x of [-7, 0, 7]) panel(scene, 0xfff3df, x === 0 ? 13 : 8, [1.5, 0.3, 17], [x, 12, 0]);
  // Cool clerestory glazing on one side, warm wall wash opposite.
  for (const z of [-9, 0, 9]) {
    panel(scene, 0xa9c8f2, 3.4, [0.3, 4.5, 3.4], [-16, 5.5, z]);
    panel(scene, 0xffd9a2, 2.6, [0.3, 1.1, 5], [16, 7.5, z]);
  }
  panel(scene, 0xffc98a, 1.6, [10, 0.8, 0.3], [0, 2.4, -17]);
  // Dark bands stop metal reading as flat white.
  for (const z of [-13, 13]) panel(scene, 0x0b0b0d, 1, [9, 5, 0.4], [0, 4, z]);
  return scene;
}

function nightScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(gradientDome(
    new THREE.Color(0.14, 0.2, 0.36), new THREE.Color(0.5, 0.68, 0.92), new THREE.Color(0.1, 0.15, 0.15), 60,
  ));
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd6e6ff).multiplyScalar(26) }),
  );
  moon.position.set(-0.43, 0.71, -0.56).normalize().multiplyScalar(48);
  scene.add(moon);
  // Facade and lantern warmth near the horizon.
  for (const [x, z] of [[-30, -22], [30, -22], [-16, 34], [16, 34]] as const) panel(scene, 0xffb469, 2.4, [4, 1.2, 4], [x, 1.6, z]);
  panel(scene, 0x6fb9ea, 2.2, [26, 1.2, 0.5], [0, 5, -38]);
  return scene;
}

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
}

/** Bakes one environment; the caller owns the returned target. */
export function bakeEnvironment(renderer: THREE.WebGLRenderer, kind: EnvironmentKind): THREE.WebGLRenderTarget {
  const scene = kind === 'gallery' ? galleryScene() : nightScene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, kind === 'gallery' ? 0.03 : 0.02, 0.1, 200);
  pmrem.dispose();
  disposeScene(scene);
  return target;
}
