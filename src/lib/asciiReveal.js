import {
  RAMP,
  DENSE_FROM,
  applyFont,
  createLayer,
  setupLayer,
  makeOffscreen,
  createLoop,
  observeVisibility,
  observeWidth,
} from './ascii.js';

// ---- ASCII Reveal -----------------------------------------------------
// Based on the "ASCII Reveal" component of Originkit, rebuilt on top of ascii.js.
const REVEAL_FONT_SIZE = 5; // size of the characters: smaller = more characters = more detail
const REVEAL_ASPECT = 1.25; // height of the drawing divided by its width
const REVEAL_FOCUS_Y = 19; // 0-100: which part of the image stays visible when it is cropped (0 = top)
const REVEAL_CONTRAST = 100; // 0-100
const REVEAL_INVERT = false; // false: bright areas become dense (for a dark background)
const REVEAL_SIZE = 120; // radius of the revealed spot in px
const REVEAL_SOFTNESS = 16; // width of the soft edge of the spot in px
const REVEAL_FPS = 60;
const BLOB_COUNT = 5; // the spot is a chain of circles that follow the pointer
const BLOB_FOLLOW = 0.35; // how fast each circle follows the one before (0-1)

/**
 * Size and position of an image that covers a box completely (like object-fit: cover).
 * Horizontally centered, vertically placed by focusY.
 */
function placeCover(imageW, imageH, boxW, boxH, focusY) {
  const scale = Math.max(boxW / imageW, boxH / imageH);
  const dw = imageW * scale;
  const dh = imageH * scale;
  const focus = Math.min(100, Math.max(0, focusY)) / 100;
  return { dx: (boxW - dw) / 2, dy: (boxH - dh) * focus, dw, dh };
}

/**
 * Draws a photo as characters on a canvas. While the pointer is over it, the real photo
 * shows through a soft spot that follows the pointer.
 * @param {HTMLCanvasElement} canvas - its parent decides how wide the drawing can get
 * @param {{ src: string, isStatic?: boolean }} options - `isStatic` draws only the characters, without the spot
 * @returns {() => void} stops the drawing and removes its listeners
 */
