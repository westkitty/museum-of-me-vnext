import type { ZoneId } from '../world/layout';

/**
 * Temporary silent implementation. The composition-root contract remains so
 * callers can stay stable while the audio design is repaired, but this class
 * deliberately never touches AudioContext or any playback primitive.
 */
export class AudioManager {
  get isRunning(): boolean { return false; }

  setZone(_zone: ZoneId): void { /* sound is disabled */ }
  dispose(): void { /* no audio resources were created */ }
}
