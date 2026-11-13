import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** One model to draw: a label and GLB bytes or a URL. */
export interface SheetItem { readonly label: string; readonly url?: string; readonly bytes?: ArrayBuffer }

const CELL = 200;

/**
 * Draws each model from a front three-quarter view and from the side onto one
 * labelled contact sheet and returns it as a PNG data URL. Used to review
 * Builder library models before and after repair; development only.
 */
export async function renderModelSheet(items: readonly SheetItem[], columns = 4): Promise<string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(CELL, CELL);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const sheet = document.createElement('canvas');
  const rows = Math.ceil(items.length / columns);
  sheet.width = columns * CELL * 2;
  sheet.height = rows * (CELL + 18);
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const loader = new GLTFLoader();

  for (const [index, item] of items.entries()) {
    const gltf = item.bytes ? await loader.parseAsync(item.bytes, '') : await loader.loadAsync(item.url!);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d8dde6');
    scene.add(new THREE.HemisphereLight('#ffffff', '#556070', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    scene.add(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#9aa3ad' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, 0, center.z);
    ground.scale.setScalar(Math.max(size.x, size.z) * 2.2 + 0.5);
    scene.add(ground);
    const reach = Math.max(size.x, size.y, size.z) * 1.6 + 0.2;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const col = index % columns;
    const row = Math.floor(index / columns);
    for (const [view, dir] of [[0, new THREE.Vector3(0.55, 0.45, 1)], [1, new THREE.Vector3(1, 0.3, 0)]] as const) {
      camera.position.copy(center).addScaledVector(dir.normalize(), reach);
      camera.lookAt(center);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, (col * 2 + view) * CELL, row * (CELL + 18) + 18);
    }
    ctx.fillStyle = '#f2f4f8';
    ctx.font = '13px sans-serif';
    ctx.fillText(item.label, col * 2 * CELL + 6, row * (CELL + 18) + 13);
    gltf.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
  renderer.dispose();
  return sheet.toDataURL('image/png');
}
