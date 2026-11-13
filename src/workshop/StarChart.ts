import * as THREE from 'three';

/** Physical size of the star chart sheet, in metres. */
export const STAR_CHART_SIZE = { width: 0.86, height: 0.66, thickness: 0.004 } as const;

/** Texture resolution; the aspect matches the physical sheet. */
export const STAR_CHART_PIXELS = { width: 512, height: 393 } as const;

type Rgb = readonly [number, number, number];
const PAPER: Rgb = [14, 26, 52];
const GRID: Rgb = [46, 74, 120];
const BORDER: Rgb = [216, 201, 163];
const FIGURE: Rgb = [214, 184, 112];
const STAR: Rgb = [246, 242, 228];

/** Small deterministic PRNG (mulberry32) so every build draws the same sky. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws a celestial chart into RGBA pixels: deep-blue paper, declination
 * circles and hour lines, a field of stars of varied brightness, a few
 * constellation figures joining real stars of the field, and a cream double
 * border. Pure function of its size and seed: no DOM, fonts or network.
 */
export function drawStarChart(width: number = STAR_CHART_PIXELS.width, height: number = STAR_CHART_PIXELS.height,
  seed = 0x5ea7c4a7): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  const blend = (x: number, y: number, color: Rgb, alpha: number) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height || alpha <= 0) return;
    const i = (py * width + px) * 4;
    const a = Math.min(1, alpha);
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c] * (1 - a) + color[c] * a);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: Rgb, alpha: number) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let s = 0; s <= steps; s++) blend(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, color, alpha);
  };
  const disc = (cx: number, cy: number, radius: number, color: Rgb, alpha: number) => {
    const r = Math.ceil(radius + 1);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x, y)));
      blend(cx + x, cy + y, color, alpha * coverage);
    }
  };

  // Paper, slightly lighter toward the centre.
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(cx, cy);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const glow = 1 + 0.35 * (1 - Math.hypot(x - cx, y - cy) / reach);
    const i = (y * width + x) * 4;
    pixels[i] = Math.min(255, Math.round(PAPER[0] * glow));
    pixels[i + 1] = Math.min(255, Math.round(PAPER[1] * glow));
    pixels[i + 2] = Math.min(255, Math.round(PAPER[2] * glow));
    pixels[i + 3] = 255;
  }

  // Declination circles and hour lines around the pole.
  const radius = Math.min(width, height) * 0.46;
  for (let ring = 1; ring <= 4; ring++) {
    const r = (radius * ring) / 4;
    const steps = Math.ceil(2 * Math.PI * r * 2);
    for (let s = 0; s < steps; s++) {
      const angle = (2 * Math.PI * s) / steps;
      blend(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, GRID, 0.75);
    }
  }
  for (let hour = 0; hour < 12; hour++) {
    const angle = (Math.PI * hour) / 6;
    line(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, GRID, 0.55);
  }

  // Star field.
  const rand = random(seed);
  const stars: { x: number; y: number; magnitude: number }[] = [];
  const margin = 14;
  for (let n = 0; n < 220; n++) {
    const magnitude = rand() ** 2.4; // mostly faint, a few bright
    stars.push({ x: margin + rand() * (width - 2 * margin), y: margin + rand() * (height - 2 * margin), magnitude });
  }

  // Constellation figures: chains through nearby bright stars, drawn under the stars.
  const bright = stars.filter((star) => star.magnitude > 0.35);
  const used = new Set<number>();
  for (let figure = 0; figure < 5 && bright.length > 0; figure++) {
    let current = Math.floor(rand() * bright.length);
    if (used.has(current)) continue;
    used.add(current);
    for (let link = 0; link < 4; link++) {
      let next = -1;
      let best = Infinity;
      bright.forEach((star, index) => {
        if (used.has(index)) return;
        const d = Math.hypot(star.x - bright[current].x, star.y - bright[current].y);
        if (d > 12 && d < 120 && d < best) { best = d; next = index; }
      });
      if (next < 0) break;
      line(bright[current].x, bright[current].y, bright[next].x, bright[next].y, FIGURE, 0.7);
      used.add(next);
      current = next;
    }
  }

  for (const star of stars) {
    const size = 0.6 + star.magnitude * 2.6;
    if (star.magnitude > 0.5) disc(star.x, star.y, size + 2.2, STAR, 0.12); // halo
    disc(star.x, star.y, size, STAR, 0.55 + star.magnitude * 0.45);
  }

  // Cream double border.
  for (const inset of [5, 9]) {
    line(inset, inset, width - 1 - inset, inset, BORDER, 0.95);
    line(inset, height - 1 - inset, width - 1 - inset, height - 1 - inset, BORDER, 0.95);
    line(inset, inset, inset, height - 1 - inset, BORDER, 0.95);
    line(width - 1 - inset, inset, width - 1 - inset, height - 1 - inset, BORDER, 0.95);
  }
  return pixels;
}

/** The chart as a colour texture; the caller owns disposal. */
export function createStarChartTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(drawStarChart(), STAR_CHART_PIXELS.width, STAR_CHART_PIXELS.height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
