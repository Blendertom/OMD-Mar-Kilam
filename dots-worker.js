// dots-worker.js (module-safe)
self.onmessage = async (e) => {
const defaults = {
imageUrl: '',
w: 720,
h: 360,
step: 2,
includeProb: 0.85,
maxPoints: 80000,
landThreshold: 540 // 1803
};
const params = Object.assign({}, defaults, e.data || {});
// Validate
params.w = Math.max(1, params.w|0);
params.h = Math.max(1, params.h|0);
params.step = Math.max(1, params.step|0);
params.includeProb = Math.max(0, Math.min(1, +params.includeProb));
params.maxPoints = Math.max(1, params.maxPoints|0);
params.landThreshold = Math.max(0, Math.min(765, params.landThreshold|0)); // 0..2553
try {
if (!params.imageUrl) throw new Error('imageUrl is required');
 // Fetch + decode
const resp = await fetch(params.imageUrl, { mode: 'cors' });
if (!resp.ok) throw new Error(`fetch failed: ${resp.status} ${resp.statusText}`);
const blob = await resp.blob();

let bitmap;
try {
  bitmap = await createImageBitmap(blob);
} catch (err) {
  // Fallback decode path using ImageBitmap poly
  throw new Error('createImageBitmap failed; ensure CORS headers or use same-origin asset');
}

// Canvas in worker: prefer OffscreenCanvas, fallback if missing
let off, ctx;
try {
  off = new OffscreenCanvas(params.w, params.h);
  ctx = off.getContext('2d', { willReadFrequently: true });
} catch (e1) {
  // Safari fallback: construct a canvas via WorkerGlobalScope (limited support)
  const anySelf = /** @type {any} */ (self);
  if (typeof anySelf.document !== 'undefined' && anySelf.document.createElement) {
    const c = anySelf.document.createElement('canvas');
    c.width = params.w; c.height = params.h;
    ctx = c.getContext('2d', { willReadFrequently: true });
  } else {
    throw new Error('OffscreenCanvas not supported in this worker environment');
  }
}

ctx.drawImage(bitmap, 0, 0, params.w, params.h);
const data = ctx.getImageData(0, 0, params.w, params.h).data;

// Allocate result buffer (lat,lng pairs)
const out = new Float32Array(params.maxPoints * 2);
let count = 0;

// Sample
for (let y = 0; y < params.h; y += params.step) {
  for (let x = 0; x < params.w; x += params.step) {
    const i = (y * params.w + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const isLand = (r + g + b) < params.landThreshold;
    if (isLand && Math.random() < params.includeProb) {
      const lng = (x / params.w) * 360 - 180;
      const lat = 90 - (y / params.h) * 180;
      const idx = count * 2;
      out[idx] = lat;
      out[idx + 1] = lng;
      count++;
      if (count >= params.maxPoints) break;
    }
  }
  if (count >= params.maxPoints) break;
}

const result = out.slice(0, count * 2);
self.postMessage({ ok: true, buf: result.buffer, count }, [result.buffer]);
 } catch (err) {
self.postMessage({ ok: false, error: (err && err.message) ? err.message : String(err) });
}
};
