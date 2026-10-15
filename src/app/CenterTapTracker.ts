/** A short, single-finger center tap activates an exhibit; swipes and long holds never do. */
type Finger = Pick<Touch, 'identifier' | 'clientX' | 'clientY'>;
const MAX_TAP_MS = 1200;

export class CenterTapTracker {
  private candidate: { id: number; x: number; y: number; startedAt: number } | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  start(changed: ArrayLike<Finger>, count: number, width: number, height: number): void {
    if (count !== 1 || changed.length !== 1) { this.cancel(); return; }
    const finger = changed[0];
    if (Math.hypot(finger.clientX - width / 2, finger.clientY - height / 2) > 90) {
      this.cancel();
      return;
    }
    this.candidate = { id: finger.identifier, x: finger.clientX, y: finger.clientY, startedAt: this.now() };
  }

  move(changed: ArrayLike<Finger>, count: number): void {
    if (count !== 1) { this.cancel(); return; }
    const candidate = this.candidate;
    if (!candidate) return;
    for (let i = 0; i < changed.length; i++) {
      const finger = changed[i];
      if (finger.identifier === candidate.id && Math.hypot(finger.clientX - candidate.x, finger.clientY - candidate.y) > 18) {
        this.cancel();
      }
    }
  }

  end(changed: ArrayLike<Finger>): boolean {
    const candidate = this.candidate;
    this.cancel();
    if (!candidate) return false;
    for (let i = 0; i < changed.length; i++) {
      const finger = changed[i];
      if (finger.identifier === candidate.id) {
        const elapsed = this.now() - candidate.startedAt;
        return elapsed >= 0 && elapsed <= MAX_TAP_MS
          && Math.hypot(finger.clientX - candidate.x, finger.clientY - candidate.y) <= 18;
      }
    }
    return false;
  }

  cancel(): void { this.candidate = null; }
}
