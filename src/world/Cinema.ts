import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { canRenderText, createFallbackTexture, createTextTexture, type TextTextureOptions } from '../assets/TextTexture';
import type { CollisionWorld } from './CollisionWorld';
import { GeometryKit } from './GeometryKit';
import { INTERACTION_ONLY_LAYER } from '../interaction/InteractionManager';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NO_MERGE } from './MergeStatic';
import { LEVEL_1_Y, ROTUNDA_APOTHEM, type Vec3 } from './layout';
import {
  ACCESSIBLE_POSITIONS, AUDITORIUM, BOOTH, CENTRE_AISLE, CINEMA_ENTRY_Y, CINEMA_FLOOR_Y, CINEMA_SEATS,
  CINEMA_THRESHOLD_HEIGHT, CINEMA_THRESHOLD_WIDTH, ENTRY_DOOR, EXIT_DOOR, EXIT_PASSAGE, FRONT_ZONE_TO_X, LOBBY,
  LIGHT_LOCK, NORTH_AISLE, REAR_PLATFORM, ROW_LETTERS, SCREEN, SEAT_BLOCKS, SEAT_ROW_DEPTH, SEAT_ROW_HEIGHT, SEAT_WIDTH,
  SOUTH_AISLE, TIER_COUNT, TIER_DEPTH, WALL_T, tierEndX, tierStartX, tierY, type CinemaSeat,
} from './cinemaLayout';

/** Underside of every cinema slab: the top of the east hall's roof below. */
const SLAB_BASE_Y = LEVEL_1_Y + 0.4;
const AUD_WALL_TOP = AUDITORIUM.ceilingY + 0.4;
/** Height of a seat row's interaction volume above its tread. */
const SEAT_PROXY_HEIGHT = 1.5;

export interface SeatBlockControl {
  readonly id: string;
  readonly block: 'north' | 'south';
  /**
   * One invisible raycast target per seat block: the block's nine row volumes
   * in a single geometry (interaction layer only, never drawn). Which seat is
   * taken is decided by where the visitor stands.
   */
  readonly proxy: THREE.Mesh;
  readonly seats: readonly CinemaSeat[];
}

export interface CinemaArchitecture {
  readonly group: THREE.Group;
  /** Fixed screen frame; the picture sits inside it, masked to each film's shape. */
  readonly picture: THREE.Mesh;
  readonly pictureMaterial: THREE.MeshBasicMaterial;
  /** What the screen shows when no film is running (the programme slide). */
  readonly idleTexture: THREE.Texture;
  readonly seatBlocks: readonly SeatBlockControl[];
  /** One proxy over all the accessible positions; the nearest is taken. */
  readonly accessibleProxy: THREE.Mesh;
  readonly programmeBoard: THREE.Mesh;
  /** House lighting: scaled down while a film plays. Aisle, step and exit lights are not in here. */
  readonly house: HouseLights;
  readonly beam: THREE.Mesh;
  readonly marqueeBulbs: THREE.InstancedMesh;
}

