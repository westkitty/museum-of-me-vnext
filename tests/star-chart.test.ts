import { describe, expect, it } from 'vitest';
import { STAR_CHART_PIXELS, STAR_CHART_SIZE, drawStarChart } from '../src/workshop/StarChart';

const { width, height } = STAR_CHART_PIXELS;
const at = (pixels: Uint8Array, x: number, y: number) => {
  const i = (y * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]] as const;
};

describe('procedural star chart', () => {
  it('matches the physical sheet aspect', () => {
    expect(width / height).toBeCloseTo(STAR_CHART_SIZE.width / STAR_CHART_SIZE.height, 2);
  });

  it('is deterministic and opaque', () => {
    const a = drawStarChart();
    expect(a).toHaveLength(width * height * 4);
    expect(Buffer.from(drawStarChart()).equals(Buffer.from(a))).toBe(true);
    for (let i = 3; i < a.length; i += 4) if (a[i] !== 255) throw new Error(`transparent pixel at ${(i - 3) / 4}`);
  });

  it('draws a dark sky, a cream border and a real field of stars, not a blank sheet', () => {
    const pixels = drawStarChart();
    const [r, , b] = at(pixels, width >> 1, 40);
    expect(b).toBeGreaterThan(r); // deep blue paper
    const border = at(pixels, width >> 1, 5);
    expect(border[0]).toBeGreaterThan(180); // cream line
    // Near-white star pixels strictly inside the border.
    let bright = 0;
    for (let y = 12; y < height - 12; y++) for (let x = 12; x < width - 12; x++) {
      const [pr, pg, pb] = at(pixels, x, y);
      if (pr > 200 && pg > 200 && pb > 190) bright++;
    }
    expect(bright).toBeGreaterThan(150);
  });

  it('differs with the seed', () => {
    expect(Buffer.from(drawStarChart(width, height, 1)).equals(Buffer.from(drawStarChart(width, height, 2)))).toBe(false);
  });
});
