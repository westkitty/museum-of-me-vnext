import type { Loop } from './Loop';
import type { InputManager } from '../player/Input';
import type { RendererHost } from '../render/RendererHost';
import type { VisitorPreferences } from '../state/Preferences';

/**
 * One coherent lifecycle owner. The Loop remains the only rAF owner; this class
 * only starts, stops, and recovers it.
 */
export class Lifecycle {
  private hidden = false;
  private online = typeof navigator === 'undefined' || navigator.onLine !== false;
  private wakeLock: WakeLockSentinel | null = null;
  private lastDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  private listeners: Array<() => void> = [];
  notice: string | null = null;
  contextLost = false;
  contextRestored = false;

  constructor(
    private readonly loop: Loop,
    private readonly input: InputManager,
    private readonly renderer: RendererHost,
    private readonly prefs: () => VisitorPreferences,
    private readonly onNotice: (message: string) => void,
  ) {
    this.listen(document, 'visibilitychange', () => this.onVisibility());
    this.listen(window, 'pagehide', () => this.suspend('pagehide'));
    this.listen(window, 'pageshow', () => this.resume('pageshow'));
    this.listen(window, 'freeze', () => this.suspend('freeze'));
    this.listen(window, 'resume', () => this.resume('resume'));
    this.listen(window, 'online', () => { this.online = true; this.note('Network connection restored. The museum does not require it.'); });
    this.listen(window, 'offline', () => { this.online = false; this.note('Browser offline. The museum remains available locally.'); });
    this.listen(window, 'orientationchange', () => this.renderer.resize());
    this.listen(window, 'resize', () => {
      const dpr = window.devicePixelRatio;
      if (Math.abs(dpr - this.lastDpr) > 0.01) {
        this.lastDpr = dpr;
        this.renderer.resize();
      }
    });
    this.listen(document, 'pointerlockchange', () => {
      if (!document.pointerLockElement && this.prefs().autoPauseOnBlur && !this.input.uiCaptured) {
        /* look is released; movement remains keyboard-usable */
      }
    });
    const canvas = this.renderer.canvas;
    this.listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.contextRestored = false;
      this.suspend('contextlost');
      this.note('WebGL context lost. Waiting for restoration.');
    });
    this.listen(canvas, 'webglcontextrestored', () => {
      this.contextLost = false;
      this.contextRestored = true;
      this.renderer.resize();
      this.resume('contextrestored');
      this.note('WebGL context restored. Rendering resumed.');
    });
    void this.syncWakeLock();
  }

  get isOnline(): boolean {
    return this.online;
  }

  get isSuspended(): boolean {
    return this.hidden || this.contextLost;
  }

  async syncWakeLock(): Promise<void> {
    const want = this.prefs().wakeLock && !this.hidden && typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    if (!want) {
      await this.releaseWakeLock();
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
    } catch {
      this.wakeLock = null;
    }
  }

  dispose(): void {
    void this.releaseWakeLock();
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  private onVisibility(): void {
    if (document.hidden) {
      if (this.prefs().autoPauseOnBlur) this.suspend('hidden');
      void this.releaseWakeLock();
    } else {
      this.resume('visible');
      void this.syncWakeLock();
    }
  }

  private suspend(reason: string): void {
    this.hidden = reason === 'hidden' || reason === 'freeze' || reason === 'pagehide' || this.hidden;
    this.loop.stop();
    this.input.resetTransient();
  }

  private resume(reason: string): void {
    this.hidden = false;
    if (!this.contextLost && !this.loop.isRunning) this.loop.start();
    void reason;
  }

  private async releaseWakeLock(): Promise<void> {
    try { await this.wakeLock?.release(); } catch { /* already released */ }
    this.wakeLock = null;
  }

  private note(message: string): void {
    this.notice = message;
    this.onNotice(message);
  }

  private listen(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.listeners.push(() => target.removeEventListener(type, handler));
  }
}
