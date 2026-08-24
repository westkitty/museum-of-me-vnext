import { describe, expect, it } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';

describe('temporary silent audio manager', () => {
  it('never starts playback while callers retain a safe lifecycle contract', () => {
    const audio = new AudioManager();

    audio.setZone('plaza');
    audio.setZone('north');
    audio.dispose();

    expect(audio.isRunning).toBe(false);
  });
});
