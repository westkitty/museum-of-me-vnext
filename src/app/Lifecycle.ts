import type { Loop } from './Loop';
import type { InputManager } from '../player/Input';
import type { RendererHost } from '../render/RendererHost';
import type { VisitorPreferences } from '../state/Preferences';
import { CONTEXT_RESTORE_PATIENCE_S, PauseNotice, pauseNoticeFor } from '../ui/PauseNotice';

/**
 * One coherent lifecycle owner. The Loop remains the only rAF owner; this class
 * only starts, stops, and recovers it.
 */
export class Lifecycle {
  private hidden = false;
  private online = typeof navigator === 'undefined' || navigator.onLine !== false;
  private wakeLock: WakeLockSentinel | null = null;
  /** A wake-lock request still in flight; a second sync waits for it instead of requesting another. */
  private wakeLockRequest: Promise<void> | null = null;
  private lastDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  private listeners: Array<() => void> = [];
  notice: string | null = null;
  contextLost = false;
  contextRestored = false;
  /** Visible, persistent notice while the 3D view cannot render. */
  private pauseNotice: PauseNotice | null = null;
  private patienceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly loop: Loop,
    private readonly input: InputManager,
    private readonly renderer: RendererHost,
    private readonly prefs: () => VisitorPreferences,
    private readonly onNotice: (message: string) => void,
    private readonly canResume: () => boolean = () => true,
    private readonly onInterrupted: (reason: string) => void = () => {},
  ) {
    this.listen(document, 'visibilitychange', () => this.onVisibility());
    this.listen(window, 'pagehide', () => this.suspend('pagehide'));
    this.listen(window, 'pageshow', () => this.resume('pageshow'));
    this.listen(window, 'freeze', () => this.suspend('freeze'));
    this.listen(window, 'resume', () => this.resume('resume'));
    this.listen(window, 'online', () => { this.online = true; this.note('Network connection restored. The museum does not require it.'); });
    this.listen(window, 'offline', () => { this.online = false; this.note('Browser offline. The museum remains available locally.'); });
    this.listen(window, 'orientationchange', () => {
      // A finger on the virtual stick when the screen rotates keeps its old
      // origin in a layout that no longer exists, and the stick walks on by
      // itself. Rotation ends every gesture; the next touch starts fresh.
      this.input.resetTransient();
      this.renderer.resize();
    });
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
      // Recorded for diagnostics; the visitor sees and hears the alert below
      // instead of a transient subtitle that could not time out anyway (the
      // HUD's own timer runs on the stopped loop).
      this.notice = 'WebGL context lost. Waiting for restoration.';
      this.showPause(0);
      this.clearPatience();
      this.patienceTimer = setTimeout(() => {
        this.patienceTimer = null;
        if (this.contextLost) this.showPause(CONTEXT_RESTORE_PATIENCE_S);
      }, CONTEXT_RESTORE_PATIENCE_S * 1000);
    });
    this.listen(canvas, 'webglcontextrestored', () => {
      this.contextLost = false;
      this.contextRestored = true;
      this.clearPatience();
      this.pauseNotice?.show(null);
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

  /**
   * Hold exactly one screen wake lock while the preference asks for it.
   * Called on every preference change (each slider step), so it must be
   * idempotent: previously every call requested a fresh sentinel and dropped
   * the old one unreleased, so turning the setting off released only the
   * last and the screen stayed awake.
   */
  async syncWakeLock(): Promise<void> {
    if (this.wakeLockRequest) await this.wakeLockRequest;
    if (!this.wantsWakeLock()) {
      await this.releaseWakeLock();
      return;
    }
    if (this.wakeLock && !this.wakeLock.released) return;
    this.wakeLockRequest = (async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        sentinel.addEventListener('release', () => { if (this.wakeLock === sentinel) this.wakeLock = null; });
        this.wakeLock = sentinel;
      } catch {
        this.wakeLock = null;
      }
    })();
    try { await this.wakeLockRequest; } finally { this.wakeLockRequest = null; }
    // The preference may have been switched off (or the page hidden) while the request was in flight.
    if (!this.wantsWakeLock()) await this.releaseWakeLock();
  }

  private wantsWakeLock(): boolean {
    return this.prefs().wakeLock && !this.hidden && typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  /** True while the visible paused-view notice is up. */
  get pauseNoticeVisible(): boolean {
    return this.pauseNotice?.visible ?? false;
  }

  private showPause(lostForSeconds: number): void {
    const content = pauseNoticeFor({ contextLost: this.contextLost, lostForSeconds });
    if (!content && !this.pauseNotice) return;
    if (!this.pauseNotice && typeof document !== 'undefined') {
      this.pauseNotice = new PauseNotice(document.getElementById('ui-root') ?? document.body);
    }
    this.pauseNotice?.show(content);
  }

  private clearPatience(): void {
    if (this.patienceTimer !== null) clearTimeout(this.patienceTimer);
    this.patienceTimer = null;
  }

  dispose(): void {
    this.clearPatience();
    this.pauseNotice?.dispose();
    this.pauseNotice = null;
    void this.releaseWakeLock();
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  private onVisibility(): void {
    if (document.hidden) {
      if (this.prefs().autoPauseOnBlur) this.suspend('hidden');
      else this.onInterrupted('hidden');
      void this.releaseWakeLock();
    } else {
      this.resume('visible');
      void this.syncWakeLock();
    }
  }

  private suspend(reason: string): void {
    this.hidden = reason === 'hidden' || reason === 'freeze' || reason === 'pagehide' || this.hidden;
    this.loop.stop();
    this.onInterrupted(reason);
    this.input.resetTransient();
  }

  private resume(reason: string): void {
    // 'contextrestored' means the GPU handed the WebGL context back, which is
    // not tied to page visibility -- it can fire while the tab is still
    // backgrounded. Unconditionally clearing `hidden` (and, since contextLost
    // would then be false, starting the loop below) restarted simulation and
    // rendering while the document was still hidden, defeating autoPauseOnBlur
    // until the next real visibility event happened to correct it.
    if (reason !== 'contextrestored') this.hidden = false;
    if (!this.contextLost && !this.hidden && this.canResume() && !this.loop.isRunning) this.loop.start();
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
