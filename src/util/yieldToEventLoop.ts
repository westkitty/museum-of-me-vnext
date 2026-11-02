/** Yield one main-thread task so the browser can paint and process input. */
export function yieldToEventLoop(): Promise<void> {
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(undefined);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Batches small synchronous build steps but yields before a slice grows long. */
export class EventLoopYieldBudget {
  private lastYieldAt = performance.now();

  constructor(private readonly maxSliceMs = 8) {}

  async checkpoint(): Promise<void> {
    if (performance.now() - this.lastYieldAt < this.maxSliceMs) return;
    await yieldToEventLoop();
    this.lastYieldAt = performance.now();
  }
}
