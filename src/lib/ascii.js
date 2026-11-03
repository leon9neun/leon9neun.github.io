// ---- Shared settings and helpers for the ASCII drawings (globe.js and photo.js) ----
// Ramp from empty to dense. Other ramps tried before:
// " .:-=+*#%@"
// " ◇◈♦⯁"
// " .:+*#%@0368"
export const RAMP = ' ⬩⬦◇◈⯁';
export const DENSE_FROM = 4; // ramp index from which a glyph uses the main color, lighter ones the dim color
const NOISE_CHARS = ".,'`:;"; // noise in the background
const GRAIN = 0.01; // strength of the noise on the glyphs (0-1)
const SPECKS = 0.001; // share of random specks in the background
export const GRAIN_FPS = 5; // speed of the grain
const BACKGROUND_COVERAGE = 0.04; // cells below this value count as background

// Fallback colors, made for a dark page. The components set --ascii-ink and --ascii-ink-dim.
const FALLBACK_COLOR = '#d8d4d4';
const FALLBACK_COLOR_DIM = '#6d6a63';

/**
 * Reads the two colors of a drawing from the CSS custom properties of the canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ color: string, colorDim: string }}
 */
export function readColors(canvas) {
  const style = getComputedStyle(canvas);
  return {
    color: style.getPropertyValue('--ascii-ink').trim() || FALLBACK_COLOR,
    colorDim: style.getPropertyValue('--ascii-ink-dim').trim() || FALLBACK_COLOR_DIM,
  };
}

/**
 * Averages the brightness of the offscreen canvas per ASCII cell (0-1).
 * @returns {Float32Array}
 */
export function sampleCoverage(off, cols, rows, cellW, cellH) {
  const W = off.width;
  const H = off.height;
  const data = off.getContext('2d').getImageData(0, 0, W, H).data;
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellW);
      const x1 = Math.min(W, Math.floor((c + 1) * cellW));
      const y0 = Math.floor(r * cellH);
      const y1 = Math.min(H, Math.floor((r + 1) * cellH));
      let sum = 0;
      let n = 0;
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          sum += data[(py * W + px) * 4];
          n++;
        }
      }
      out[r * cols + c] = n ? sum / n / 255 : 0;
    }
  }
  return out;
}

export function makeOffscreen(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  return off;
}

/**
 * One ASCII layer = a canvas plus a brightness map that is drawn with grain.
 * @param {HTMLCanvasElement} canvas
 */
export function createLayer(canvas) {
  const { color, colorDim } = readColors(canvas);
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    cols: 0,
    rows: 0,
    cellW: 0,
    cellH: 0,
    coverage: null,
    color,
    colorDim,
  };
}

/**
 * Sets the font of the ASCII drawings on a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} fontSize - in px, a cell is 0.6 times as wide and as high as the font size
 */
export function applyFont(ctx, fontSize) {
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = 'top';
}

export function setupLayer(layer, cols, rows, fontSize) {
  const dpr = window.devicePixelRatio || 1;
  layer.cols = cols;
  layer.rows = rows;
  layer.cellW = fontSize * 0.6;
  layer.cellH = fontSize;

  const { canvas, ctx } = layer;
  canvas.style.width = `${cols * layer.cellW}px`;
  canvas.style.height = `${rows * layer.cellH}px`;
  canvas.width = Math.round(cols * layer.cellW * dpr);
  canvas.height = Math.round(rows * layer.cellH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  applyFont(ctx, fontSize);
}

/**
 * Draws the brightness map of a layer, with grain.
 * @param {number} flicker - overall brightness, around 1
 */
export function drawLayer(layer, flicker) {
  const { ctx, canvas, cols, rows, cellW, cellH, coverage, color, colorDim } = layer;
  if (!coverage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const last = RAMP.length - 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = coverage[r * cols + c];
      let ch;
      let fill = color;

      if (v < BACKGROUND_COVERAGE) {
        // background: only a few static specks
        if (Math.random() > SPECKS) continue;
        ch = NOISE_CHARS[(Math.random() * NOISE_CHARS.length) | 0];
        fill = colorDim;
      } else {
        const noise = (Math.random() - 0.5) * GRAIN;
        const value = Math.min(1, Math.max(0, (v + noise) * flicker));
        const index = Math.round(value * last);
        if (index === 0) continue;
        ch = RAMP[index];
        if (index < DENSE_FROM) fill = colorDim;
      }

      ctx.fillStyle = fill;
      ctx.fillText(ch, c * cellW, r * cellH);
    }
  }
}

/**
 * Calls update() at most `fps` times per second while the loop runs.
 * @param {(deltaSeconds: number) => void} update - delta is capped at 0.1s
 * @param {number} fps
 * @returns {{ start: () => void, stop: () => void }}
 */
export function createLoop(update, fps) {
  let frameId = 0;
  let last = 0;

  function frame(time) {
    frameId = requestAnimationFrame(frame);
    const delta = (time - last) / 1000;
    if (delta < 1 / fps - 0.002) return;
    last = time;
    update(Math.min(delta, 0.1));
  }

  return {
    start() {
      if (frameId !== 0) return;
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(frameId);
      frameId = 0;
    },
  };
}

/**
 * Calls onChange(isVisible) when the element enters or leaves the viewport.
 * @returns {() => void} stops observing
 */
export function observeVisibility(element, onChange) {
  const observer = new IntersectionObserver((entries) => {
    onChange(entries.some((entry) => entry.isIntersecting));
  });
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Calls onResize(width) when the width of the element changes (debounced). Also once at the start.
 * @returns {() => void} stops observing
 */
export function observeWidth(element, onResize) {
  let timer = 0;
  let lastWidth = -1;
  const observer = new ResizeObserver(() => {
    const width = element.clientWidth;
    if (width === lastWidth) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastWidth = element.clientWidth;
      onResize(lastWidth);
    }, 100);
  });
  observer.observe(element);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}
