import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { FAMILIES, generateCatalogue, makeMotif, motifSVG, sheetSVG, upgradeMotif } from '../src/engine.js';
import { traceImage } from '../server/trace.js';

test('seeds reproduce the catalogue and mixed catalogues cover every family', () => {
  const first = generateCatalogue('TEST-2026');
  assert.deepEqual(first, generateCatalogue('TEST-2026'));
  assert.notDeepEqual(first, generateCatalogue('DIFFERENT'));
  assert.equal(new Set(first.map(m => m.family)).size, FAMILIES.length);
  assert.ok(generateCatalogue('FAMILY', 25, { family: 'diamond' }).every(m => m.family === 'diamond'));
});

test('generated families render at parameter extremes without clipping to the frame', async () => {
  for (const family of FAMILIES) for (const params of [{ width: 58, height: 105, curl: 20, weight: 6, detail: 2 }, { width: 100, height: 158, curl: 90, weight: 14, detail: 2 }]) {
    const m = makeMotif(family.id, params, 'bounds');
    const svg = motifSVG(m, { background: '#ffffff', width: 500, height: 600 });
    assert.ok(!/NaN|undefined|Infinity/.test(svg), family.id);
    const { data, info } = await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let foreground = 0, border = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] < 128) { foreground++; if (x < 2 || y < 2 || x > info.width - 3 || y > info.height - 3) border++; }
    assert.ok(foreground > 300, `${family.id} is not empty`);
    assert.equal(border, 0, `${family.id} should not touch the output border`);
  }
});

test('generated strokes retain visible substance at small catalogue size', () => {
  for (let seed = 0; seed < 80; seed++) for (const m of generateCatalogue(`optical-${seed}`)) {
    const scale = Math.min(120 / m.viewBox[2], 145 / m.viewBox[3]);
    assert.ok(m.params.weight * scale >= 2.8, `${m.family} primary stroke fell below 2.8px`);
    assert.ok(m.params.weight >= 8.7, 'generation never randomly chooses hairline strokes');
  }
});

test('fourfold lobes stay inside separate angular sectors until their planned joins', () => {
  for (const family of ['quatrefoil', 'rosette']) for (const width of [58, 78, 100]) for (const height of [105, 136, 158]) {
    const m = makeMotif(family, { width, height });
    const coordinates = m.paths[0].d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    for (let i = 0; i < coordinates.length; i += 2) {
      const [x, y] = coordinates.slice(i, i + 2);
      assert.ok(y <= -Math.abs(x) + .001, `${family} control (${x}, ${y}) leaves its lobe's angular sector`);
    }
  }
});

test('old generated work upgrades while imported geometry remains exact', () => {
  const old = { ...makeMotif('cartouche', { weight: 5.2 }, 'kept-seed'), craftVersion: undefined };
  const next = upgradeMotif(old);
  assert.equal(next.seed, old.seed);
  assert.ok(next.params.weight >= 8.5);
  assert.equal(next.craftVersion, 2);
  const imported = { source: 'imported', paths: [{ d: 'M0 0L20 20' }] };
  assert.equal(upgradeMotif(imported), imported);
});

test('all exposed numeric geometry parameters affect every family', () => {
  for (const f of FAMILIES) {
    const base = makeMotif(f.id);
    for (const [key, value] of [['width', 90], ['height', 110], ['curl', 85]]) assert.notDeepEqual(base.paths, makeMotif(f.id, { [key]: value }).paths, `${f.id}: ${key}`);
  }
});

test('sheet export preserves path counts and alternating exact repeats', () => {
  const item = makeMotif('heart'), motifs = Array.from({ length: 9 }, () => item);
  const svg = sheetSVG(motifs, { columns: 3, repeat: true, alternate: true });
  assert.equal((svg.match(/<path /g) || []).length, item.paths.length * 9);
  assert.equal((svg.match(/rotate\(180\)/g) || []).length, 3);
  assert.equal((svg.match(/<text /g) || []).length, 9);
});

test('tracing preserves a synthetic ring hole and gives a measured native-resolution overlap', async () => {
  const input = await sharp(Buffer.from('<svg width="160" height="200"><rect width="100%" height="100%" fill="white"/><path d="M80 20a60 60 0 1 0 0 120a60 60 0 1 0 0-120M80 45a35 35 0 1 1 0 70a35 35 0 1 1 0-70" fill="black" fill-rule="evenodd"/></svg>')).png().toBuffer();
  const result = await traceImage(input, { threshold: 155, speckle: 0 });
  assert.ok(result.metrics.maskIoU > .97, result.metrics.maskIoU);
  const rendered = await sharp(Buffer.from(motifSVG({ ...result, params: { weight: 0 } }, { width: result.viewBox[2], height: result.viewBox[3], background: '#ffffff' }))).greyscale().raw().toBuffer();
  assert.equal(rendered[Math.floor(result.viewBox[3] / 2) * result.viewBox[2] + Math.floor(result.viewBox[2] / 2)], 255, 'centre hole stays white');
});

test('blank references and invalid crops return actionable errors', async () => {
  const blank = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(traceImage(blank), /No dark motif/);
  await assert.rejects(traceImage(blank, { crop: { x: 0, y: 0, w: 0, h: 1 } }), /valid crop/);
});
