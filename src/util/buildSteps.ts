/**
 * A construction routine split at safe resume points. Each bare `yield` marks
 * a boundary where the scene graph and collision are consistent, so the
 * caller may hand the frame back before continuing. Nothing is exposed as
 * finished until the generator returns.
 *
 * The same routine serves both build paths: `runStepsSync` drains it in one
 * call (the synchronous `build()` used by tests, tools and the standalone),
 * and `runStepsCooperatively` calls the caller's existing yield checkpoint at
 * every boundary (`EventLoopYieldBudget.checkpoint`, which only actually
 * yields once the current slice is spent, so a fine-grained boundary is free).
 */
export type BuildSteps<T = void> = Generator<void, T, void>;

export function runStepsSync<T>(steps: BuildSteps<T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/** Runs `steps`, yielding at each boundary. Reports CPU time spent inside the routine (yields excluded). */
export async function runStepsCooperatively<T>(
  steps: BuildSteps<T>,
  yieldControl: () => Promise<void>,
  onCpuMs?: (ms: number) => void,
): Promise<T> {
  let cpuMs = 0;
  let finished = false;
  try {
    for (;;) {
      const started = performance.now();
      const next = steps.next();
      cpuMs += performance.now() - started;
      if (next.done) {
        finished = true;
        return next.value;
      }
      await yieldControl();
    }
  } finally {
    onCpuMs?.(cpuMs);
    // A cancelled build (the yield rejected) still runs the routine's own finally blocks.
    if (!finished) steps.return(undefined as T);
  }
}