export function initAsciiReveal(canvas, { src, isStatic = false }) {
  const container = canvas.parentElement;
  const layer = createLayer(canvas);
  const image = new Image();
  const blobs = Array.from({ length: BLOB_COUNT }, () => ({ x: 0, y: 0 }));
  const pointer = { x: 0, y: 0, isInside: false };
  let isLoaded = false;
  let hasStartedLoading = false;
  let isSeeded = false;
  let asciiLayer = null; // the characters, drawn once per size
  let photoLayer = null; // the photo, cut out by the mask
  let maskLayer = null; // the soft spots
  let place = null;
  let width = 0; // size of the drawing in CSS px
  let height = 0;

  const loop = createLoop(handleFrame, REVEAL_FPS);
  const stopObservingWidth = observeWidth(container, build);
  const stopObservingVisibility = observeVisibility(canvas, handleVisibility);

  image.onload = () => {
    isLoaded = true;
    build(container.clientWidth);
  };
  image.onerror = () => {
    if (import.meta.env.DEV) console.error(`Image not found: ${src}`);
  };

  if (!isStatic) {
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerMove);
    canvas.addEventListener('pointerleave', handleLeave);
    canvas.addEventListener('pointercancel', handleLeave);
    canvas.addEventListener('pointerup', handlePointerUp);
  }

  // the image is only loaded once the canvas comes into view
  function handleVisibility(isInView) {
    if (isInView && !hasStartedLoading) {
      hasStartedLoading = true;
      image.src = src;
    }
  }

  function build(containerWidth) {
    if (!isLoaded || containerWidth === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const cols = Math.floor(containerWidth / (REVEAL_FONT_SIZE * 0.6));
    const rows = Math.round((cols * REVEAL_FONT_SIZE * 0.6 * REVEAL_ASPECT) / REVEAL_FONT_SIZE);
    setupLayer(layer, cols, rows, REVEAL_FONT_SIZE);
    width = cols * layer.cellW;
    height = rows * layer.cellH;

    // one pixel per character cell: the browser averages the image for us
    place = placeCover(image.naturalWidth, image.naturalHeight, width, height, REVEAL_FOCUS_Y);
    const sampler = makeOffscreen(cols, rows);
    const samplerContext = sampler.getContext('2d', { willReadFrequently: true });
    samplerContext.drawImage(
      image,
      place.dx / layer.cellW,
      place.dy / layer.cellH,
      place.dw / layer.cellW,
      place.dh / layer.cellH,
    );
    let data;
    try {
      data = samplerContext.getImageData(0, 0, cols, rows).data;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Image could not be read.', error);
      return;
    }

    asciiLayer = makeOffscreen(Math.round(width * dpr), Math.round(height * dpr));
    photoLayer = makeOffscreen(asciiLayer.width, asciiLayer.height);
    maskLayer = makeOffscreen(asciiLayer.width, asciiLayer.height);

    const asciiContext = asciiLayer.getContext('2d');
    asciiContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    applyFont(asciiContext, REVEAL_FONT_SIZE);
    const contrast = 0.5 + (REVEAL_CONTRAST / 100) * 2;
    const last = RAMP.length - 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        let brightness = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        brightness = (brightness - 0.5) * contrast + 0.5;
        if (REVEAL_INVERT) brightness = 1 - brightness;
        const index = Math.round(Math.min(1, Math.max(0, brightness)) * last);
        if (index === 0) continue;
        asciiContext.fillStyle = index < DENSE_FROM ? layer.colorDim : layer.color;
        asciiContext.fillText(RAMP[index], c * layer.cellW, r * layer.cellH);
      }
    }

    // resizing clears the canvas, so draw right away
    paint();
  }

  function paint() {
    if (!asciiLayer) return;
    const { ctx } = layer;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(asciiLayer, 0, 0, width, height);
    if (!pointer.isInside) return;

    const dpr = window.devicePixelRatio || 1;
    const photoContext = photoLayer.getContext('2d');
    photoContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    photoContext.globalCompositeOperation = 'source-over';
    photoContext.clearRect(0, 0, width, height);
    photoContext.drawImage(image, place.dx, place.dy, place.dw, place.dh);

    // soft spots: a gradient per circle, so no canvas filter is needed
    const maskContext = maskLayer.getContext('2d');
    maskContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    maskContext.clearRect(0, 0, width, height);
    blobs.forEach((blob, index) => {
      const step = BLOB_COUNT <= 1 ? 0 : index / (BLOB_COUNT - 1);
      const radius = REVEAL_SIZE * (1 - step * 0.5);
      const gradient = maskContext.createRadialGradient(
        blob.x,
        blob.y,
        Math.max(0, radius - REVEAL_SOFTNESS),
        blob.x,
        blob.y,
        radius + REVEAL_SOFTNESS,
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      maskContext.fillStyle = gradient;
      maskContext.beginPath();
      maskContext.arc(blob.x, blob.y, radius + REVEAL_SOFTNESS, 0, Math.PI * 2);
      maskContext.fill();
    });

    // keep only the part of the photo that lies under the spots
    photoContext.setTransform(1, 0, 0, 1, 0, 0);
    photoContext.globalCompositeOperation = 'destination-in';
    photoContext.drawImage(maskLayer, 0, 0);
    photoContext.globalCompositeOperation = 'source-over';
    ctx.drawImage(photoLayer, 0, 0, width, height);
  }

  function updateBlobs() {
    if (!isSeeded) {
      blobs.forEach((blob) => {
        blob.x = pointer.x;
        blob.y = pointer.y;
      });
      isSeeded = true;
      return;
    }
    blobs[0].x += (pointer.x - blobs[0].x) * BLOB_FOLLOW;
    blobs[0].y += (pointer.y - blobs[0].y) * BLOB_FOLLOW;
    for (let i = 1; i < blobs.length; i++) {
      blobs[i].x += (blobs[i - 1].x - blobs[i].x) * BLOB_FOLLOW;
      blobs[i].y += (blobs[i - 1].y - blobs[i].y) * BLOB_FOLLOW;
    }
  }

  // runs only while the pointer is over the drawing
  function handleFrame() {
    updateBlobs();
    paint();
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // the canvas can be shown a little smaller than its drawing
    pointer.x = ((event.clientX - rect.left) * width) / rect.width;
    pointer.y = ((event.clientY - rect.top) * height) / rect.height;
    pointer.isInside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= width && pointer.y <= height;
    if (pointer.isInside && isLoaded) loop.start();
  }

  function handlePointerUp(event) {
    // a finger leaves the screen, a mouse stays over the drawing
    if (event.pointerType !== 'mouse') handleLeave();
  }

  function handleLeave() {
    pointer.isInside = false;
    isSeeded = false;
    loop.stop();
    paint();
  }

  return function cleanup() {
    loop.stop();
    stopObservingWidth();
    stopObservingVisibility();
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerdown', handlePointerMove);
    canvas.removeEventListener('pointerleave', handleLeave);
    canvas.removeEventListener('pointercancel', handleLeave);
    canvas.removeEventListener('pointerup', handlePointerUp);
  };
}
