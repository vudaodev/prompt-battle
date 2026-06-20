import pixelmatch from 'pixelmatch';
import { CANVAS, MAX_PROMPTS } from '../config';

export interface DiffResult {
  /** raw pixel-diff accuracy, 0..1 (shown to the player) */
  accuracy: number;
  mismatched: number;
  /** magenta diff pixels on a transparent canvas, for the overlay */
  diffCanvas: HTMLCanvasElement;
}

/**
 * PNG-vs-PNG comparison (design doc §5). `reference` and `attempt` are both
 * RGBA pixel buffers from the same 400x300 renderer.
 */
export function computeDiff(
  reference: Uint8ClampedArray,
  attempt: Uint8ClampedArray,
  threshold: number,
): DiffResult {
  const { width, height } = CANVAS;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  const ctx = diffCanvas.getContext('2d')!;
  const out = ctx.createImageData(width, height);

  const mismatched = pixelmatch(reference, attempt, out.data, width, height, {
    threshold,
    includeAA: false,
    diffMask: true, // only diff pixels are written; rest stays transparent
    diffColor: [255, 43, 214], // brand magenta
  });

  ctx.putImageData(out, 0, 0);
  const accuracy = 1 - mismatched / (width * height);
  return { accuracy, mismatched, diffCanvas };
}

/**
 * Score = 1000 · A^gamma · (1 − lambda·(P − 1))   (design doc §3, locked)
 * A^gamma is applied only here, at scoring time; raw A is shown to the player.
 */
export function computeScore(
  accuracy: number,
  promptsUsed: number,
  gamma: number,
  lambda: number,
): number {
  const p = Math.min(MAX_PROMPTS, Math.max(1, promptsUsed));
  const multiplier = 1 - lambda * (p - 1);
  const value = 1000 * Math.pow(Math.max(0, accuracy), gamma) * multiplier;
  return Math.max(0, Math.round(value));
}
