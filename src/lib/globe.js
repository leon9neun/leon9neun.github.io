import {
  RAMP,
  DENSE_FROM,
  createLayer,
  setupLayer,
  makeOffscreen,
  createLoop,
  observeVisibility,
  observeWidth,
} from './ascii.js';

// ---- Globe ------------------------------------------------------------
const GLOBE_MAX_SIZE = 560; // maximum diameter of the globe in px
const GLOBE_FONT_SIZE = 8; // size of the characters
const GLOBE_FPS = 30; // frame rate while rotating
const GLOBE_AUTO_SPEED = 0.15; // own rotation in rad/s (0 = off)
const GLOBE_DRAG = 0.006; // how far the mouse turns the globe (rad per px)
const GLOBE_FRICTION = 3; // slowing down after release (higher = stops faster)
const GLOBE_LAND = 0.4; // base brightness of land (+ light)
const GLOBE_OCEAN = 0.1; // base brightness of ocean (+ light)
const MASK_W = 720;
const MASK_H = 360;
const MAX_PITCH = 1.4;
const MIN_COVERAGE = 0.04;
const LIGHT = (() => {
  const light = [-0.5, 0.5, 0.7];
  const length = Math.hypot(...light);
  return light.map((value) => value / length);
})();

/**
 * Draws a rotating globe of characters on a canvas. Land is read from a mask image
 * (equirectangular, land dark, water light).
 * @param {HTMLCanvasElement} canvas - its parent decides how wide the globe can get
 * @param {{ maskSrc: string, isStatic?: boolean }} options - `isStatic` draws one frame without motion
 * @returns {() => void} stops the globe and removes its listeners
 */
