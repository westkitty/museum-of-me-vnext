import * as THREE from 'three';
import type { CinemaArchitecture } from '../world/Cinema';
import {
  ACCESSIBLE_EYE_HEIGHT, ACCESSIBLE_POSITIONS, SCREEN, SCREEN_CENTER, SCREEN_FACING_YAW, SEATED_EYE_HEIGHT, type CinemaSeat,
} from '../world/cinemaLayout';
import type { ZoneId, Vec3 } from '../world/layout';
import { CinemaPlayback, type PlaybackSnapshot } from './CinemaPlayback';
import { CINEMA_PROGRAMME, type Programme } from './programme';

/** What the venue needs from the app. Narrow on purpose: no new framework. */
export interface CinemaHost {
  readonly interaction: { register(id: string, control: { object: THREE.Object3D; label: string | (() => string); description?: string; activate: () => void }): () => void };
  readonly player: {
    readonly position: THREE.Vector3;
    readonly isSeated: boolean;
    readonly isFrozen: boolean;
    readonly flightMode: boolean;
    pitch: number;
    sit(feet: Vec3, yaw: number, eyeHeight: number): boolean;
    stand(): boolean;
  };
  readonly input: { isDown(action: 'forward' | 'back' | 'left' | 'right'): boolean };
  reducedMotion(): boolean;
  announce(message: string): void;
  openProgramme(): void;
  /** The seated controls (absent in headless tests). */
  readonly console: { setContext(c: { visible: boolean; seatLabel: string | null }): void; update(s: PlaybackSnapshot): void } | null;
  filmUnavailable(filmId: string, reason: string): void;
}

/** House fade: about 1.6 s down and up, so the room settles rather than snaps. */
const HOUSE_FADE_PER_SECOND = 0.65;
const MARQUEE_UPDATE_SECONDS = 0.1;

/**
 * The cinema as a place: seats and accessible positions to occupy through the
 * museum's ordinary interaction (F / tap), a programme board, house lights
 * that fall while a film runs and rise when it stops, and the screen showing
 * whatever the player is playing. Leaving the cinema stops the film and
 * releases its media; nothing decodes video anywhere else in the museum.
 */
export class CinemaVenue {
  readonly playback: CinemaPlayback;
  private readonly unbind: (() => void)[] = [];
  private seatLabel: string | null = null;
  private houseLevel = 1;
  private marqueeClock = 0;
  private marqueeElapsed = MARQUEE_UPDATE_SECONDS;
  private inCinema = false;
  private readonly bulbColor = new THREE.Color();
  private readonly onVisibility = () => { if (document.hidden) this.playback.pause(); };

  constructor(
    private readonly host: CinemaHost,
    private readonly room: CinemaArchitecture,
    readonly programme: Programme = CINEMA_PROGRAMME,
    playback: CinemaPlayback = new CinemaPlayback(),
  ) {
    this.playback = playback;
    this.unbind.push(this.playback.onChange((snapshot) => this.onPlayback(snapshot)));
    for (const block of room.seatBlocks) {
      this.unbind.push(host.interaction.register(block.id, {
        object: block.proxy,
        label: () => {
          const seat = this.nearestSeat(block.seats);
          return `Take seat ${seat.label} · Row ${seat.label[0]}`;
        },
        description: 'Cinema seats facing the screen. Sit to watch; stand with X or any movement key.',
        activate: () => this.sit(this.nearestSeat(block.seats)),
      }));
    }
    this.unbind.push(host.interaction.register('cinema-accessible', {
      object: room.accessibleProxy,
      label: 'Watch from this step-free position',
      description: 'A level space for a wheelchair or your own seat on the rear platform, reached by the ramped north aisle.',
      activate: () => {
        const spot = this.nearestAccessible();
        this.occupy(spot.position, spot.label, ACCESSIBLE_EYE_HEIGHT);
      },
    }));
    this.unbind.push(host.interaction.register('cinema-programme', {
      object: room.programmeBoard,
      label: 'Read the cinema programme',
      description: `The cinema programme: ${this.programme.films.length} film${this.programme.films.length === 1 ? '' : 's'}.`,
      activate: () => host.openProgramme(),
    }));
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    this.showPicture();
  }

  get seated(): string | null {
    return this.seatLabel;
  }

  get houseLightLevel(): number {
    return this.houseLevel;
  }

