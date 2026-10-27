import sharp from 'sharp';
import potrace from 'potrace';

const traceBitmap = (buffer, options) => new Promise((resolve, reject) => {
  potrace.trace(buffer, options, (error, svg) => error ? reject(error) : resolve(svg));
});
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export async function traceImage(input, options = {}) {
  let pipeline = sharp(input, { limitInputPixels: 24_000_000 }).rotate().flatten({ background: '#ffffff' });
  const upright = await pipeline.png().toBuffer();
  const meta = await sharp(upright).metadata();
  const crop = options.crop;
  if (crop) {
    if (![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.w <= 0 || crop.h <= 0) throw new Error('Select a valid crop region.');
    const left = clamp(Math.round(crop.x * meta.width), 0, meta.width - 1);
    const top = clamp(Math.round(crop.y * meta.height), 0, meta.height - 1);
    pipeline = sharp(upright).extract({ left, top, width: clamp(Math.round(crop.w * meta.width), 1, meta.width - left), height: clamp(Math.round(crop.h * meta.height), 1, meta.height - top) });
  } else pipeline = sharp(upright);
  const threshold = clamp(Number(options.threshold) || 155, 20, 240);
  let image = pipeline.resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).greyscale();
  if (options.invert) image = image.negate();
  const binary = await image.threshold(threshold).png().toBuffer();
  const { data, info } = await sharp(binary).raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels] < 128) { minX = Math.min(x, minX); maxX = Math.max(x, maxX); minY = Math.min(y, minY); maxY = Math.max(y, maxY); }
  }
  if (maxX < 0) throw new Error('No dark motif found. Increase the threshold or select a closer crop.');
  const trimmed = await sharp(binary).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).extend({ top: 6, bottom: 6, left: 6, right: 6, background: '#ffffff' }).png().toBuffer();
  const dim = await sharp(trimmed).metadata();
  // Trace a nearest-neighbour supersampled binary mask, then evaluate fidelity
  // at the original crop resolution. Extra contour precision does not inflate
  // the metric by changing its comparison resolution.
  const workScale = 2;
  const working = await sharp(trimmed).resize(dim.width * workScale, dim.height * workScale, { kernel: 'nearest' }).png().toBuffer();
  const tracedSVG = await traceBitmap(working, {
    threshold: 128, color: '#161915', background: 'transparent',
    turdSize: clamp(Number(options.speckle ?? 5), 0, 100) * workScale * workScale,
    alphaMax: clamp(Number(options.smoothing ?? 0.8), 0, 1.3),
    optTolerance: clamp(Number(options.tolerance ?? 0.15), 0.05, 1), optCurve: true
  });
  const paths = [...tracedSVG.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)].map(m => ({ d: m[1], transform: `scale(${1 / workScale})`, fill: true }));
  if (!paths.length) throw new Error('The crop contains only small speckles. Reduce cleanup or crop a larger motif.');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim.width}" height="${dim.height}" viewBox="0 0 ${dim.width} ${dim.height}">${paths.map(p => `<path d="${p.d}" transform="${p.transform}" fill="#000" fill-rule="evenodd"/>`).join('')}</svg>`;
  const rendered = await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).greyscale().threshold(128).raw().toBuffer();
  const original = await sharp(trimmed).greyscale().raw().toBuffer();
  let intersection = 0, union = 0;
  for (let i = 0; i < original.length; i++) { const a = original[i] < 128, b = rendered[i] < 128; if (a && b) intersection++; if (a || b) union++; }
  return {
    paths, viewBox: [0, 0, dim.width, dim.height],
    preview: `data:image/png;base64,${trimmed.toString('base64')}`,
    metrics: { maskIoU: union ? intersection / union : 0, width: dim.width, height: dim.height, paths: paths.length },
    options: { threshold, speckle: options.speckle ?? 5, smoothing: options.smoothing ?? 0.8 }
  };
}
