import type { ZoneId } from '../world/layout';

interface ZoneBed {
  readonly base: number;
  readonly cutoff: number;
  readonly level: number;
  readonly noise: number;
  readonly label: string;
}

/**
 * Wing ambience: one identity per wing, not one track per exhibit. Playback
 * starts only after a visitor gesture and the default master gain is zero.
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

interface Voice {
  readonly gain: GainNode;
  readonly stop: () => void;
  /** Outstanding cleanup timer scheduled for when this bed fades out;
   *  cancelled if the visitor re-enters the zone before it fires. */
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private readonly voices = new Map<ZoneId, Voice>();

  private currentZone: ZoneId | null = null;
  private masterVolume = 0;
  private ambienceVolume = 0;
  private started = false;

  /** Deferred until a real gesture; browsers refuse audio before one. */
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
      if (id === zone) {
        // The visitor returned before the previous fade-out cleanup ran.
        // Cancel that cleanup and leave the voice resident so it can be
        // re-ramped smoothly.
        if (voice.cleanupTimer !== null) {
          clearTimeout(voice.cleanupTimer);
          voice.cleanupTimer = null;
        }
        continue;
      }
      if (voice.cleanupTimer !== null) continue; // already fading out
      this.rampTo(voice.gain, 0, CROSSFADE_SECONDS);
      // Schedule disposal after the crossfade completes so idle beds do not
      // accumulate oscillators/buffers across every zone the visitor has
      // entered. If they return before the timer fires, the block above
      // cancels it and the bed is reused.
      voice.cleanupTimer = setTimeout(() => {
        voice.cleanupTimer = null;
        voice.stop();
        try { voice.gain.disconnect(); } catch { /* already disconnected */ }
        if (this.voices.get(id) === voice) this.voices.delete(id);
      }, (CROSSFADE_SECONDS + 0.1) * 1000);
    }

    let voice = this.voices.get(zone);
    if (!voice) {
      const created = this.createBed(zone);
      if (!created) return;
      voice = { ...created, cleanupTimer: null };
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
    const scale = peak > 0 ? 0.5 / peak : 0;
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
    for (const voice of this.voices.values()) {
      if (voice.cleanupTimer !== null) clearTimeout(voice.cleanupTimer);
      voice.stop();
    }
    this.voices.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.ambienceGain = null;
    this.started = false;
  }
}
