import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Museum } from '../world/Museum';
import { PersistentEnvironment } from '../world/PersistentEnvironment';
import { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENTS, SANCTUARY_CENTER, SANCTUARY_FLOOR_Y, LEVEL_1_Y } from '../world/layout';
import { SOURCE_VISITORS, visitorRouteForVNext } from '../content/sourceParity';

const CHANNEL = 'museum-workbench-3d';
const targetOrigin = location.origin === 'null' ? '*' : location.origin;
type FloorFilter = 'both' | 'ground' | 'upper';
type Mode = 'inspect' | 'pin';
type Position2D = readonly [number, number];
interface PlanningPin { id: string; position: Position2D; floor: 0 | 1; title: string; y?: number }
interface Message { channel: string; kind: string; selected?: string | null; selectedPin?: string | null;
  mode?: Mode; floor?: number; pins?: PlanningPin[]; moves?: Record<string, Position2D> }
interface RoomMarker { id: string; wing: string; floor: number; mesh: THREE.Mesh }
interface PinMarker { floor: number; mesh: THREE.Mesh }
const el = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw Error('Missing 3D control ' + id);
  return element as T;
};
const mount = el<HTMLElement>('scene');
const status = el<HTMLElement>('viewerStatus');
const floorSelect = el<HTMLSelectElement>('floor');
const wingSelect = el<HTMLSelectElement>('wing');
const cutawayButton = el<HTMLButtonElement>('cutaway');
const layers = {
  architecture: el<HTMLInputElement>('architecture'),
  exhibits: el<HTMLInputElement>('exhibits'),
  annotations: el<HTMLInputElement>('annotations'),
  visitors: el<HTMLInputElement>('visitors'),
  proposals: el<HTMLInputElement>('proposals'),
};
const museumScope = new ResourceScope('external-workbench-museum');
const pinScope = new ResourceScope('external-workbench-pin-markers');
const proposalScope = new ResourceScope('external-workbench-proposals');
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let building: THREE.Group | null = null;
let dressing: THREE.Group | null = null;
let overlay: THREE.Group | null = null;
let roomMarkers: RoomMarker[] = [];
let pinMarkers: PinMarker[] = [];
let routeLines: THREE.Line[] = [];
let selected: string | null = null;
let selectedPin: string | null = null;
let mode: Mode = 'inspect';
let parentFloor: 0 | 1 = 0;
let floor: FloorFilter = 'both';
let wing = 'all';
let cutaway = true;
let pins: PlanningPin[] = [];
let moves: Record<string, Position2D> = {};
let disposed = false;
let downPoint: { x: number; y: number } | null = null;
let observer: ResizeObserver | null = null;

