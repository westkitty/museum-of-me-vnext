import { describe, it, expect, vi } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';

function disposable() {
  return { dispose: vi.fn() };
}

describe('ResourceScope', () => {
  it('tracks and returns the resource unchanged', () => {
    const scope = new ResourceScope('t');
    const r = disposable();
    expect(scope.track(r)).toBe(r);
    expect(scope.size).toBe(1);
  });

  it('ignores non-disposable values', () => {
    const scope = new ResourceScope('t');
    scope.track(42);
    scope.track({ notDisposable: true });
    expect(scope.size).toBe(0);
  });

  it('drains to zero on dispose', () => {
    const scope = new ResourceScope('t');
    const a = disposable();
    const b = disposable();
    scope.trackAll(a, b);
    expect(scope.size).toBe(2);
    scope.dispose();
    expect(a.dispose).toHaveBeenCalledOnce();
    expect(b.dispose).toHaveBeenCalledOnce();
    expect(scope.size).toBe(0);
    expect(scope.isDisposed).toBe(true);
  });

  it('is idempotent', () => {
    const scope = new ResourceScope('t');
    const a = disposable();
    scope.track(a);
    scope.dispose();
    scope.dispose();
    expect(a.dispose).toHaveBeenCalledOnce();
  });

  it('refuses to track after disposal', () => {
    const scope = new ResourceScope('t');
    scope.dispose();
    expect(() => scope.track(disposable())).toThrow(/after dispose/);
  });

  it('survives a resource that throws on dispose', () => {
    const scope = new ResourceScope('t');
    const bad = { dispose: () => { throw new Error('boom'); } };
    const good = disposable();
    scope.trackAll(bad, good);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    scope.dispose();
    expect(good.dispose).toHaveBeenCalledOnce();
    expect(scope.size).toBe(0);
  });

  it('releaseAll empties without closing the scope', () => {
    const scope = new ResourceScope('t');
    scope.track(disposable());
    scope.releaseAll();
    expect(scope.size).toBe(0);
    expect(scope.isDisposed).toBe(false);
    scope.track(disposable());
    expect(scope.size).toBe(1);
  });
});