  /** Sit in a seat: feet on its tier, eye at seated height, facing the screen. */
  sit(seat: CinemaSeat): boolean {
    return this.occupy(seat.position, `seat ${seat.label}`, SEATED_EYE_HEIGHT);
  }

  private occupy(feet: Vec3, label: string, eyeHeight: number): boolean {
    const player = this.host.player;
    // Face the centre of the screen from wherever the seat is, as a seated
    // visitor would turn to it (forward is (−sin yaw, −cos yaw)).
    const dx = SCREEN_CENTER[0] - feet[0];
    const dz = SCREEN_CENTER[2] - feet[2];
    const yaw = Number.isFinite(Math.atan2(-dx, -dz)) ? Math.atan2(-dx, -dz) : SCREEN_FACING_YAW;
    if (!player.sit(feet, yaw, eyeHeight)) return false;
    const eyeY = feet[1] + eyeHeight;
    player.pitch = Math.atan2(SCREEN_CENTER[1] - eyeY, Math.hypot(dx, dz));
    this.seatLabel = label;
    this.setSeatTargets(false);
    const state = this.playback.state;
    this.host.announce(`Seated in ${label}. ${state === 'empty' || state === 'error'
      ? 'Choose a film from the programme.' : 'Space plays or pauses.'} Press X or any movement key to stand.`);
    this.syncConsole();
    if (state === 'empty' || state === 'error') this.host.openProgramme();
    return true;
  }

  stand(): boolean {
    if (!this.seatLabel) return false;
    this.seatLabel = null;
    this.host.player.stand();
    this.setSeatTargets(true);
    this.host.announce('You stand up. The film keeps playing until you leave the cinema.');
    this.syncConsole();
    return true;
  }

  /** Choose a film: load it, then play it (the choice is the visitor's action). */
  async choose(filmId: string): Promise<boolean> {
    const film = this.programme.films.find((f) => f.id === filmId);
    if (!film) {
      this.host.announce('That film is not in the programme.');
      return false;
    }
    this.host.announce(`Loading ${film.title}.`);
    const loaded = await this.playback.load(film);
    if (!loaded) {
      const reason = this.playback.snapshot().error ?? 'unavailable';
      if (this.playback.state === 'error') {
        this.host.filmUnavailable(film.id, reason);
        this.host.announce(`${film.title} is unavailable. ${reason}`);
      }
      return false;
    }
    this.showPicture();
    const playing = await this.playback.play();
    if (playing) this.host.announce(`Now playing: ${film.title}. ${film.media.hasAudio ? 'Sound is off; turn it on with the Sound button.' : 'Silent film.'}`);
    return playing;
  }

  /**
   * Keys while seated (from the museum's code capture, so they never reach
   * movement). Returns true when the key was the cinema's.
   */
  handleKey(code: string, down: boolean, repeat: boolean): boolean {
    if (!this.seatLabel) return false;
    const owned = code === 'Space' || code === 'KeyK' || code === 'KeyR' || code === 'Comma' || code === 'Period'
      || code === 'KeyV' || code === 'KeyP' || code === 'KeyX';
    if (!owned) return false;
    if (!down || repeat) return true;
    switch (code) {
      case 'Space':
      case 'KeyK': void this.playback.toggle(); break;
      case 'KeyR': this.playback.restart(); break;
      case 'Comma': this.playback.skip(-5); break;
      case 'Period': this.playback.skip(5); break;
      case 'KeyV': {
        const s = this.playback.snapshot();
        if (s.captionsAvailable) this.playback.setCaptions(!s.captionsOn);
        else this.host.announce(s.film?.captionsNote ?? 'This film has no captions.');
        break;
      }
      case 'KeyP': this.host.openProgramme(); break;
      case 'KeyX': this.stand(); break;
    }
    return true;
  }