function report(text: string): void { status.textContent = text; }
function send(kind: string, extra: Record<string, unknown> = {}): void {
  if (parent !== window) parent.postMessage({ channel: CHANNEL, kind, ...extra }, targetOrigin);
}
function validPoint(p: unknown, n: number): p is number[] {
  return Array.isArray(p) && p.length === n &&
    p.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 300);
}
function paint(): void {
  if (renderer && scene && camera && !disposed) renderer.render(scene, camera);
}
function focus(position: THREE.Vector3, extent = 32): void {
  if (!camera || !controls) return;
  controls.target.copy(position);
  camera.position.copy(position.clone().add(new THREE.Vector3(extent * .7, extent * .85, extent)));
  camera.updateProjectionMatrix();
  controls.update();
  paint();
}
function resetCamera(): void {
  if (!camera || !controls) return;
  controls.target.set(0, 2, 0);
  camera.position.set(149, 176, 165);
  camera.updateProjectionMatrix();
  controls.update();
  paint();
}
function isLevelVisible(n: number): boolean {
  return floor === 'both' || (floor === 'ground' ? n === 0 : n === 1);
}
function isWingVisible(id: string): boolean { return wing === 'all' || id === wing; }
function topCut(): number { return floor === 'ground' ? 7.8 : 17.8; }
function refreshVisibility(): void {
  if (!renderer || !building || !dressing || !overlay) return;
  renderer.clippingPlanes = [];
  if (cutaway || floor !== 'both')
    renderer.clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), topCut()));
  if (floor === 'upper')
    renderer.clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(LEVEL_1_Y - 1)));
  building.visible = layers.architecture.checked;
  // The dressing is an exact museum source layer but has no per-wing visibility contract.
  // Hide it during isolation rather than leaving ghost decor in invisible wings.
  dressing.visible = layers.architecture.checked && wing === 'all';
  for (const group of building.children) {
    if (!group.name.startsWith('zone:')) continue;
    const id = group.name.slice(5);
    group.visible = id === 'rotunda' ||
      (isWingVisible(id) && (floor === 'both' ||
        (floor === 'upper' ? id === 'media' || id === 'infra' :
          id !== 'media' && id !== 'infra')));
  }
  for (const marker of roomMarkers) {
    marker.mesh.visible = layers.exhibits.checked && isWingVisible(marker.wing) && isLevelVisible(marker.floor);
    marker.mesh.scale.setScalar(selected === marker.id ? 1.5 : 1);
    (marker.mesh.material as THREE.MeshBasicMaterial).color.setHex(
      selected === marker.id ? 0xffe7aa : marker.id === 'sanctuary' ? 0xa3d6c5 : 0xdcc18b,
    );
  }
  for (const marker of pinMarkers)
    marker.mesh.visible = layers.annotations.checked && isLevelVisible(marker.floor);
  for (const line of routeLines) line.visible = layers.visitors.checked && wing === 'all';
  const proposals = overlay.getObjectByName('proposals');
  if (proposals) {
    proposals.visible = layers.proposals.checked;
    for (const p of proposals.children) {
      const id = p.userData.roomId as string;
      const placement = PLACEMENTS.find(item => item.exhibitId === id);
      p.visible = Boolean(placement && isLevelVisible(placement.anchor[1] >= LEVEL_1_Y ? 1 : 0)
        && isWingVisible(placement.wing));
    }
  }
  paint();
}
function redrawPins(): void {
  if (!overlay) return;
  const group = overlay.getObjectByName('pins') as THREE.Group;
  group.clear(); pinScope.releaseAll(); pinMarkers = [];
  for (const pin of pins.slice(0, 300)) {
    if (!validPoint(pin.position, 2) || (pin.floor !== 0 && pin.floor !== 1)) continue;
    const y = typeof pin.y === 'number' && Number.isFinite(pin.y) ? pin.y :
      (pin.floor === 1 ? LEVEL_1_Y : 0);
    const mesh = new THREE.Mesh(
      pinScope.track(new THREE.SphereGeometry(selectedPin === pin.id ? 1.7 : 1.3, 12, 8)),
      pinScope.track(new THREE.MeshBasicMaterial({
        color: selectedPin === pin.id ? 0xf7e6a9 : 0x78c5bf, depthTest: false,
      })),
    );
    mesh.position.set(pin.position[0], y + 1.75, pin.position[1]);
    mesh.userData.pinId = pin.id;
    group.add(mesh);
    pinMarkers.push({ floor: pin.floor, mesh });
  }
  refreshVisibility();
}
function redrawProposals(): void {
  if (!overlay) return;
  const group = overlay.getObjectByName('proposals') as THREE.Group;
  group.clear(); proposalScope.releaseAll();
  for (const placement of PLACEMENTS) {
    const dest = moves[placement.exhibitId];
    if (!validPoint(dest, 2)) continue;
    const y = placement.anchor[1] + 2.5;
    const line = new THREE.Line(
      proposalScope.track(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(placement.anchor[0], y, placement.anchor[2]),
        new THREE.Vector3(dest[0], y, dest[1]),
      ])),
      proposalScope.track(new THREE.LineBasicMaterial({ color: 0x78c7c5, depthTest: false })),
    );
    const ghost = new THREE.Mesh(
      proposalScope.track(new THREE.SphereGeometry(1.8, 9, 7)),
      proposalScope.track(new THREE.MeshBasicMaterial({
        color: 0x78c7c5, transparent: true, opacity: .55, depthTest: false,
      })),
    );
    ghost.position.set(dest[0], y, dest[1]);
    const container = new THREE.Group();
    container.userData.roomId = placement.exhibitId;
    container.add(line, ghost);
    group.add(container);
  }
  refreshVisibility();
}
function addAnchors(): void {
  if (!overlay) return;
  for (const placement of PLACEMENTS) {
    const marker = new THREE.Mesh(
      museumScope.track(new THREE.SphereGeometry(1.65, 12, 8)),
      museumScope.track(new THREE.MeshBasicMaterial({ color: 0xdcc18b, depthTest: false })),
    );
    marker.position.set(placement.anchor[0], placement.anchor[1] + 3.5, placement.anchor[2]);
    marker.name = 'exhibit-anchor-' + placement.exhibitId;
    marker.userData.roomId = placement.exhibitId;
    overlay.add(marker);
    roomMarkers.push({
      id: placement.exhibitId, wing: placement.wing,
      floor: placement.anchor[1] >= LEVEL_1_Y ? 1 : 0, mesh: marker,
    });
  }
  const sanctuary = new THREE.Mesh(
    museumScope.track(new THREE.SphereGeometry(2.2, 12, 8)),
    museumScope.track(new THREE.MeshBasicMaterial({ color: 0xa3d6c5, depthTest: false })),
  );
  sanctuary.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + 3, SANCTUARY_CENTER[2]);
  sanctuary.userData.roomId = 'sanctuary';
  overlay.add(sanctuary);
  roomMarkers.push({ id: 'sanctuary', wing: 'sanctuary', floor: 0, mesh: sanctuary });
}
function addVisitorRoutes(): void {
  if (!overlay) return;
  for (const person of SOURCE_VISITORS) {
    const points = visitorRouteForVNext(person.id).map(p => new THREE.Vector3(p[0], p[1] + .3, p[2]));
    if (points.length < 2) continue;
    const line = new THREE.Line(
      museumScope.track(new THREE.BufferGeometry().setFromPoints(points)),
      museumScope.track(new THREE.LineBasicMaterial({
        color: 0x8cabb4, transparent: true, opacity: .7, depthTest: false,
      })),
    );
    line.name = 'authored-visitor-route-' + person.id;
    line.visible = false;
    overlay.add(line);
    routeLines.push(line);
  }
}
function isActuallyVisible(obj: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = obj; p; p = p.parent)
    if (!p.visible) return false;
  return true;
}
function pick(event: PointerEvent): void {
  if (!renderer || !camera || !building) return;
  const box = renderer.domElement.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(
    (event.clientX - box.left) / box.width * 2 - 1,
    -((event.clientY - box.top) / box.height * 2 - 1),
  ), camera);
  if (mode === 'pin') {
    if (!layers.architecture.checked) {
      report('Enable Architecture to pin a real physical surface.');
      return;
    }
    const hit = ray.intersectObject(building, true).find(intersection =>
      isActuallyVisible(intersection.object) && intersection.point.y <= topCut() &&
      (floor !== 'upper' || intersection.point.y >= LEVEL_1_Y - 1));
    if (!hit) { report('No visible physical surface at this position. Rotate and try again.'); return; }
    const point = hit.point;
    const pinFloor = floor === 'upper' ? 1 : floor === 'ground' ? 0 : parentFloor;
    send('pin-create', { position: [point.x, point.y, point.z], floor: pinFloor });
    return;
  }
  const meshes = [
    ...roomMarkers.filter(m => m.mesh.visible).map(m => m.mesh),
    ...pinMarkers.filter(m => m.mesh.visible).map(m => m.mesh),
  ];
  const hit = ray.intersectObjects(meshes, false)[0];
  if (!hit) return;
  const pinId = hit.object.userData.pinId as string | undefined;
  const id = hit.object.userData.roomId as string | undefined;
  if (pinId) send('pin-select', { id: pinId });
  else if (id) send('room-select', { id });
}
function applyParentState(data: Message): void {
  if (typeof data.selected === 'string' || data.selected === null) {
    if (selected !== data.selected) {
      selected = data.selected ?? null;
      const placement = PLACEMENTS.find(p => p.exhibitId === selected);
      if (placement) focus(new THREE.Vector3(...placement.anchor), 28);
      else if (selected === 'sanctuary') focus(new THREE.Vector3(...SANCTUARY_CENTER), 32);
      if (selected) report('Selected ' + selected + '; inspect details in the main workbench.');
    }
  }
  if (typeof data.selectedPin === 'string' || data.selectedPin === null)
    selectedPin = data.selectedPin ?? null;
  if (data.mode === 'inspect' || data.mode === 'pin') {
    mode = data.mode;
    if (renderer) renderer.domElement.style.cursor = mode === 'pin' ? 'crosshair' : 'grab';
  }
  if (data.floor === 0 || data.floor === 1) parentFloor = data.floor;
  if (Array.isArray(data.pins)) {
    pins = data.pins.slice(0, 300).filter(p => p && typeof p.id === 'string' && validPoint(p.position, 2));
    redrawPins();
  }
  if (data.moves && typeof data.moves === 'object') {
    moves = data.moves;
    redrawProposals();
  }
  refreshVisibility();
}
function init(): void {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b181d);
  camera = new THREE.PerspectiveCamera(54, 1, .1, 1200);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  if (!renderer.capabilities.isWebGL2) throw Error('WebGL 2 unavailable');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.enablePan = true;
  controls.minDistance = 8; controls.maxDistance = 480;
  controls.maxPolarAngle = Math.PI / 2 - .015;
  controls.addEventListener('change', paint);
  const result = new Museum(museumScope).build();
  building = result.root; scene.add(building);
  dressing = new PersistentEnvironment(museumScope).build(); scene.add(dressing);
  const sun = new THREE.DirectionalLight(0xffead0, 2.1);
  sun.position.set(-80, 140, 70);
  scene.add(new THREE.AmbientLight(0xc5d4dd, 1.8), sun);
  overlay = new THREE.Group();
  const pinsGroup = new THREE.Group(); pinsGroup.name = 'pins';
  const proposalsGroup = new THREE.Group(); proposalsGroup.name = 'proposals';
  overlay.add(pinsGroup, proposalsGroup);
  scene.add(overlay);
  addAnchors(); addVisitorRoutes();
  resetCamera();
  floorSelect.addEventListener('change', () => {
    floor = floorSelect.value as FloorFilter; refreshVisibility();
  });
  wingSelect.addEventListener('change', () => {
    wing = wingSelect.value;
    if (wing === 'all') resetCamera();
    else if (wing === 'sanctuary') focus(new THREE.Vector3(...SANCTUARY_CENTER), 42);
    else {
      const group = result.zoneGroups.get(wing);
      if (group) {
        const bounds = new THREE.Box3().setFromObject(group);
        if (!bounds.isEmpty())
          focus(bounds.getCenter(new THREE.Vector3()), Math.max(28, bounds.getSize(new THREE.Vector3()).length() * .65));
      }
    }
    refreshVisibility();
  });
  cutawayButton.addEventListener('click', () => {
    cutaway = !cutaway;
    cutawayButton.setAttribute('aria-pressed', String(cutaway));
    cutawayButton.textContent = cutaway ? 'Roof cutaway' : 'Roof visible';
    refreshVisibility();
  });
  el<HTMLButtonElement>('reset').addEventListener('click', () => {
    wing = 'all'; wingSelect.value = 'all';
    floor = 'both'; floorSelect.value = 'both';
    cutaway = true; cutawayButton.setAttribute('aria-pressed', 'true');
    cutawayButton.textContent = 'Roof cutaway';
    resetCamera(); refreshVisibility();
  });
  Object.values(layers).forEach(input => input.addEventListener('change', refreshVisibility));
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', e => { downPoint = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (e.button !== 0 || !downPoint) return;
    const distance = Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y);
    downPoint = null;
    if (distance < 6) pick(e);
  });
  window.addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin || e.data?.channel !== CHANNEL) return;
    if (e.data.kind === 'state') applyParentState(e.data as Message);
  });
  observer = new ResizeObserver(() => {
    if (!renderer || !camera || disposed) return;
    const width = Math.max(1, mount.clientWidth), height = Math.max(1, mount.clientHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); paint();
  });
  observer.observe(mount);
  refreshVisibility();
  Object.defineProperty(window, 'Museum3DProof', { value: Object.freeze({
    sceneSource: 'Museum.build()', threeRevision: THREE.REVISION,
    realMuseumRoot: building.name === 'museum-building',
    exhibitAnchors: PLACEMENTS.length, authoredVisitorRoutes: routeLines.length,
    zoneCount: result.zoneGroups.size,
    getState: () => ({ floor, wing, cutaway, selected, selectedPin, pinCount: pinMarkers.length }),
    screenForRoom: (id: string) => {
      if (!camera || !renderer) return null;
      const marker = roomMarkers.find(m => m.id === id);
      if (!marker || !marker.mesh.visible) return null;
      const p = marker.mesh.position.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: (p.x + 1) * rect.width / 2, y: (1 - p.y) * rect.height / 2 };
    },
  }) });
  window.addEventListener('pagehide', dispose, { once: true });
  send('ready');
  report('Actual 3D museum geometry ready.');
}
function dispose(): void {
  if (disposed) return;
  disposed = true;
  observer?.disconnect();
  controls?.dispose();
  pinScope.dispose(); proposalScope.dispose(); museumScope.dispose();
  renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
}
try { init(); }
catch (error) {
  console.error('[3D museum survey]', error);
  dispose();
  el<HTMLElement>('fallback').style.display = 'grid';
  report('3D unavailable; the 2D plan still works.');
  send('error');
}
