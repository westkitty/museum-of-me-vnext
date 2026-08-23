import type { ZoneId } from '../world/layout';

interface ZoneBed {
  /** Base frequency of the room tone, Hz. */
  readonly base: number;
  /** Filter cutoff, Hz. Lower reads as a heavier, more enclosed room. */
  readonly cutoff: number;
  /** Relative loudness within the museum's ambience mix. */
  readonly level: number;
  /** Noise contribution — air, machinery, paper. */
  readonly noise: number;
  readonly label: string;
}

/**
 * Wing ambience (plan §32): one identity per wing, not one track per exhibit.
 *
 * Every sound in the museum is synthesised at runtime from oscillators and
 * filtered noise. There is no audio file to download, no external host to
 * depend on, and no licence to verify — which is the same reasoning that makes
 * the rest of the asset programme procedural.
 */
const BEDS: Record<ZoneId, ZoneBed> = {
  rotunda:   { base: 62,  cutoff: 520, level: 0.42, noise: 0.10, label: 'A wide stone room under glass' },
  balcony:   { base: 68,  cutoff: 620, level: 0.34, noise: 0.09, label: 'The gallery above the atrium' },
  north:     { base: 46,  cutoff: 340, level: 0.50, noise: 0.06, label: 'Low celestial tone' },
  east:      { base: 96,  cutoff: 900, level: 0.30, noise: 0.13, label: 'Quiet electronics' },
  south:     { base: 74,  cutoff: 700, level: 0.36, noise: 0.11, label: 'Warm room, distant activity' },
  west:      { base: 54,  cutoff: 400, level: 0.24, noise: 0.07, label: 'Near-silence, paper and wood' },
  media:     { base: 88,  cutoff: 780, level: 0.32, noise: 0.09, label: 'Treated studio room tone' },
  infra:     { base: 41,  cutoff: 300, level: 0.44, noise: 0.16, label: 'Low machine hum' },
  plaza:     { base: 110, cutoff: 1400, level: 0.26, noise: 0.22, label: 'Outside, open air' },
  sanctuary: { base: 58,  cutoff: 260, level: 0.20, noise: 0.04, label: 'Very quiet' },
};

const CROSSFADE_SECONDS = 2.2;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private readonly voices = new Map<ZoneId, { gain: GainNode; stop: () => void }>();

  private currentZone: ZoneId | null = null;
  private masterVolume = 0.7;
  private ambienceVolume = 0.5;
  private started = false;

  /** Deferred until a real gesture: browsers refuse audio before one. */
  start(): void {
    if (this.started) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = this.ambienceVolume;
      this.ambienceGain.connect(this.master);
      this.started = true;
      if (this.currentZone) this.setZone(this.currentZone);
    } catch (err) {
      console.warn('[Audio] unavailable; the museum continues silently', err);
    }
  }

  get isRunning(): boolean {
    return this.started && this.ctx?.state === 'running';
  }

  setVolumes(master: number, ambience: number): void {
    this.masterVolume = master;
    this.ambienceVolume = ambience;
    if (this.master) this.master.gain.value = master;
    if (this.ambienceGain) this.ambienceGain.gain.value = ambience;
  }

  /** Crossfade to a zone's bed. Called when the visitor changes zone. */
  setZone(zone: ZoneId): void {
    this.currentZone = zone;
    if (!this.started || !this.ctx || !this.ambienceGain) return;

    for (const [id, voice] of this.voices) {
      if (id === zone) continue;
      this.rampTo(voice.gain, 0, CROSSFADE_SECONDS);
    }

    let voice = this.voices.get(zone);
    if (!voice) {
      const created = this.createBed(zone);
      if (!created) return;
      voice = created;
      this.voices.set(zone, voice);
    }
    this.rampTo(voice.gain, BEDS[zone].level, CROSSFADE_SECONDS);
  }

  /** A short, quiet confirmation for an exhibit interaction. */
  tick(pitch = 660): void {
    if (!this.started || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  zoneDescription(zone: ZoneId): string {
    return BEDS[zone].label;
  }

  private rampTo(gain: GainNode, value: number, seconds: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + seconds);
  }

  /** Two detuned oscillators plus filtered noise. Cheap, and it reads as a room. */
  private createBed(zone: ZoneId): { gain: GainNode; stop: () => void } | null {
    if (!this.ctx || !this.ambienceGain) return null;
    const bed = BEDS[zone];
    const ctx = this.ctx;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ambienceGain);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = bed.cutoff;
    filter.Q.value = 0.7;
    filter.connect(gain);

    const oscillators: OscillatorNode[] = [];
    for (const [ratio, detune, level] of [[1, -6, 0.5], [2.004, 5, 0.22], [3.01, -11, 0.1]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = bed.base * ratio;
      osc.detune.value = detune;
      const oscGain = ctx.createGain();
      oscGain.gain.value = level;
      osc.connect(oscGain).connect(filter);
      osc.start();
      oscillators.push(osc);
    }

    // Air: a short looping buffer of shaped noise. The leaky integrator below
    // is itself bounded to [-1, 1] (0.97 + 0.03 == 1, a convex combination),
    // but a fixed post-gain assumed a "typical" peak that an occasional long
    // same-signed run of white noise could exceed -- silently hard-clipping
    // into a harsh, crackling tone. Normalizing to the buffer's own measured
    // peak instead guarantees headroom regardless of how the randomness falls.
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.97 * last + 0.03 * white;
      data[i] = last;
      if (Math.abs(last) > peak) peak = Math.abs(last);
    }
    const targetPeak = 0.5;
    const scale = peak > 0 ? targetPeak / peak : 0;
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = bed.noise;
    noise.connect(noiseGain).connect(filter);
    noise.start();

    return {
      gain,
      stop: () => {
        for (const osc of oscillators) {
          try { osc.stop(); } catch { /* already stopped */ }
        }
        try { noise.stop(); } catch { /* already stopped */ }
      },
    };
  }

  dispose(): void {
    for (const voice of this.voices.values()) voice.stop();
    this.voices.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.ambienceGain = null;
    this.started = false;
  }
}