export function initGlobe(canvas, { maskSrc, isStatic = false }) {
  const container = canvas.parentElement;
  const globe = createLayer(canvas);
  const state = { yaw: 0.2, pitch: 0.35, vYaw: 0, vPitch: 0, isDragging: false, lastX: 0, lastY: 0 };
  const maskImage = new Image();
  let landMap = null; // land share 0-1 per texel
  let normals = null; // per cell: x, y, z on the unit sphere (z = NaN outside)
  let coverage = null;
  let isVisible = false;

  const loop = createLoop(handleFrame, GLOBE_FPS);
  const stopObservingWidth = observeWidth(container, resize);
  const stopObservingVisibility = observeVisibility(canvas, handleVisibility);

  maskImage.onload = handleMaskLoad;
  maskImage.onerror = () => {
    if (import.meta.env.DEV) console.error(`Globe mask not found: ${maskSrc}`);
  };
  maskImage.src = maskSrc;

  if (!isStatic) {
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    document.addEventListener('visibilitychange', updateLoop);
  }

  function handleMaskLoad() {
    const off = makeOffscreen(MASK_W, MASK_H);
    const context = off.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingQuality = 'high';
    context.drawImage(maskImage, 0, 0, MASK_W, MASK_H);

    let data;
    try {
      data = context.getImageData(0, 0, MASK_W, MASK_H).data;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Globe mask could not be read.', error);
      return;
    }

    landMap = new Float32Array(MASK_W * MASK_H);
    for (let i = 0; i < landMap.length; i++) {
      // smooth out rivers and lakes: threshold with a soft transition
      const dark = 1 - data[i * 4] / 255;
      landMap[i] = Math.min(1, Math.max(0, (dark - 0.3) / 0.4));
    }
    resize(container.clientWidth);
  }

  function resize(width) {
    if (!landMap || width === 0) return;
    const size = Math.min(width, GLOBE_MAX_SIZE);
    const cols = Math.floor(size / (GLOBE_FONT_SIZE * 0.6));
    const rows = Math.round(size / GLOBE_FONT_SIZE);
    setupLayer(globe, cols, rows, GLOBE_FONT_SIZE);

    const radius = (Math.min(cols * globe.cellW, rows * globe.cellH) / 2) * 0.98;
    const centerX = (cols * globe.cellW) / 2;
    const centerY = (rows * globe.cellH) / 2;
    normals = new Float32Array(cols * rows * 3);
    coverage = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) * globe.cellW - centerX) / radius;
        const y = -((r + 0.5) * globe.cellH - centerY) / radius;
        const d = x * x + y * y;
        const i = (r * cols + c) * 3;
        normals[i] = x;
        normals[i + 1] = y;
        normals[i + 2] = d <= 1 ? Math.sqrt(1 - d) : NaN;
      }
    }

    // resizing clears the canvas, so draw right away instead of waiting for the next frame
    renderFrame();
    updateLoop();
  }

  // Land share at position (u, v) in 0-1, bilinear filtered
  function sampleLand(u, v) {
    const fx = u * MASK_W - 0.5;
    const fy = Math.min(MASK_H - 1, Math.max(0, v * MASK_H - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const xa = ((x0 % MASK_W) + MASK_W) % MASK_W;
    const xb = (xa + 1) % MASK_W;
    const ya = y0;
    const yb = Math.min(MASK_H - 1, y0 + 1);
    const top = landMap[ya * MASK_W + xa] * (1 - tx) + landMap[ya * MASK_W + xb] * tx;
    const bottom = landMap[yb * MASK_W + xa] * (1 - tx) + landMap[yb * MASK_W + xb] * tx;
    return top * (1 - ty) + bottom * ty;
  }

  function updateCoverage() {
    const { cols, rows } = globe;
    const sinP = Math.sin(state.pitch);
    const cosP = Math.cos(state.pitch);

    for (let i = 0, n = cols * rows; i < n; i++) {
      const z = normals[i * 3 + 2];
      if (Number.isNaN(z)) {
        coverage[i] = 0;
        continue;
      }
      const x = normals[i * 3];
      const y = normals[i * 3 + 1];

      // viewing direction -> world coordinates (tilt first, then longitude)
      const py = y * cosP + z * sinP;
      const pz = -y * sinP + z * cosP;
      const lon = Math.atan2(x, pz) + state.yaw;
      const lat = Math.asin(Math.max(-1, Math.min(1, py)));
      const u = ((((lon + Math.PI) / (2 * Math.PI)) % 1) + 1) % 1;
      const v = (Math.PI / 2 - lat) / Math.PI;
      const land = sampleLand(u, v);

      const shade = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
      const ocean = GLOBE_OCEAN + 0.22 * shade;
      const ground = GLOBE_LAND + 0.6 * shade;
      coverage[i] = ocean + (ground - ocean) * land;
    }
  }

  // Two passes (dim / main color), so fillStyle is only set twice
  function drawGlobe() {
    const { ctx, canvas: target, cols, rows, cellW, cellH, color, colorDim } = globe;
    const last = RAMP.length - 1;
    ctx.clearRect(0, 0, target.width, target.height);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? colorDim : color;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = coverage[r * cols + c];
          if (v < MIN_COVERAGE) continue;
          const index = Math.round(Math.min(1, v) * last);
          const isDense = index >= DENSE_FROM;
          if (index === 0 || isDense !== (pass === 1)) continue;
          ctx.fillText(RAMP[index], c * cellW, r * cellH);
        }
      }
    }
  }

  function renderFrame() {
    if (!normals) return;
    updateCoverage();
    drawGlobe();
  }

  function handleFrame(step) {
    if (!normals) return;
    if (!state.isDragging) {
      state.yaw += (state.vYaw - GLOBE_AUTO_SPEED) * step;
      state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch + state.vPitch * step));
      const damping = Math.exp(-GLOBE_FRICTION * step);
      state.vYaw *= damping;
      state.vPitch *= damping;
    }
    renderFrame();
  }

  function handleVisibility(isInView) {
    isVisible = isInView;
    updateLoop();
  }

  // runs only while the globe is on screen and the tab is open
  function updateLoop() {
    if (isStatic) return;
    if (isVisible && !document.hidden && normals) loop.start();
    else loop.stop();
  }

  function handlePointerDown(event) {
    state.isDragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.vYaw = 0;
    state.vPitch = 0;
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.state = 'dragging';
  }

  function handlePointerMove(event) {
    if (!state.isDragging) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.yaw -= dx * GLOBE_DRAG;
    state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch + dy * GLOBE_DRAG));
    // smooth the speed, so the run-out matches the hand movement
    state.vYaw = state.vYaw * 0.6 + -dx * GLOBE_DRAG * 0.4 * 60;
    state.vPitch = state.vPitch * 0.6 + dy * GLOBE_DRAG * 0.4 * 60;
  }

  function endDrag() {
    state.isDragging = false;
    delete canvas.dataset.state;
  }

  return function cleanup() {
    loop.stop();
    stopObservingWidth();
    stopObservingVisibility();
    document.removeEventListener('visibilitychange', updateLoop);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
  };
}
