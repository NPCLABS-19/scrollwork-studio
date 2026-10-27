import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import sharp from 'sharp';
import { traceImage } from '../server/trace.js';
const out = new URL('../public/references/', import.meta.url);
await mkdir(out, { recursive: true });
const catalogue = process.argv[2] || new URL('catalogue.jpg', out);
const spindle = process.argv[3] || new URL('spindle.jpg', out);
if (process.argv[2]) await copyFile(catalogue, new URL('catalogue.jpg', out));
if (process.argv[3]) await copyFile(spindle, new URL('spindle.jpg', out));
const specs = [
  ['Open diamond', 'diamond', 43, 18, 180, 168],
  ['Paired scrolls', 'heart', 252, 9, 197, 181],
  ['Bound hooks', 'lyre', 477, 28, 150, 150],
  ['Bound lyre', 'lyre', 39, 338, 187, 159],
  ['Slender spindle', 'heart', 285, 247, 99, 245],
  ['Leaf quatrefoil', 'quatrefoil', 438, 292, 204, 205],
  ['Open quatrefoil', 'quatrefoil', 26, 572, 214, 201],
  ['Floral cartouche', 'cartouche', 246, 548, 191, 239],
  ['Rosette panel', 'rosette', 457, 568, 196, 204]
];
const buffer = await readFile(catalogue), results = [];
for (const [name, family, left, top, width, height] of specs) {
  const cropped = await sharp(buffer).extract({ left, top, width, height }).png().toBuffer();
  const result = await traceImage(cropped, { threshold: 158, speckle: 5, smoothing: .7, tolerance: .1 });
  results.push({ ...result, id: `archive-${results.length + 1}`, name, family, source: 'reference', symmetry: 'Original outline', seed: `19B/${String(results.length + 1).padStart(2, '0')}`, params: { weight: 0 }, referenceImage: '/references/catalogue.jpg' });
}
const cropped = await sharp(await readFile(spindle)).extract({ left: 420, top: 57, width: 206, height: 645 }).png().toBuffer();
const result = await traceImage(cropped, { threshold: 148, speckle: 5, smoothing: .8, tolerance: .1 });
results.push({ ...result, id: 'archive-spindle', name: 'Heart & flower spindle', family: 'heart', source: 'reference', symmetry: 'Original outline', seed: 'Reference II', params: { weight: 0 }, referenceImage: '/references/spindle.jpg' });
await writeFile(new URL('archive.json', out), JSON.stringify(results));
console.log(`Prepared ${results.length} reference motifs. IoU range: ${Math.min(...results.map(r => r.metrics.maskIoU)).toFixed(3)}–${Math.max(...results.map(r => r.metrics.maskIoU)).toFixed(3)}`);