  /** Per frame, from the interior world's update. Cheap when nothing changes. */
  update(dt: number, zone: ZoneId, groupVisible: boolean): void {
    const inCinema = zone === 'cinema';
    if (inCinema !== this.inCinema) {
      this.inCinema = inCinema;
      if (!inCinema) this.leave();
      this.syncConsole();
    }
    if (this.seatLabel) {
      const input = this.host.input;
      // Walking away is how a visitor leaves a seat: never a trap.
      if (input.isDown('forward') || input.isDown('back') || input.isDown('left') || input.isDown('right')) this.stand();
    }

    const reduced = this.host.reducedMotion();
    const state = this.playback.state;
    const target = state === 'playing' ? 0 : state === 'paused' ? 0.45 : 1;
    if (this.houseLevel !== target) {
      const step = reduced ? 1 : HOUSE_FADE_PER_SECOND * dt;
      this.houseLevel = this.houseLevel < target ? Math.min(target, this.houseLevel + step) : Math.max(target, this.houseLevel - step);
      this.room.house.apply(this.houseLevel);
      const beamMaterial = this.room.beam.material as THREE.MeshBasicMaterial;
      beamMaterial.opacity = 0.055 * (1 - this.houseLevel);
      this.room.beam.visible = state === 'playing' || this.houseLevel < 0.98;
    }

    // Marquee bulbs: a slow travelling warmth (no blinking), static under reduced motion.
    if (!groupVisible || reduced) return;
    this.marqueeClock += dt;
    this.marqueeElapsed += dt;
    if (this.marqueeElapsed < MARQUEE_UPDATE_SECONDS) return;
    this.marqueeElapsed = 0;
    const bulbs = this.room.marqueeBulbs;
    for (let i = 0; i < bulbs.count; i++) {
      const wave = 0.5 + 0.5 * Math.sin(this.marqueeClock * 1.6 - i * 0.45);
      this.bulbColor.setRGB(1, 0.78 + 0.07 * wave, 0.5 + 0.1 * wave).multiplyScalar(0.72 + 0.28 * wave);
      bulbs.setColorAt(i, this.bulbColor);
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  }

  /** Leaving the auditorium ends the session: stand, stop, release media. */
  leave(): void {
    if (this.seatLabel) {
      this.seatLabel = null;
      this.host.player.stand();
      this.setSeatTargets(true);
    }
    if (this.playback.hasMediaElement || this.playback.state !== 'empty') this.playback.release();
  }

  /**
   * Seat targets are inert while seated: the row in front would otherwise put a
   * "take a seat" prompt over the film. Standing up makes them live again.
   */
  private setSeatTargets(live: boolean): void {
    for (const block of this.room.seatBlocks) block.proxy.visible = live;
    this.room.accessibleProxy.visible = live;
  }

  private nearestAccessible(): (typeof ACCESSIBLE_POSITIONS)[number] {
    const p = this.host.player.position;
    return ACCESSIBLE_POSITIONS.reduce((best, spot) =>
      Math.hypot(spot.position[0] - p.x, spot.position[2] - p.z) < Math.hypot(best.position[0] - p.x, best.position[2] - p.z) ? spot : best);
  }

  private nearestSeat(seats: readonly CinemaSeat[]): CinemaSeat {
    const p = this.host.player.position;
    let best = seats[0];
    let bestDistance = Infinity;
    for (const seat of seats) {
      const d = Math.hypot(seat.aisleSide[0] - p.x, seat.aisleSide[2] - p.z);
      if (d < bestDistance) { best = seat; bestDistance = d; }
    }
    return best;
  }

  private onPlayback(snapshot: PlaybackSnapshot): void {
    if (snapshot.state === 'empty' || snapshot.state === 'error' || snapshot.state === 'ready') this.showPicture();
    this.host.console?.update(snapshot);
  }

  /** Show the film (masked to its own shape inside the frame) or the programme slide. */
  private showPicture(): void {
    const material = this.room.pictureMaterial;
    const texture = this.playback.texture;
    const film = this.playback.film;
    const nextMap = texture ?? this.room.idleTexture;
    if (material.map !== nextMap) {
      material.map = nextMap;
      material.needsUpdate = true;
    }
    let width = SCREEN.width;
    let height = SCREEN.height;
    if (texture && film) {
      const aspect = film.media.width / film.media.height;
      if (aspect < SCREEN.width / SCREEN.height) width = height * aspect;
      else height = width / aspect;
    }
    this.room.picture.scale.set(width, height, 1);
  }

  private syncConsole(): void {
    this.host.console?.setContext({ visible: this.inCinema || Boolean(this.seatLabel), seatLabel: this.seatLabel });
    this.host.console?.update(this.playback.snapshot());
  }

  dispose(): void {
    this.leave();
    for (const off of this.unbind) off();
    this.unbind.length = 0;
    this.playback.dispose();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