/** Materials whose brightness follows the house level (1 = full house lights). */
export class HouseLights {
  private readonly lit: { material: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  private readonly glow: { material: THREE.MeshBasicMaterial; base: THREE.Color; floor: number }[] = [];
  level = 1;

  addLit(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    this.lit.push({ material, base: material.color.clone() });
    return material;
  }

  /** A fixture's glow; `floor` is the fraction it keeps when the house is fully down. */
  addGlow(material: THREE.MeshBasicMaterial, floor = 0.06): THREE.MeshBasicMaterial {
    this.glow.push({ material, base: material.color.clone(), floor });
    return material;
  }

  /** House level 1 → 0 (show): lit surfaces fall to 22 % so the screen leads, never to black. */
  apply(level: number): void {
    this.level = Math.max(0, Math.min(1, level));
    const surface = 0.22 + 0.78 * this.level;
    for (const { material, base } of this.lit) material.color.copy(base).multiplyScalar(surface);
    for (const { material, base, floor } of this.glow) material.color.copy(base).multiplyScalar(floor + (1 - floor) * this.level);
  }

  get counts(): { lit: number; glow: number } {
    return { lit: this.lit.length, glow: this.glow.length };
  }
}

function textTexture(scope: ResourceScope, paragraphs: readonly string[], opts: TextTextureOptions): THREE.Texture {
  return canRenderText() ? createTextTexture(scope, paragraphs, opts) : createFallbackTexture(scope);
}

/**
 * Builds the cinema's architecture into `group`, recording collision as it
 * goes (the same GeometryKit contract as every other room: what is seen is
 * what is solid). Nothing here plays media; see `src/cinema/`.
 */
export function buildCinemaArchitecture(
  scope: ResourceScope,
  collision: CollisionWorld,
  group: THREE.Group,
  programmeLines: readonly string[],
): CinemaArchitecture {
  const kit = new GeometryKit(scope, collision, group);
  const house = new HouseLights();
  const std = (color: number, roughness = 0.8, metalness = 0, dim = true) => {
    const m = scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return dim ? house.addLit(m) : m;
  };
  const basic = (color: number) => scope.track(new THREE.MeshBasicMaterial({ color, toneMapped: false }));

  const mat = {
    shell: std(0x141a2e, 0.88), // midnight blue plaster, outside and in
    fabric: std(0x1c2644, 0.96), // acoustic wall panels
    ceiling: std(0x0c1020, 0.92),
    carpet: std(0x3a1626, 0.97), // burgundy
    // Matte: a glossy floor caught specular glare from the Rotunda's lights (no shadows reach in here).
    lobbyFloor: std(0x22283c, 0.92),
    riser: std(0x171b2b, 0.85),
    trim: std(0xb08a4a, 0.4, 0.65), // bronze, the museum's trim metal
    velvet: std(0x6e1424, 0.9), // seats and drapes
    seatFrame: std(0x16161d, 0.6, 0.3),
    rail: std(0x9c7b45, 0.35, 0.7),
    booth: std(0x10131c, 0.8),
    projector: std(0x2b2f3a, 0.45, 0.6, false),
    accessibleMark: std(0x1f5fa8, 0.6),
    matte: basic(0x0b0b0e), // screen masking: dead black, unlit
  };
  // House fixtures: sconces and ceiling coves. They dim, but never fully out.
  const sconceGlow = house.addGlow(basic(0xf2c48a), 0.1);
  const coveGlow = house.addGlow(basic(0x4f9ad0), 0.05);
  // Always-on safety lighting: aisle steps, exit route, exit signs.
  const stepGlow = basic(0x9fd4ff);
  const exitRunGlow = basic(0x3fbf7f);

  // ── Threshold, balcony side ──────────────────────────────────────────────
  // The drum's east face is opened by Museum.buildRotunda (CINEMA_THRESHOLD_*).
  // Here: a bronze proscenium frame and a lit marquee that read from across
  // the Rotunda, plus the floor through the drum wall.
  const faceX = ROTUNDA_APOTHEM - 0.6; // balcony-side face of the drum wall
  const halfOpen = CINEMA_THRESHOLD_WIDTH / 2;
  for (const s of [-1, 1]) {
    kit.prop([faceX - 0.12, CINEMA_ENTRY_Y + CINEMA_THRESHOLD_HEIGHT / 2 + 0.3, s * (halfOpen + 0.32)], [0.14, CINEMA_THRESHOLD_HEIGHT / 2 + 0.3, 0.3], mat.trim);
  }
  kit.prop([faceX - 0.14, CINEMA_ENTRY_Y + CINEMA_THRESHOLD_HEIGHT + 0.35, 0], [0.16, 0.22, halfOpen + 0.62], mat.trim);
  const marquee = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(6.2, 1.7)),
    scope.track(new THREE.MeshBasicMaterial({
      map: textTexture(scope, ['The Museum Cinema · Upper floor'], {
        width: 1240, height: 340, title: 'CINEMA', titleSize: 150, bodySize: 40, align: 'center', rule: false,
        padding: 26, background: '#0b1224', titleColor: '#f2d28a', color: '#9fd4ff',
      }),
      toneMapped: false,
    })),
  );
  marquee.name = 'cinema-marquee';
  marquee.position.set(faceX - 0.32, CINEMA_ENTRY_Y + CINEMA_THRESHOLD_HEIGHT + 1.55, 0);
  marquee.rotation.y = -Math.PI / 2;
  group.add(marquee);
  kit.prop([faceX - 0.26, CINEMA_ENTRY_Y + CINEMA_THRESHOLD_HEIGHT + 1.55, 0], [0.05, 0.98, 3.28], mat.trim);

  // Marquee bulbs: one instanced mesh, a slow travelling glow (static under reduced motion).
  const bulbPositions: Vec3[] = [];
  const bulbY0 = CINEMA_ENTRY_Y + CINEMA_THRESHOLD_HEIGHT + 0.62;
  const bulbY1 = bulbY0 + 1.86;
  for (let i = 0; i <= 22; i++) {
    const z = -3.2 + (6.4 * i) / 22;
    bulbPositions.push([faceX - 0.34, bulbY0, z], [faceX - 0.34, bulbY1, z]);
  }
  for (let i = 1; i < 6; i++) {
    const y = bulbY0 + ((bulbY1 - bulbY0) * i) / 6;
    bulbPositions.push([faceX - 0.34, y, -3.2], [faceX - 0.34, y, 3.2]);
  }
  const marqueeBulbs = new THREE.InstancedMesh(
    scope.track(new THREE.SphereGeometry(0.055, 8, 6)),
    scope.track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    bulbPositions.length,
  );
  marqueeBulbs.name = 'cinema-marquee-bulbs';
  marqueeBulbs.userData[NO_MERGE] = true;
  const placeholder = new THREE.Object3D();
  bulbPositions.forEach((p, i) => {
    placeholder.position.set(p[0], p[1], p[2]);
    placeholder.updateMatrix();
    marqueeBulbs.setMatrixAt(i, placeholder.matrix);
    marqueeBulbs.setColorAt(i, new THREE.Color(0xffd99a));
  });
  group.add(marqueeBulbs);

  // Floor through the drum wall (the balcony ring stops at the wall's centre).
  kit.slab(ROTUNDA_APOTHEM - 0.2, LOBBY.rampFromX, -halfOpen - 0.1, halfOpen + 0.1, CINEMA_ENTRY_Y, 0.4, mat.lobbyFloor);

  // ── Lobby ────────────────────────────────────────────────────────────────
  const lobbyLow = kit.slab(LOBBY.minX, LOBBY.rampFromX, LOBBY.minZ, LOBBY.maxZ, CINEMA_ENTRY_Y, 0.4, mat.lobbyFloor);
  lobbyLow.name = 'cinema-lobby-floor';
  // A gentle ramp (0.6 m over 4 m, ~8.5°) lifts the visitor to the cinema floor.
  const rampLength = LOBBY.rampToX - LOBBY.rampFromX;
  const rampRise = CINEMA_FLOOR_Y - CINEMA_ENTRY_Y;
  const ramp = new THREE.Mesh(
    scope.track(new THREE.BoxGeometry(Math.hypot(rampLength, rampRise), 0.3, LOBBY.maxZ - LOBBY.minZ)),
    mat.lobbyFloor,
  );
  ramp.position.set((LOBBY.rampFromX + LOBBY.rampToX) / 2, (CINEMA_ENTRY_Y + CINEMA_FLOOR_Y) / 2 - 0.15, 0);
  ramp.rotation.z = Math.atan2(rampRise, rampLength);
  group.add(ramp);
  collision.add({
    kind: 'ramp', minX: LOBBY.rampFromX, maxX: LOBBY.rampToX, minZ: LOBBY.minZ, maxZ: LOBBY.maxZ,
    axis: 'x', yAtMin: CINEMA_ENTRY_Y, yAtMax: CINEMA_FLOOR_Y,
  });
  kit.slab(LOBBY.rampToX, LOBBY.maxX, LOBBY.minZ, LOBBY.maxZ, CINEMA_FLOOR_Y, CINEMA_FLOOR_Y - SLAB_BASE_Y, mat.lobbyFloor);
  // Burgundy runner from the threshold to the auditorium door.
  for (const [x0, x1, y] of [[LOBBY.minX, LOBBY.rampFromX, CINEMA_ENTRY_Y], [LOBBY.rampToX, LOBBY.maxX, CINEMA_FLOOR_Y]] as const) {
    kit.prop([(x0 + x1) / 2, y + 0.012, 0], [(x1 - x0) / 2, 0.012, 1.6], mat.carpet);
  }

  const lobbyTop = LOBBY.ceilingY;
  // Over the east corridor (roof at y 7.4) the walls meet the low floor; from
  // the upper slab on they stand on the east hall's roof (top y 10.4), so no
  // stub of cinema wall shows below the hall ceiling.
  const lowBase = CINEMA_ENTRY_Y - 0.4;
  for (const z of [LOBBY.minZ - WALL_T / 2, LOBBY.maxZ + WALL_T / 2]) {
    const end = z > 0 ? EXIT_PASSAGE.minX - 0.2 : LOBBY.maxX + WALL_T;
    kit.wall([LOBBY.minX, 0, z], [LOBBY.rampToX, 0, z], lowBase, lobbyTop - lowBase, WALL_T, mat.shell);
    kit.wall([LOBBY.rampToX, 0, z], [end, 0, z], SLAB_BASE_Y, lobbyTop - SLAB_BASE_Y, WALL_T, mat.shell);
  }
  kit.ceiling(LOBBY.minX, LOBBY.maxX, LOBBY.minZ - WALL_T, LOBBY.maxZ + WALL_T, lobbyTop, 0.3, mat.ceiling);
  // Coffers and a cove line give the lobby its own, warmer register.
  for (let x = LOBBY.minX + 1.2; x < LOBBY.maxX - 0.6; x += 2.4) {
    kit.prop([x, lobbyTop - 0.06, 0], [0.9, 0.05, 3.9], mat.fabric);
  }
  for (const s of [-1, 1]) {
    const cove = new THREE.Mesh(scope.track(new THREE.BoxGeometry(LOBBY.maxX - LOBBY.minX, 0.05, 0.08)), coveGlow);
    cove.position.set((LOBBY.minX + LOBBY.maxX) / 2, lobbyTop - 0.18, s * (LOBBY.maxZ - 0.12));
    group.add(cove);
  }
  // Fabric panels with bronze fillets and sconces between them, both walls.
  for (const s of [-1, 1]) {
    const z = s * (LOBBY.maxZ - 0.03);
    for (let i = 0; i < 4; i++) {
      const x = LOBBY.minX + 1.4 + i * 2.5;
      if (s > 0 && x > EXIT_PASSAGE.minX - 1) continue;
      // The north wall carries the now-showing case and the programme board instead.
      if (s < 0) continue;
      kit.prop([x, CINEMA_FLOOR_Y + 2.0, z], [0.95, 1.5, 0.03], mat.fabric);
      kit.prop([x + 1.25, CINEMA_FLOOR_Y + 2.3, z], [0.03, 1.9, 0.04], mat.trim);
      const sconce = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.16, 0.5, 0.08)), sconceGlow);
      sconce.position.set(x + 1.25, CINEMA_FLOOR_Y + 2.6, z - s * 0.05);
      group.add(sconce);
    }
  }

  // Now-showing case and the programme board on the north wall.
  const showingCase = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(2.2, 3.0)),
    scope.track(new THREE.MeshBasicMaterial({
      map: textTexture(scope, programmeLines.length
        ? [`${programmeLines.length} film${programmeLines.length === 1 ? '' : 's'} in the programme.`, 'Take any seat; the programme opens when you sit.']
        : ['No films are in the programme yet.'], {
        width: 600, height: 820, title: 'Now showing', titleSize: 62, bodySize: 32, align: 'center', padding: 44,
        background: '#10172c', titleColor: '#f2d28a', color: '#d9e4f5',
      }),
      toneMapped: false,
    })),
  );
  showingCase.position.set(LOBBY.minX + 3.6, CINEMA_ENTRY_Y + 2.1, LOBBY.minZ + 0.06);
  group.add(showingCase);
  kit.prop([LOBBY.minX + 3.6, CINEMA_ENTRY_Y + 2.1, LOBBY.minZ + 0.02], [1.22, 1.62, 0.015], mat.trim);

  const programmeBoard = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(3.2, 2.4)),
    scope.track(new THREE.MeshBasicMaterial({
      map: textTexture(scope, programmeLines.length ? programmeLines.slice(0, 8) : ['No films are in the programme yet.'], {
        width: 960, height: 720, title: 'Programme', titleSize: 56, bodySize: 26, align: 'left', padding: 46,
        background: '#0d1426', titleColor: '#f2d28a', color: '#d9e4f5',
      }),
      toneMapped: false,
    })),
  );
  programmeBoard.name = 'cinema-programme-board';
  programmeBoard.position.set(LOBBY.rampToX + 0.4, CINEMA_FLOOR_Y + 1.75, LOBBY.minZ + 0.07);
  group.add(programmeBoard);
  kit.prop([LOBBY.rampToX + 0.4, CINEMA_FLOOR_Y + 1.75, LOBBY.minZ + 0.025], [1.72, 1.32, 0.02], mat.trim);

  // The light lock: a velvet baffle wall, bronze-capped, between the lobby and
  // the auditorium doors (see LIGHT_LOCK).
  kit.wall([LIGHT_LOCK.x, 0, LIGHT_LOCK.minZ], [LIGHT_LOCK.x, 0, LIGHT_LOCK.maxZ], SLAB_BASE_Y, lobbyTop - SLAB_BASE_Y, WALL_T, mat.velvet);
  kit.prop([LIGHT_LOCK.x, CINEMA_FLOOR_Y + 1.6, LIGHT_LOCK.minZ - 0.04], [WALL_T / 2 + 0.03, 1.6, 0.05], mat.trim);
  // A velvet drape beside the auditorium door, flush to the wall. (Only the
  // north side: on the south side the exit passage meets the lobby, and a
  // drape there stood in the passage's walking width.)
  kit.prop([LOBBY.maxX - 0.05, CINEMA_FLOOR_Y + 1.9, ENTRY_DOOR.minZ - 0.25], [0.05, 1.9, 0.24], mat.velvet);

  // ── Front wall (lobby | auditorium), with the entry and exit doors ───────
  const frontX = LOBBY.maxX + WALL_T / 2;
  const frontWall = (z0: number, z1: number, base: number, height: number) =>
    kit.wall([frontX, 0, z0], [frontX, 0, z1], base, height, WALL_T, mat.shell);
  frontWall(LOBBY.minZ - WALL_T, ENTRY_DOOR.minZ, SLAB_BASE_Y, AUD_WALL_TOP - SLAB_BASE_Y);
  frontWall(ENTRY_DOOR.minZ, ENTRY_DOOR.maxZ, CINEMA_FLOOR_Y + ENTRY_DOOR.height, AUD_WALL_TOP - CINEMA_FLOOR_Y - ENTRY_DOOR.height);
  frontWall(ENTRY_DOOR.maxZ, EXIT_DOOR.minZ, SLAB_BASE_Y, AUD_WALL_TOP - SLAB_BASE_Y);
  frontWall(EXIT_DOOR.minZ, EXIT_DOOR.maxZ, CINEMA_FLOOR_Y + EXIT_DOOR.height, AUD_WALL_TOP - CINEMA_FLOOR_Y - EXIT_DOOR.height);
  frontWall(EXIT_DOOR.maxZ, AUDITORIUM.maxZ + WALL_T, SLAB_BASE_Y, AUD_WALL_TOP - SLAB_BASE_Y);
  for (const door of [ENTRY_DOOR, EXIT_DOOR]) {
    // The floor continues through the wall's thickness.
    kit.slab(LOBBY.maxX - 0.1, AUDITORIUM.minX + 0.1, door.minZ, door.maxZ, CINEMA_FLOOR_Y, CINEMA_FLOOR_Y - SLAB_BASE_Y, mat.lobbyFloor);
    for (const z of [door.minZ, door.maxZ]) kit.prop([frontX, CINEMA_FLOOR_Y + door.height / 2, z], [WALL_T / 2 + 0.05, door.height / 2, 0.06], mat.trim);
    kit.prop([frontX, CINEMA_FLOOR_Y + door.height + 0.06, (door.minZ + door.maxZ) / 2], [WALL_T / 2 + 0.05, 0.06, (door.maxZ - door.minZ) / 2 + 0.06], mat.trim);
  }

  // ── Exit passage behind the screen ───────────────────────────────────────
  kit.slab(EXIT_PASSAGE.minX, EXIT_PASSAGE.maxX, LOBBY.maxZ, EXIT_PASSAGE.maxZ + WALL_T, CINEMA_FLOOR_Y, CINEMA_FLOOR_Y - SLAB_BASE_Y, mat.lobbyFloor);
  const passageTop = CINEMA_FLOOR_Y + 3.8;
  kit.wall([EXIT_PASSAGE.minX - WALL_T / 2, 0, LOBBY.maxZ], [EXIT_PASSAGE.minX - WALL_T / 2, 0, EXIT_PASSAGE.maxZ + WALL_T], SLAB_BASE_Y, passageTop - SLAB_BASE_Y, WALL_T, mat.shell);
  kit.wall([EXIT_PASSAGE.minX - WALL_T, 0, EXIT_PASSAGE.maxZ + WALL_T / 2], [EXIT_PASSAGE.maxX, 0, EXIT_PASSAGE.maxZ + WALL_T / 2], SLAB_BASE_Y, passageTop - SLAB_BASE_Y, WALL_T, mat.shell);
  kit.ceiling(EXIT_PASSAGE.minX - WALL_T, EXIT_PASSAGE.maxX, LOBBY.maxZ + WALL_T, EXIT_PASSAGE.maxZ + WALL_T, passageTop, 0.3, mat.ceiling);
  // A green guide line at floor level runs the whole exit route, lit always.
  const exitRun = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.06, 0.04, EXIT_PASSAGE.maxZ - LOBBY.maxZ - 0.4)), exitRunGlow);
  exitRun.position.set(EXIT_PASSAGE.minX + 0.08, CINEMA_FLOOR_Y + 0.12, (LOBBY.maxZ + EXIT_PASSAGE.maxZ) / 2);
  group.add(exitRun);

  // ── Auditorium shell ─────────────────────────────────────────────────────
  const { minX, maxX, minZ, maxZ, ceilingY } = AUDITORIUM;
  const fullHeight = AUD_WALL_TOP - SLAB_BASE_Y;
  kit.wall([LOBBY.maxX, 0, minZ - WALL_T / 2], [maxX + WALL_T, 0, minZ - WALL_T / 2], SLAB_BASE_Y, fullHeight, WALL_T, mat.shell);
  kit.wall([LOBBY.maxX, 0, maxZ + WALL_T / 2], [maxX + WALL_T, 0, maxZ + WALL_T / 2], SLAB_BASE_Y, fullHeight, WALL_T, mat.shell);
  // Rear wall, with two projection ports level with the screen centre.
  const rearX = maxX + WALL_T / 2;
  const portY = SCREEN.bottomY + SCREEN.height / 2;
  const ports = [SCREEN.centerZ - 0.8, SCREEN.centerZ + 0.8];
  const portHalf = 0.32;
  kit.wall([rearX, 0, minZ - WALL_T], [rearX, 0, ports[0] - portHalf], SLAB_BASE_Y, fullHeight, WALL_T, mat.shell);
  kit.wall([rearX, 0, ports[0] + portHalf], [rearX, 0, ports[1] - portHalf], SLAB_BASE_Y, fullHeight, WALL_T, mat.shell);
  kit.wall([rearX, 0, ports[1] + portHalf], [rearX, 0, maxZ + WALL_T], SLAB_BASE_Y, fullHeight, WALL_T, mat.shell);
  const portGlass = scope.track(new THREE.MeshBasicMaterial({ color: 0x8fb8e8, transparent: true, opacity: 0.18, depthWrite: false }));
  for (const z of ports) {
    kit.wall([rearX, 0, z - portHalf], [rearX, 0, z + portHalf], SLAB_BASE_Y, portY - portHalf - SLAB_BASE_Y, WALL_T, mat.shell);
    kit.wall([rearX, 0, z - portHalf], [rearX, 0, z + portHalf], portY + portHalf, AUD_WALL_TOP - portY - portHalf, WALL_T, mat.shell);
    // The port is glazed: solid to a visitor, transparent to the eye.
    const glass = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(portHalf * 2, portHalf * 2)),
      portGlass,
    );
    glass.position.set(maxX + 0.02, portY, z);
    glass.rotation.y = -Math.PI / 2;
    group.add(glass);
    kit.wallCollision([rearX, 0, z - portHalf], [rearX, 0, z + portHalf], portY - portHalf, portHalf * 2, WALL_T);
  }
  kit.ceiling(LOBBY.maxX, maxX + WALL_T, minZ - WALL_T, maxZ + WALL_T, ceilingY, 0.4, mat.ceiling);

  // Floor: flat front zone, nine stadium tiers, rear platform. Each tier is solid to the slab below.
  kit.slab(minX, FRONT_ZONE_TO_X, minZ, maxZ, CINEMA_FLOOR_Y, CINEMA_FLOOR_Y - SLAB_BASE_Y, mat.carpet);
  for (let i = 0; i < TIER_COUNT; i++) {
    const y = tierY(i);
    const tier = kit.slab(tierStartX(i), tierEndX(i), NORTH_AISLE.maxZ, maxZ, y, y - SLAB_BASE_Y, mat.riser);
    tier.name = `cinema-tier:${ROW_LETTERS[i]}`;
    // Carpet on the tread, and a step light at its nosing in each stepped aisle.
    kit.prop([(tierStartX(i) + tierEndX(i)) / 2, y + 0.01, (NORTH_AISLE.maxZ + maxZ) / 2], [TIER_DEPTH / 2, 0.012, (maxZ - NORTH_AISLE.maxZ) / 2], mat.carpet);
    for (const aisle of [CENTRE_AISLE, SOUTH_AISLE]) {
      const step = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.05, 0.035, aisle.maxZ - aisle.minZ - 0.3)), stepGlow);
      step.position.set(tierStartX(i) + 0.03, y - 0.03, (aisle.minZ + aisle.maxZ) / 2);
      group.add(step);
    }
  }
  kit.slab(REAR_PLATFORM.minX, REAR_PLATFORM.maxX, minZ, maxZ, REAR_PLATFORM.y, REAR_PLATFORM.y - SLAB_BASE_Y, mat.carpet);

  // North aisle: a continuous ramp to the rear platform, the step-free route.
  const aisleFromX = FRONT_ZONE_TO_X;
  const aisleToX = REAR_PLATFORM.minX;
  const aisleRise = REAR_PLATFORM.y - CINEMA_FLOOR_Y;
  const aisleRun = aisleToX - aisleFromX;
  const aisleRamp = new THREE.Mesh(
    scope.track(new THREE.BoxGeometry(Math.hypot(aisleRun, aisleRise), 0.3, NORTH_AISLE.maxZ - NORTH_AISLE.minZ)),
    mat.carpet,
  );
  aisleRamp.name = 'cinema-north-aisle-ramp';
  aisleRamp.position.set((aisleFromX + aisleToX) / 2, (CINEMA_FLOOR_Y + REAR_PLATFORM.y) / 2 - 0.15, (NORTH_AISLE.minZ + NORTH_AISLE.maxZ) / 2);
  aisleRamp.rotation.z = Math.atan2(aisleRise, aisleRun);
  group.add(aisleRamp);
  collision.add({
    kind: 'ramp', minX: aisleFromX, maxX: aisleToX, minZ: NORTH_AISLE.minZ, maxZ: NORTH_AISLE.maxZ,
    axis: 'x', yAtMin: CINEMA_FLOOR_Y, yAtMax: REAR_PLATFORM.y,
  });
  // Wall-side handrail and a low light line along the ramp.
  const railLen = Math.hypot(aisleRun, aisleRise);
  for (const [material, height, inset, size] of [[mat.rail, 0.92, 0.08, 0.05], [stepGlow, 0.08, 0.04, 0.03]] as const) {
    const line = new THREE.Mesh(scope.track(new THREE.BoxGeometry(railLen, size, size)), material);
    line.position.set((aisleFromX + aisleToX) / 2, (CINEMA_FLOOR_Y + REAR_PLATFORM.y) / 2 + height, minZ + inset);
    line.rotation.z = Math.atan2(aisleRise, aisleRun);
    group.add(line);
  }

  // Acoustic panels with bronze fillets and house sconces on both side walls; ceiling coves.
  for (const z of [minZ + 0.04, maxZ - 0.04]) {
    const toward = z < SCREEN.centerZ ? 1 : -1;
    for (let x = minX + 2.2; x < maxX - 1; x += 3.2) {
      const floorAt = x < FRONT_ZONE_TO_X ? CINEMA_FLOOR_Y : x >= REAR_PLATFORM.minX ? REAR_PLATFORM.y : tierY(Math.floor((x - FRONT_ZONE_TO_X) / 2.1));
      const panelBase = floorAt + 1.4;
      kit.prop([x, (panelBase + ceilingY - 0.8) / 2, z], [1.3, (ceilingY - 0.8 - panelBase) / 2, 0.035], mat.fabric);
      kit.prop([x + 1.6, (panelBase + ceilingY - 0.8) / 2, z], [0.04, (ceilingY - 0.8 - panelBase) / 2, 0.05], mat.trim);
      const sconce = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.1, 0.62, 0.18)), sconceGlow);
      sconce.position.set(x + 1.6, panelBase + 1.6, z + toward * 0.08);
      group.add(sconce);
    }
    const cove = new THREE.Mesh(scope.track(new THREE.BoxGeometry(maxX - minX, 0.06, 0.1)), coveGlow);
    cove.position.set((minX + maxX) / 2, ceilingY - 0.3, z + toward * 0.25);
    group.add(cove);
    kit.prop([(minX + maxX) / 2, ceilingY - 0.22, z + toward * 0.1], [(maxX - minX) / 2, 0.08, 0.22], mat.trim);
  }
  // Acoustic clouds across the ceiling.
  for (let x = minX + 4; x < maxX - 2; x += 4.2) {
    kit.prop([x, ceilingY - 0.5, (minZ + maxZ) / 2], [1.4, 0.08, (maxZ - minZ) / 2 - 1.4], mat.fabric);
  }

  // ── Screen ──────────────────────────────────────────────────────────────
  // A bronze-edged frame, a dead-black masked field, a shallow apron in front.
  kit.prop([minX + 0.1, SCREEN.bottomY + SCREEN.height / 2, SCREEN.centerZ], [0.1, SCREEN.height / 2 + 0.28, SCREEN.width / 2 + 0.28], mat.trim);
  const field = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height)), mat.matte);
  field.name = 'cinema-screen-field';
  field.position.set(SCREEN.x - 0.02, SCREEN.bottomY + SCREEN.height / 2, SCREEN.centerZ);
  field.rotation.y = Math.PI / 2;
  group.add(field);
  const idleTexture = textTexture(scope, programmeLines.length
    ? ['Take a seat and choose a film from the programme.', 'Silent films play without sound. Nothing starts until you choose.']
    : ['No films are in the programme yet.', 'This screen will show museum films once real media is added.'], {
    width: 1600, height: 900, title: 'The Museum Cinema', titleSize: 96, bodySize: 44, align: 'center', padding: 120,
    background: '#070a14', titleColor: '#f2d28a', color: '#c9d6ea', fitTitle: false,
  });
  const pictureMaterial = scope.track(new THREE.MeshBasicMaterial({ map: idleTexture, toneMapped: false }));
  const picture = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(1, 1)), pictureMaterial);
  picture.name = 'cinema-screen-picture';
  picture.userData[NO_MERGE] = true;
  picture.position.set(SCREEN.x, SCREEN.bottomY + SCREEN.height / 2, SCREEN.centerZ);
  picture.rotation.y = Math.PI / 2;
  picture.scale.set(SCREEN.width, SCREEN.height, 1);
  group.add(picture);
  // Velvet side drapes (fixed masking legs) and a low apron floor in front of the screen.
  for (const z of [SCREEN.centerZ - SCREEN.width / 2 - 0.75, SCREEN.centerZ + SCREEN.width / 2 + 0.75]) {
    kit.prop([minX + 0.45, (CINEMA_FLOOR_Y + ceilingY - 0.4) / 2, z], [0.3, (ceilingY - 0.4 - CINEMA_FLOOR_Y) / 2, 0.55], mat.velvet);
  }
  kit.slab(minX, minX + 1.6, SCREEN.centerZ - SCREEN.width / 2 - 0.2, SCREEN.centerZ + SCREEN.width / 2 + 0.2, CINEMA_FLOOR_Y + 0.3, 0.3, mat.riser);

  // The projector's beam: visible only while a film runs (opacity set by the venue).
  const beamLength = Math.hypot(maxX - SCREEN.x, 0.01);
  const beam = new THREE.Mesh(
    scope.track(new THREE.ConeGeometry(SCREEN.height * 0.42, beamLength, 4, 1, true)),
    scope.track(new THREE.MeshBasicMaterial({
      color: 0x9fc4ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })),
  );
  beam.name = 'cinema-projector-beam';
  beam.userData[NO_MERGE] = true;
  beam.rotation.z = -Math.PI / 2;
  beam.rotation.x = Math.PI / 4;
  beam.position.set((maxX + SCREEN.x) / 2, portY, SCREEN.centerZ);
  beam.visible = false;
  group.add(beam);

  // ── Projection booth behind the rear wall ───────────────────────────────
  const boothTop = BOOTH.floorY + BOOTH.height;
  kit.box([(BOOTH.minX + BOOTH.maxX) / 2, (SLAB_BASE_Y + BOOTH.floorY) / 2, (BOOTH.minZ + BOOTH.maxZ) / 2], [(BOOTH.maxX - BOOTH.minX) / 2, (BOOTH.floorY - SLAB_BASE_Y) / 2, (BOOTH.maxZ - BOOTH.minZ) / 2], mat.booth);
  kit.wall([BOOTH.maxX, 0, BOOTH.minZ], [BOOTH.maxX, 0, BOOTH.maxZ], BOOTH.floorY, BOOTH.height, WALL_T, mat.booth);
  kit.wall([BOOTH.minX, 0, BOOTH.minZ], [BOOTH.maxX, 0, BOOTH.minZ], BOOTH.floorY, BOOTH.height, WALL_T, mat.booth);
  kit.wall([BOOTH.minX, 0, BOOTH.maxZ], [BOOTH.maxX, 0, BOOTH.maxZ], BOOTH.floorY, BOOTH.height, WALL_T, mat.booth);
  kit.ceiling(BOOTH.minX, BOOTH.maxX + WALL_T / 2, BOOTH.minZ - WALL_T / 2, BOOTH.maxZ + WALL_T / 2, boothTop, 0.25, mat.booth);
  for (const z of ports) {
    kit.prop([BOOTH.minX + 0.9, portY - 0.1, z], [0.55, 0.32, 0.26], mat.projector);
    const lens = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12)), mat.projector);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(BOOTH.minX + 0.2, portY, z);
    group.add(lens);
  }
  const boothLamp = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.06, 0.06, BOOTH.maxZ - BOOTH.minZ - 1)), house.addGlow(basic(0x6fa8ff), 0.5));
  boothLamp.position.set(BOOTH.maxX - 0.3, boothTop - 0.2, (BOOTH.minZ + BOOTH.maxZ) / 2);
  group.add(boothLamp);

  // ── Exit signs (always lit) ─────────────────────────────────────────────
  const exitMaterials = new Map<string, THREE.MeshBasicMaterial>();
  const exitSign = (position: Vec3, rotationY: number, arrow: string) => {
    const title = `EXIT ${arrow}`.trim();
    let material = exitMaterials.get(title);
    if (!material) {
      material = scope.track(new THREE.MeshBasicMaterial({
        map: textTexture(scope, [], { width: 360, height: 126, title, titleSize: 74, align: 'center', rule: false, padding: 18, background: '#0d5a34', titleColor: '#e9fff2', fitTitle: true }),
        toneMapped: false,
      }));
      exitMaterials.set(title, material);
    }
    const sign = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(1.2, 0.42)), material);
    sign.name = 'cinema-exit-sign';
    sign.position.set(position[0], position[1], position[2]);
    sign.rotation.y = rotationY;
    group.add(sign);
  };
  exitSign([minX + 0.04, CINEMA_FLOOR_Y + ENTRY_DOOR.height + 0.45, (ENTRY_DOOR.minZ + ENTRY_DOOR.maxZ) / 2], Math.PI / 2, '');
  exitSign([minX + 0.04, CINEMA_FLOOR_Y + EXIT_DOOR.height + 0.45, (EXIT_DOOR.minZ + EXIT_DOOR.maxZ) / 2], Math.PI / 2, '');
  exitSign([REAR_PLATFORM.minX + 0.6, REAR_PLATFORM.y + 2.6, minZ + 0.05], 0, '');
  exitSign([EXIT_PASSAGE.maxX - 0.05, CINEMA_FLOOR_Y + 2.6, 14], -Math.PI / 2, '');
  exitSign([LOBBY.minX + 0.6, CINEMA_ENTRY_Y + 3.4, LOBBY.maxZ - 0.05], Math.PI, '→ Rotunda');

  // ── Seats: three instanced parts, one row collider per block ────────────
  const seatGroup = new THREE.Group();
  seatGroup.name = 'cinema-seats';
  seatGroup.userData[NO_MERGE] = true;
  group.add(seatGroup);
  const cushions = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(0.5, 0.14, 0.52)), mat.velvet, CINEMA_SEATS.length);
  const backs = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(0.12, 0.66, 0.52)), mat.velvet, CINEMA_SEATS.length);
  const arms = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(0.62, 0.62, 0.07)), mat.seatFrame, CINEMA_SEATS.length);
  const matrix = new THREE.Object3D();
  CINEMA_SEATS.forEach((seat, i) => {
    const [x, y, z] = seat.position;
    matrix.rotation.set(0, 0, 0);
    matrix.position.set(x - 0.06, y + 0.44, z);
    matrix.updateMatrix();
    cushions.setMatrixAt(i, matrix.matrix);
    matrix.position.set(x + 0.3, y + 0.8, z);
    matrix.rotation.set(0, 0, -0.14);
    matrix.updateMatrix();
    backs.setMatrixAt(i, matrix.matrix);
    matrix.rotation.set(0, 0, 0);
    matrix.position.set(x + 0.02, y + 0.31, z - SEAT_WIDTH / 2);
    matrix.updateMatrix();
    arms.setMatrixAt(i, matrix.matrix);
  });
  for (const mesh of [cushions, backs, arms]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    seatGroup.add(mesh);
  }

  const seatBlocks: SeatBlockControl[] = [];
  const proxyMaterial = scope.track(new THREE.MeshBasicMaterial({ visible: false }));
  const proxyFrom = (name: string, boxes: THREE.BufferGeometry[], material = proxyMaterial): THREE.Mesh => {
    const proxy = new THREE.Mesh(scope.track(mergeGeometries(boxes, false)), material);
    for (const box of boxes) box.dispose();
    proxy.name = name;
    proxy.layers.set(INTERACTION_ONLY_LAYER);
    proxy.userData[NO_MERGE] = true;
    group.add(proxy);
    return proxy;
  };
  for (const block of SEAT_BLOCKS) {
    const rows: THREE.BufferGeometry[] = [];
    for (let row = 0; row < TIER_COUNT; row++) {
      const y = tierY(row);
      const x0 = tierEndX(row) - SEAT_ROW_DEPTH;
      const x1 = tierEndX(row) - 0.05;
      // The collider starts just below the tread: a wall whose base sits exactly
      // at the visitor's feet reads as a ceiling to the head-clearance query.
      collision.addBox([(x0 + x1) / 2, y - 0.05 + (SEAT_ROW_HEIGHT + 0.05) / 2, (block.minZ + block.maxZ) / 2], [(x1 - x0) / 2, (SEAT_ROW_HEIGHT + 0.05) / 2, (block.maxZ - block.minZ) / 2]);
      // The look-at volume rises to just under standing eye height, so a
      // visitor in the walkway selects the row by looking at it, not at their feet.
      rows.push(new THREE.BoxGeometry(x1 - x0, SEAT_PROXY_HEIGHT, block.maxZ - block.minZ)
        .translate((x0 + x1) / 2, y + SEAT_PROXY_HEIGHT / 2, (block.minZ + block.maxZ) / 2));
    }
    seatBlocks.push({
      id: `cinema-seats:${block.id}`,
      block: block.id,
      proxy: proxyFrom(`cinema-seat-block:${block.id}`, rows),
      seats: CINEMA_SEATS.filter((s) => s.block === block.id),
    });
  }

  // Accessible viewing positions: marked bays on the step-free rear platform.
  const spots: THREE.BufferGeometry[] = [];
  for (const spot of ACCESSIBLE_POSITIONS) {
    const [x, y, z] = spot.position;
    kit.prop([x, y + 0.008, z], [0.75, 0.008, 0.62], mat.accessibleMark);
    // A slim guard rail ahead of the bay: top bar and two posts, below a seated eye.
    kit.prop([x - 0.8, y + 0.9, z], [0.03, 0.03, 0.55], mat.rail);
    for (const side of [-0.52, 0.52]) kit.prop([x - 0.8, y + 0.45, z + side], [0.03, 0.45, 0.03], mat.rail);
    spots.push(new THREE.BoxGeometry(1.4, 2.4, 1.2).translate(x, y + 1.2, z));
  }
  // Double-sided and full height: a visitor who has rolled onto a bay is inside
  // its volume, and must still be able to choose "watch from here".
  const accessibleProxy = proxyFrom('cinema-accessible-positions', spots,
    scope.track(new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })));
  const accessSign = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(1.6, 0.5)),
    scope.track(new THREE.MeshBasicMaterial({
      map: textTexture(scope, [], { width: 480, height: 150, title: 'Step-free viewing', titleSize: 52, align: 'center', rule: false, padding: 16, background: '#1f5fa8', titleColor: '#ffffff' }),
      toneMapped: false,
    })),
  );
  accessSign.position.set(maxX - 0.05, REAR_PLATFORM.y + 2.2, 7.2);
  accessSign.rotation.y = -Math.PI / 2;
  group.add(accessSign);

  house.apply(1);
  return {
    group, picture, pictureMaterial, idleTexture, seatBlocks, accessibleProxy, programmeBoard, house, beam, marqueeBulbs,
  };
}

