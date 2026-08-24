import { describe, expect, it } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';
import { DEFAULT_PREFERENCES } from '../src/state/Preferences';

describe('muted-by-default audio manager', () => {
  it('keeps playback available but starts muted before a visitor gesture', () => {
    const audio = new AudioManager();

    audio.setZone('plaza');
    audio.dispose();

    expect(audio.isRunning).toBe(false);
    expect(DEFAULT_PREFERENCES.masterVolume).toBe(0);
    expect(DEFAULT_PREFERENCES.ambienceVolume).toBe(0);
  });
});
