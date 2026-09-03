import * as THREE from 'three';
import type { ResourceScope } from './ResourceScope';

export interface TextTextureOptions {
  readonly width?: number;
  readonly height?: number;
  readonly background?: string;
  readonly color?: string;
  readonly title?: string;
  readonly titleColor?: string;
  readonly titleSize?: number;
  readonly bodySize?: number;
  readonly padding?: number;
  readonly align?: 'left' | 'center';
  readonly rule?: boolean;
  readonly font?: string;
}

/**
 * World-space text, drawn to a canvas and uploaded as a texture.
 *
 * Every plaque and lectern in the museum is built with this. It is the visual
 * half of the accessibility contract — the DOM mirror carries the same words,
 * so atmosphere never costs readability (plan §31).
 */
export function createTextTexture(
  scope: ResourceScope,
  paragraphs: readonly string[],
  opts: TextTextureOptions = {},
): THREE.CanvasTexture {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 512;
  const padding = opts.padding ?? 56;
  const bodySize = opts.bodySize ?? 30;
  const titleSize = opts.titleSize ?? 46;
  const font = opts.font ?? 'Georgia, "Iowan Old Style", serif';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot render museum text');

  ctx.fillStyle = opts.background ?? '#efe8d8';
  ctx.fillRect(0, 0, width, height);

  const align = opts.align ?? 'left';
  ctx.textAlign = align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'top';
  const x = align === 'center' ? width / 2 : padding;
  let y = padding;

  if (opts.title) {
    ctx.fillStyle = opts.titleColor ?? '#241d14';
    ctx.font = `600 ${titleSize}px ${font}`;
    y = drawWrapped(ctx, opts.title, x, y, width - padding * 2, titleSize * 1.15, align, width);
    y += 14;
    if (opts.rule !== false) {
      ctx.fillStyle = '#b39b52';
      const ruleWidth = align === 'center' ? (width - padding * 2) * 0.4 : width - padding * 2;
      ctx.fillRect(align === 'center' ? (width - ruleWidth) / 2 : padding, y, ruleWidth, 3);
      y += 26;
    }
  }

  ctx.fillStyle = opts.color ?? '#2e2619';
  ctx.font = `${bodySize}px ${font}`;
  for (const paragraph of paragraphs) {
    y = drawWrapped(ctx, paragraph, x, y, width - padding * 2, bodySize * 1.42, align, width);
    y += bodySize * 0.7;
    if (y > height - padding) break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return scope.track(texture);
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: 'left' | 'center',
  canvasWidth: number,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;
  const drawX = align === 'center' ? canvasWidth / 2 : x;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, drawX, cursorY);
      cursorY += lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    ctx.fillText(line, drawX, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

/**
 * A texture with no DOM dependency, for tests and headless builds. Returns a
 * 1×1 data texture so exhibit construction can be exercised without a browser.
 */
export function createFallbackTexture(scope: ResourceScope, color = 0xefe8d8): THREE.DataTexture {
  const data = new Uint8Array([(color >> 16) & 255, (color >> 8) & 255, color & 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return scope.track(tex);
}

/** True when canvas text rendering is available in this environment. */
export function canRenderText(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}
