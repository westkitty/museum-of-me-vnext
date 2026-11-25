import { isAbsolute, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import e2e from '../playwright.config';
import capture from '../playwright.capture.config';
import perf from '../playwright.perf.config';
import workshop from '../playwright.workshop.config';

// Playwright deletes everything inside outputDir when a run starts. A config
// whose outputDir is `test-results` (also the default when none is set) wipes
// evidence folders such as test-results/walkabout. This once happened.
const EVIDENCE_FOLDERS = ['walkabout', 'traversal', 'cinematic-review'];

describe('Playwright output directories cannot destroy evidence', () => {
  for (const [name, config] of Object.entries({ e2e, capture, perf, workshop })) {
    it(`${name} writes only into its own folder under test-results`, () => {
      const outputDir = (config as { outputDir?: string }).outputDir;
      expect(outputDir, `${name} must set outputDir explicitly`).toBeTruthy();
      const resolved = isAbsolute(outputDir!) ? outputDir! : resolve(process.cwd(), outputDir!);
      const inside = relative(resolve(process.cwd(), 'test-results'), resolved);
      expect(inside, `${name} outputDir must be a strict subfolder of test-results`).not.toBe('');
      expect(inside.startsWith('..')).toBe(false);
      const first = inside.split(/[\\/]/)[0];
      expect(EVIDENCE_FOLDERS).not.toContain(first);
    });
  }
});
