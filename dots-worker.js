// dots-worker.js (module-safe)
self.onmessage = async (e) => {
const {
imageUrl,
w = 720,
h = 360,
step = 2,
includeProb = 0.85,
maxPoints = 80000,
landThreshold = 540 // 180*3; tweak if your mask differs
} = e.data || {};
try {
const resp = await fetch(imageUrl, { mode: 'cors' });
const blob = await resp.blob();
const bitmap = await createImageBitmap(blob);
 // Prefer OffscreenCanvas
const off = new OffscreenCanvas(w, h);
const ctx = off.getContext('2d', { willReadFrequently: true });
ctx.drawImage(bitmap, 0, 0, w, h);
const data = ctx.getImageData(0, 0, w, h).data;

// Pack lat/lng pairs in a Float32Array and transfer (faster/lighter than objects)
const maxPairs = maxPoints;
const out = new Float32Array(maxPairs * 2);
let count = 0;

for (let y = 0; y < h; y += step) {
  for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const isLand = (r + g + b) < landThreshold;
    if (isLand && Math.random() < includeProb) {
      const lng = (x / w) * 360 - 180;
      const lat = 90 - (y / h) * 180;
      const idx = count * 2;
      out[idx] = lat;
      out[idx + 1] = lng;
      count++;
      if (count >= maxPairs) break;
    }
  }
  if (count >= maxPairs) break;
}

const result = out.slice(0, count * 2);
self.postMessage({ ok: true, buf: result.buffer, count }, [result.buffer]);
 } catch (err) {
self.postMessage({ ok: false, error: err.message || String(err) });
}
};