const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
let tracer;

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width; element.height = height;
  return element;
}

async function imageFromURL(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

// The hosted app has no image endpoint. Every pixel and curve stays in this tab.
export async function traceImageInBrowser(imageURL, options = {}) {
  const image = await imageFromURL(imageURL);
  if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('Choose an image smaller than 24 megapixels.');
  const crop = options.crop || { x: 0, y: 0, w: 1, h: 1 };
  if (![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.w <= 0 || crop.h <= 0) throw new Error('Select a valid crop region.');
  const left = clamp(Math.round(crop.x * image.naturalWidth), 0, image.naturalWidth - 1);
  const top = clamp(Math.round(crop.y * image.naturalHeight), 0, image.naturalHeight - 1);
  const cropWidth = clamp(Math.round(crop.w * image.naturalWidth), 1, image.naturalWidth - left);
  const cropHeight = clamp(Math.round(crop.h * image.naturalHeight), 1, image.naturalHeight - top);
  const scale = Math.min(1, 1400 / cropWidth, 1400 / cropHeight);
  const width = Math.max(1, Math.round(cropWidth * scale)), height = Math.max(1, Math.round(cropHeight * scale));
  const source = canvas(width, height), context = source.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
  context.drawImage(image, left, top, cropWidth, cropHeight, 0, 0, width, height);
  const mask = context.getImageData(0, 0, width, height);
  const threshold = clamp(Number(options.threshold) || 155, 20, 240);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    let lum = .2126 * mask.data[i] + .7152 * mask.data[i + 1] + .0722 * mask.data[i + 2];
    if (options.invert) lum = 255 - lum;
    const value = lum < threshold ? 0 : 255;
    mask.data[i] = mask.data[i + 1] = mask.data[i + 2] = value;
    mask.data[i + 3] = 255;
    if (!value) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) throw new Error('No dark motif found. Increase the threshold or select a closer crop.');
  context.putImageData(mask, 0, 0);
  const trimWidth = maxX - minX + 13, trimHeight = maxY - minY + 13;
  const trimmed = canvas(trimWidth, trimHeight), trimmedContext = trimmed.getContext('2d', { willReadFrequently: true });
  trimmedContext.fillStyle = '#fff'; trimmedContext.fillRect(0, 0, trimWidth, trimHeight);
  trimmedContext.drawImage(source, minX, minY, maxX - minX + 1, maxY - minY + 1, 6, 6, maxX - minX + 1, maxY - minY + 1);
  const working = canvas(trimWidth * 2, trimHeight * 2), workContext = working.getContext('2d');
  workContext.imageSmoothingEnabled = false;
  workContext.drawImage(trimmed, 0, 0, working.width, working.height);
  tracer ||= import('esm-potrace-wasm').then(async module => { await module.init(); return module; });
  const { potrace } = await tracer;
  const traced = await potrace(working, {
    turdsize: clamp(Number(options.speckle ?? 5), 0, 100) * 4,
    alphamax: clamp(Number(options.smoothing ?? .8), 0, 1.3),
    opttolerance: clamp(Number(options.tolerance ?? .15), .05, 1),
    opticurve: 1, pathonly: false, extractcolors: false,
    posterizelevel: 2, posterizationalgorithm: 0
  });
  // Potrace emits coordinates in tenths of a pixel with a flipped y-axis.
  // Preserve its group transform and complete compound paths (including holes).
  const document = new DOMParser().parseFromString(traced, 'image/svg+xml');
  const paths = [...document.querySelectorAll('path')].map(element => {
    const transforms = [];
    for (let node = element; node; node = node.parentElement) {
      const transform = node.getAttribute('transform');
      if (transform) transforms.unshift(transform);
    }
    return { d: element.getAttribute('d'), transform: `scale(.5) ${transforms.join(' ')}`, fill: true };
  });
  if (!paths.length) throw new Error('The crop contains only small speckles. Reduce cleanup or crop a larger motif.');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${trimWidth}" height="${trimHeight}" viewBox="0 0 ${trimWidth} ${trimHeight}">${paths.map(p => `<path d="${p.d}" transform="${p.transform}" fill="black" fill-rule="evenodd"/>`).join('')}</svg>`;
  const svgURL = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const comparison = canvas(trimWidth, trimHeight), comparisonContext = comparison.getContext('2d', { willReadFrequently: true });
  try {
    const vector = await imageFromURL(svgURL);
    comparisonContext.fillStyle = '#fff'; comparisonContext.fillRect(0, 0, trimWidth, trimHeight);
    comparisonContext.drawImage(vector, 0, 0);
  } finally { URL.revokeObjectURL(svgURL); }
  const original = trimmedContext.getImageData(0, 0, trimWidth, trimHeight).data;
  const rendered = comparisonContext.getImageData(0, 0, trimWidth, trimHeight).data;
  let intersection = 0, union = 0;
  for (let i = 0; i < original.length; i += 4) {
    const a = original[i] < 128, b = rendered[i] < 128;
    if (a && b) intersection++; if (a || b) union++;
  }
  return {
    paths, viewBox: [0, 0, trimWidth, trimHeight], preview: trimmed.toDataURL('image/png'),
    metrics: { maskIoU: union ? intersection / union : 0, width: trimWidth, height: trimHeight, paths: paths.length },
    options: { threshold, speckle: options.speckle ?? 5, smoothing: options.smoothing ?? .8 }
  };
}
