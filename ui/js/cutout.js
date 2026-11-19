// Background removal that runs on this computer: the small U²-Net model through onnxruntime-web (WASM).
const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
let ready = null;

async function load() {
  const ort = await import('../vendor/ort/ort.wasm.min.mjs');
  ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which a desktop web view does not have
  ort.env.wasm.wasmPaths = new URL('../vendor/ort/', import.meta.url).href;
  const model = await (await fetch(new URL('../vendor/ort/u2netp.onnx', import.meta.url))).arrayBuffer();
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  return { ort, session };
}

const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// Returns a canvas holding the picture with its background made transparent.
export async function removeBackground(image, maxSide = 2048) {
  if (!ready) ready = load().catch((err) => { ready = null; throw err; });
  const { ort, session } = await ready;
  const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(iw, ih));
  const W = Math.max(1, Math.round(iw * scale)), H = Math.max(1, Math.round(ih * scale));

  const small = makeCanvas(SIZE, SIZE).getContext('2d', { willReadFrequently: true });
  small.drawImage(image, 0, 0, SIZE, SIZE);
  const px = small.getImageData(0, 0, SIZE, SIZE).data;
  let peak = 1;
  for (let i = 0; i < px.length; i += 4) peak = Math.max(peak, px[i], px[i + 1], px[i + 2]);
  const plane = SIZE * SIZE, input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) for (let c = 0; c < 3; c += 1) input[c * plane + i] = (px[i * 4 + c] / peak - MEAN[c]) / STD[c];

  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const pred = out[session.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < plane; i += 1) { if (pred[i] < lo) lo = pred[i]; if (pred[i] > hi) hi = pred[i]; }
  const span = hi - lo || 1;
  const maskSmall = makeCanvas(SIZE, SIZE), mctx = maskSmall.getContext('2d');
  const md = mctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < plane; i += 1) { const v = Math.round(((pred[i] - lo) / span) * 255); md.data[i * 4] = v; md.data[i * 4 + 1] = v; md.data[i * 4 + 2] = v; md.data[i * 4 + 3] = 255; }
  mctx.putImageData(md, 0, 0);

  const mask = makeCanvas(W, H).getContext('2d', { willReadFrequently: true });
  mask.imageSmoothingQuality = 'high';
  mask.drawImage(maskSmall, 0, 0, W, H);
  const alpha = mask.getImageData(0, 0, W, H).data;
  const result = makeCanvas(W, H), rctx = result.getContext('2d', { willReadFrequently: true });
  rctx.drawImage(image, 0, 0, W, H);
  const img = rctx.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i += 1) {
    // Push the soft mask towards a clean edge: below 10% is background, above 90% is fully kept.
    const a = Math.min(1, Math.max(0, (alpha[i * 4] / 255 - 0.1) / 0.8));
    img.data[i * 4 + 3] = Math.round(img.data[i * 4 + 3] * a);
  }
  rctx.putImageData(img, 0, 0);
  return result;
}
