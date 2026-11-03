import {
  GRAIN_FPS,
  createLayer,
  setupLayer,
  makeOffscreen,
  sampleCoverage,
  drawLayer,
  createLoop,
  observeVisibility,
  observeWidth,
} from './ascii.js';

// ---- Photo ------------------------------------------------------------
const PHOTO_MAX_WIDTH = 1048; // maximum width of the photo in px
const PHOTO_FONT_SIZE = 8; // size of the characters: smaller = more characters = more detail
const PHOTO_SHARPEN = 5; // edge sharpness / local contrast (0 = off)
const PHOTO_SHARPEN_RADIUS = 3; // radius of the sharpening in cells
const PHOTO_GAMMA = 1; // < 1 = lighter midtones, > 1 = darker
const PHOTO_INVERT = true; // true: dark areas become dense (many characters), light areas stay empty

/**
 * Draws a photo as characters on a canvas, with a slow grain. The image is only loaded
 * once the canvas comes into view.
 * @param {HTMLCanvasElement} canvas - its parent decides how wide the photo can get
 * @param {{ src: string, isStatic?: boolean }} options - `isStatic` draws one frame without grain
 * @returns {() => void} stops the drawing and removes its observers
 */
export function initPhoto(canvas, { src, isStatic = false }) {
  const container = canvas.parentElement;
  const photo = createLayer(canvas);
  const image = new Image();
  let isLoaded = false;
  let isVisible = false;
  let hasStartedLoading = false;

  const loop = createLoop(() => drawLayer(photo, flicker()), GRAIN_FPS);
  const stopObservingWidth = observeWidth(container, resize);
  const stopObservingVisibility = observeVisibility(canvas, handleVisibility);

  image.onload = () => {
    isLoaded = true;
    resize(container.clientWidth);
  };
  image.onerror = () => {
    if (import.meta.env.DEV) console.error(`Image not found: ${src}`);
  };

  if (!isStatic) document.addEventListener('visibilitychange', updateLoop);

  // slight overall flicker, 0.94 to 1
  function flicker() {
    return 0.94 + Math.random() * 0.06;
  }

  function handleVisibility(isInView) {
    isVisible = isInView;
    if (isInView && !hasStartedLoading) {
      hasStartedLoading = true;
      image.src = src;
    }
    updateLoop();
  }

  function updateLoop() {
    if (isStatic) return;
    if (isVisible && !document.hidden && isLoaded) loop.start();
    else loop.stop();
  }

  function resize(containerWidth) {
    if (!isLoaded || containerWidth === 0) return;
    const width = Math.min(containerWidth, PHOTO_MAX_WIDTH);
    const cols = Math.floor(width / (PHOTO_FONT_SIZE * 0.6));
    const rows = Math.round(
      (cols * PHOTO_FONT_SIZE * 0.6 * (image.naturalHeight / image.naturalWidth)) / PHOTO_FONT_SIZE,
    );
    setupLayer(photo, cols, rows, PHOTO_FONT_SIZE);

    const W = Math.round(cols * photo.cellW);
    const H = Math.round(rows * photo.cellH);
    const off = makeOffscreen(W, H);
    const context = off.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, W, H);
    // convert to grayscale (the red channel is read in sampleCoverage)
    const pixels = context.getImageData(0, 0, W, H);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
    }
    context.putImageData(pixels, 0, 0);

    let coverage;
    try {
      coverage = sampleCoverage(off, cols, rows, photo.cellW, photo.cellH);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Image could not be read.', error);
      return;
    }

    if (PHOTO_INVERT) for (let i = 0; i < coverage.length; i++) coverage[i] = 1 - coverage[i];

    // stretch the contrast (2nd to 98th percentile), so the whole character range is used
    const sorted = Float32Array.from(coverage).sort();
    const low = sorted[Math.floor(sorted.length * 0.02)];
    const high = sorted[Math.floor(sorted.length * 0.98)];
    for (let i = 0; i < coverage.length; i++) {
      coverage[i] = Math.min(1, Math.max(0, (coverage[i] - low) / (high - low || 1)));
    }

    // sharpen the local contrast (unsharp mask): brings out edges, window grids and details
    if (PHOTO_SHARPEN > 0) {
      const blurred = boxBlur(coverage, cols, rows, PHOTO_SHARPEN_RADIUS);
      for (let i = 0; i < coverage.length; i++) {
        coverage[i] = Math.min(1, Math.max(0, coverage[i] + PHOTO_SHARPEN * (coverage[i] - blurred[i])));
      }
    }

    // gamma: < 1 brightens the midtones, > 1 darkens them
    if (PHOTO_GAMMA !== 1) {
      for (let i = 0; i < coverage.length; i++) coverage[i] = Math.pow(coverage[i], PHOTO_GAMMA);
    }

    photo.coverage = coverage;
    // resizing clears the canvas, so draw right away instead of waiting for the next frame
    drawLayer(photo, 1);
    updateLoop();
  }

  return function cleanup() {
    loop.stop();
    stopObservingWidth();
    stopObservingVisibility();
    document.removeEventListener('visibilitychange', updateLoop);
  };
}

// Simple (separable) box blur on the brightness map of the cells
function boxBlur(source, cols, rows, radius) {
  const temp = new Float32Array(source.length);
  const out = new Float32Array(source.length);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let n = 0;
      for (let k = -radius; k <= radius; k++) {
        const cc = c + k;
        if (cc >= 0 && cc < cols) {
          sum += source[r * cols + cc];
          n++;
        }
      }
      temp[r * cols + c] = sum / n;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let n = 0;
      for (let k = -radius; k <= radius; k++) {
        const rr = r + k;
        if (rr >= 0 && rr < rows) {
          sum += temp[rr * cols + c];
          n++;
        }
      }
      out[r * cols + c] = sum / n;
    }
  }
  return out;
}
