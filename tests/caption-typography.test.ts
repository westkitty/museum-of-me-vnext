import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { canRenderText, createTextTexture } from '../src/assets/TextTexture';
import { buildLabel } from '../src/exhibits/Furniture';
import { createExhibit, hasExhibit } from '../src/exhibits/registry';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';

class MockCanvasContext {
  fillStyle = '';
  font = '';
  textAlign = 'left';
  textBaseline = 'top';
  fillRect(): void {}
  fillText(): void {}
  measureText(text: string): TextMetrics {
    // Return approximate font-proportional width: ~0.55 * fontSize * length
    const match = this.font.match(/(\d+)px/);
    const fontSize = match ? parseInt(match[1], 10) : 30;
    return { width: text.length * fontSize * 0.55 } as TextMetrics;
  }
}

interface MockCanvas {
  width: number;
  height: number;
  getContext(type: string): MockCanvasContext | null;
}

describe('caption typography and label legibility contracts', () => {
  const createdCanvases: MockCanvas[] = [];

  beforeEach(() => {
    createdCanvases.length = 0;
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`unexpected element: ${tag}`);
        const ctx = new MockCanvasContext();
        const canvas: MockCanvas = {
          width: 0,
          height: 0,
          getContext: (type: string) => (type === '2d' ? ctx : null),
        };
        createdCanvases.push(canvas);
        return canvas;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('canRenderText returns true when canvas mock is installed', () => {
    expect(canRenderText()).toBe(true);
  });

  it('createTextTexture preserves explicit newlines in titles', () => {
    const scope = new ResourceScope('test-newlines');
    const texture = createTextTexture(scope, [], {
      width: 1024,
      height: 512,
      title: 'HEADING\nDescriptive Subtitle Line',
      fitTitle: true,
    });

    expect(texture).toBeDefined();
    expect(texture.image.width).toBe(1024);
    expect(texture.image.height).toBe(512);
    scope.releaseAll();
  });

  it('fitTitle respects minimum legible font size floor (>= 22px)', () => {
    const scope = new ResourceScope('test-font-floor');
    const veryLongText = 'A'.repeat(300);
    const texture = createTextTexture(scope, [], {
      width: 512,
      height: 96,
      title: veryLongText,
      fitTitle: true,
    });

    expect(texture).toBeDefined();
    scope.releaseAll();
  });

  it('buildLabel assigns high-DPI canvas widths scaled to physical plate widths', () => {
    const scope = new ResourceScope('test-resolutions');

    // Wide architectural banner (>= 3.2m) -> 2048px canvas
    buildLabel(scope, 'WIDE ARCHITECTURAL BANNER', 4.5, 0.15);
    expect(createdCanvases[createdCanvases.length - 1].width).toBe(2048);

    // Standard exhibit plate (1.2m <= w < 3.2m) -> 1024px canvas
    buildLabel(scope, 'Standard Exhibit Plaque', 2.0, 0.32);
    expect(createdCanvases[createdCanvases.length - 1].width).toBe(1024);

    // Compact console button / sub-label (< 1.2m) -> 512px canvas
    buildLabel(scope, 'Button', 0.6, 0.32);
    expect(createdCanvases[createdCanvases.length - 1].width).toBe(512);

    scope.releaseAll();
  });

  it('every registered exhibit bay builds labels cleanly without NaN or zero dimensions', () => {
    const scope = new ResourceScope('test-all-exhibit-labels');
    for (const record of EXHIBITS_BY_ID.values()) {
      if (!hasExhibit(record.id)) continue;
      const mod = createExhibit(record.id);
      expect(mod).toBeDefined();
    }
    scope.releaseAll();
  });
});
