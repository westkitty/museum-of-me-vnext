import { describe, expect, it } from 'vitest';
import { LongFrameRecorder } from '../src/app/LongFrameRecorder';

const entry = (startTime: number, duration: number, scripts: { duration: number; invoker: string; sourceURL: string }[] = []) =>
  ({ startTime, duration, blockingDuration: duration - 50, scripts, name: '', entryType: 'long-animation-frame', toJSON: () => ({}) });

describe('LongFrameRecorder', () => {
  it('attributes each long frame to the world, phase and longest script', () => {
    let world = 'exterior';
    const recorder = new LongFrameRecorder(() => ({ world, phase: 'PREPARING_INTERIOR' }));
    recorder.record(entry(10, 80, [
      { duration: 5, invoker: 'FrameRequestCallback', sourceURL: 'http://x/Loop.ts' },
      { duration: 70, invoker: 'MessagePort.onmessage', sourceURL: 'http://x/assets/Museum-abc.js?v=1' },
    ]));
    world = 'interior';
    recorder.record(entry(500, 60));
    expect(recorder.count).toBe(2);
    expect(recorder.recent[0]).toMatchObject({ world: 'exterior', durationMs: 80, blockingMs: 30 });
    expect(recorder.recent[0].script).toContain('MessagePort.onmessage 70ms');
    expect(recorder.recent[0].script).toContain('Museum-abc.js');
    expect(recorder.summary()).toBe('2, worst 80 ms (exterior/PREPARING_INTERIOR)');
  });

  it('keeps only the most recent 50 frames but counts them all', () => {
    const recorder = new LongFrameRecorder(() => ({ world: 'interior', phase: 'INTERIOR_ACTIVE' }));
    for (let i = 0; i < 70; i++) recorder.record(entry(i * 100, 51 + i));
    expect(recorder.count).toBe(70);
    expect(recorder.recent).toHaveLength(50);
    expect(recorder.recent[0].at).toBe(2000);
    expect(recorder.worstFrame?.durationMs).toBe(120);
  });
});
