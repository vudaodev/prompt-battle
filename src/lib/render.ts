import html2canvas from 'html2canvas';
import { CANVAS } from '../config';

/**
 * Render a self-contained HTML document to a fixed 400x300 canvas.
 *
 * Both the reference target and every attempt go through THIS function, so they
 * share one renderer — that symmetry is what makes a perfect reconstruction
 * actually hit 100% (design doc §5, §11).
 *
 * We use a sandboxed, same-origin srcdoc iframe so the agent's CSS is fully
 * isolated from the app (a stray `body { background }` can't nuke our UI), and
 * scripts cannot run. html2canvas then rasterizes the iframe's body.
 */
export async function renderHtmlToCanvas(html: string): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');
  iframe.width = String(CANVAS.width);
  iframe.height = String(CANVAS.height);
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.border = '0';
  // allow-same-origin (so we can read contentDocument) but NOT allow-scripts.
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.srcdoc = html;

  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });

    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Could not access iframe document');

    // Fonts/layout settle before snapshot (matters once text targets exist).
    try {
      await doc.fonts?.ready;
    } catch {
      /* fonts API may be unavailable; ignore */
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const raw = await html2canvas(doc.body, {
      width: CANVAS.width,
      height: CANVAS.height,
      windowWidth: CANVAS.width,
      windowHeight: CANVAS.height,
      backgroundColor: '#ffffff',
      scale: 1,
      logging: false,
    });

    return normalize(raw);
  } finally {
    document.body.removeChild(iframe);
  }
}

/** Force exact 400x300 regardless of devicePixelRatio quirks. */
function normalize(src: HTMLCanvasElement): HTMLCanvasElement {
  if (src.width === CANVAS.width && src.height === CANVAS.height) return src;
  const out = document.createElement('canvas');
  out.width = CANVAS.width;
  out.height = CANVAS.height;
  out.getContext('2d')!.drawImage(src, 0, 0, CANVAS.width, CANVAS.height);
  return out;
}

export function canvasPixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas
    .getContext('2d')!
    .getImageData(0, 0, CANVAS.width, CANVAS.height).data;
}
