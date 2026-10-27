export const FAMILIES = [
  { id: 'heart', name: 'Heart spindle', description: 'Mirrored hearts, a close waist, floral terminals.' },
  { id: 'lyre', name: 'Bound lyre', description: 'Paired double-ended C-scrolls with a central collar.' },
  { id: 'diamond', name: 'Open diamond', description: 'Four inward-bowed sides and outward-turning curls.' },
  { id: 'quatrefoil', name: 'Quatrefoil', description: 'Four round lobes opening around a quiet centre.' },
  { id: 'cartouche', name: 'Floral cartouche', description: 'Layered heart-scrolls surrounding a small rosette.' },
  { id: 'rosette', name: 'Rosette panel', description: 'Fourfold scrolls, a circular rhythm, a floral centre.' }
];
// Changes to construction are versioned so a persisted catalogue is not left
// showing the old hairline geometry after a local deployment is updated.
export const CRAFT_VERSION = 2;
export const DEFAULT_PARAMS = { width: 78, height: 136, curl: 56, weight: 9.6, detail: 1, terminals: true };
export function rng(seed) {
  let a = hashSeed(String(seed));
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const n = x => Math.round(x * 1000) / 1000;
const p = (...v) => v.map(n).join(' ');
const part = (d, transform = '', fill = false, strokeWidth) => ({ d, transform, fill, ...(strokeWidth ? { strokeWidth } : {}) });
const mirrors = (d, strokeWidth) => ['', 'scale(-1 1)', 'scale(1 -1)', 'scale(-1 -1)'].map(t => part(d, t, false, strokeWidth));
const circle = (x, y, r) => `M ${p(x + r, y)} A ${p(r, r, 0, 1, 0, x - r, y)} A ${p(r, r, 0, 1, 0, x + r, y)} Z`;

// A decreasing-radius volute, sampled with analytic tangents and converted to
// cubic Hermite segments. Joining the approach to that tangent prevents kinks.
function volute(cx, cy, radius, angle, turns = 1.02, direction = 1) {
  const inner = radius * .2, sweep = direction * turns * Math.PI * 2;
  const sample = t => {
    const r = radius + (inner - radius) * t, a = angle + sweep * t;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), dx: (inner - radius) * Math.cos(a) - r * Math.sin(a) * sweep, dy: (inner - radius) * Math.sin(a) + r * Math.cos(a) * sweep };
  };
  const count = 16, dt = 1 / count, start = sample(0);
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = sample(i * dt), b = sample((i + 1) * dt);
    d += ` C ${p(a.x + a.dx * dt / 3, a.y + a.dy * dt / 3, b.x - b.dx * dt / 3, b.y - b.dy * dt / 3, b.x, b.y)}`;
  }
  return { start, d };
}
function approach(x, y, c1x, c1y, scroll, handle = 28) {
  const s = scroll.start, len = Math.hypot(s.dx, s.dy);
  return `M ${p(x, y)} C ${p(c1x, c1y, s.x - s.dx / len * handle, s.y - s.dy / len * handle, s.x, s.y)}${scroll.d}`;
}
function flower(cx, cy, r, count = 6) {
  // Broad, separated petals survive catalogue-size rendering.
  return Array.from({ length: count }, (_, i) => part(`M ${p(cx, cy - r * .15)} C ${p(cx - r * .3, cy - r * .43, cx - r * .22, cy - r * .8, cx, cy - r)} C ${p(cx + r * .22, cy - r * .8, cx + r * .3, cy - r * .43, cx, cy - r * .15)} Z`, `rotate(${i * 360 / count} ${cx} ${cy})`, true));
}
function medallion(r = 20) {
  // A single scalloped ring replaces intersecting stars and stacked petal paths.
  const steps = 96, pts = [];
  for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI * 2, rad = r * (.83 + .17 * Math.cos(a * 8)); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); }
  const outer = `M ${p(...pts[0])}` + pts.slice(1).map(pt => ` L ${p(...pt)}`).join('') + ' Z';
  return part(outer + ' ' + circle(0, 0, r * .33), '', true);
}
function collar(x = 0, y = 0, width = 38, height = 18) {
  const a = width / 2, b = height / 2;
  const outline = `M ${p(x - a, y - b)} H ${n(x + a)} V ${n(y + b)} H ${n(x - a)} Z`;
  const slot = width >= 28 ? ` M ${p(x - a + 4, y - 1.8)} H ${n(x + a - 4)} V ${n(y + 1.8)} H ${n(x - a + 4)} Z` : '';
  return [part(outline + slot, '', true)];
}
function heartParts(w, h, curl, waist = 34) {
  const radius = w * (.43 + curl / 1200);
  const scroll = volute(-w + radius, -h * .86, radius, Math.PI, 1.01 + curl / 1200);
  return { paths: mirrors(approach(0, -waist, -w * .42, -h * .43, scroll)), top: h * .86 + radius };
}

export function makeMotif(family, params = {}, seed = '1') {
  const q = { ...DEFAULT_PARAMS, ...params };
  q.weight = clamp(Number(q.weight) || DEFAULT_PARAMS.weight, 6, 14);
  const w = clamp(q.width, 58, 100), h = clamp(q.height, 105, 158), k = clamp(q.curl, 20, 90);
  q.width = w; q.height = h; q.curl = k;
  const secondary = q.weight * .78;
  let paths = [], viewBox, symmetry = 'Two mirror axes';
  if (family === 'heart') {
    const heart = heartParts(w, h, k, 38);
    paths = heart.paths;
    // Each small curl owns a separate quadrant; the centre remains an open
    // diamond instead of receiving four crossing stems and a flower on top.
    const waist = 'M 0 -38 C -12 -20 -43 -12 -43 -31 C -43 -49 -17 -49 -17 -32 C -17 -23 -27 -22 -30 -29';
    paths.push(...mirrors(waist, secondary));
    let extent = heart.top + 18;
    if (q.terminals) { const y = heart.top + 32; paths.push(...flower(0, -y, 20), ...flower(0, y, 20)); extent = y + 29; }
    viewBox = [-w - 18, -extent, 2 * (w + 18), 2 * extent];
  } else if (family === 'cartouche') {
    const heart = heartParts(w, h, k, 30);
    paths = heart.paths;
    // Four side arms join at the two OUTSIDE shoulder points. No path travels
    // through the medallion and there are no tiny waist curls behind it.
    const side = 'M -32 0 C -61 -25 -115 -16 -115 -42 C -115 -65 -81 -65 -81 -43 C -81 -31 -95 -30 -99 -40';
    paths.push(...mirrors(side, secondary));
    paths.push(part('M -32 0 H -18 M 18 0 H 32 M 0 -30 V -18 M 0 18 V 30', '', false, secondary));
    paths.push(medallion(26));
    const extent = heart.top + 20;
    viewBox = [-142, -extent, 284, 2 * extent];
  } else if (family === 'lyre') {
    const radius = Math.max(q.weight * 2.8, w * (.39 + k / 1200));
    const scroll = volute(-w * .61, -h * .78, radius, 0, 1.01 + k / 1300, -1);
    const upper = approach(-18, 0, -18, -h * .32, scroll, 27);
    paths = mirrors(upper);
    paths.push(...collar(0, 0, 54, 24));
    const extent = h * .78 + radius + 22;
    viewBox = [-w * .61 - radius - 20, -extent, 2 * (w * .61 + radius + 20), 2 * extent];
  } else if (family === 'diamond') {
    const r = 105 + (w - 58) * .5, bend = .27 + h / 900;
    const side = `M 0 ${n(-r)} C ${p(0, -r * bend, r * bend, 0, r, 0)}`;
    const radius = 25 + k * .035;
    const scroll = volute(-radius * 1.12, -r - 2, radius, 0, 1.03);
    const end = approach(0, -r, -4, -r - 8, scroll, 5);
    for (let i = 0; i < 4; i++) {
      const t = `rotate(${i * 90})`;
      paths.push(part(side, t));
      paths.push(part(end, t, false, secondary), part(end, `${t} scale(-1 1)`, false, secondary));
      paths.push(...collar(0, -r, 18, 15).map(a => ({ ...a, transform: t })));
    }
    const extent = r + radius + 23;
    viewBox = [-extent, -extent, extent * 2, extent * 2]; symmetry = 'Fourfold + mirror';
  } else {
    const r = 108 + (w - 58) * .45, reach = .85 + (h - 105) / 170;
    const b = r * (.43 + k / 1600), top = r * 1.24 * reach;
    // Ends are shared at four deliberate diagonal junctions. The previous
    // loops overlapped near the origin, accidentally making extra tiny petals.
    // The convex hull of every top-lobe control point stays in y <= -|x|.
    // Its rotated neighbours occupy the other angular sectors, so they can
    // meet only at the intended diagonal junction, without an extra loop.
    const lobe = `M ${p(-b, -b)} C ${p(-r, -r, -r, -top, 0, -top)} C ${p(r, -top, r, -r, b, -b)}`;
    for (let i = 0; i < 4; i++) {
      const t = `rotate(${i * 90})`;
      paths.push(part(lobe, t));
      if (family === 'quatrefoil' && q.terminals) {
        const tip = b + 34;
        const leaf = `M ${p(b, -b)} C ${p(b + 7, -b - 19, tip - 10, -tip, tip, -tip)} C ${p(tip, -tip + 10, b + 19, -b - 7, b, -b)} Z`;
        paths.push(part(leaf, t, true));
        const seam = `M ${p(b - 9, -b - 1)} L ${p(b + 1, -b + 9)}`;
        paths.push(part(seam, t, false, secondary * .7));
      }
      if (family === 'rosette') {
        const height = r * .57, spread = r * .28, radius = Math.max(secondary * 2.4, r * .18);
        const s = volute(-spread, -height, radius, Math.PI, 1.01, 1);
        const branch = approach(0, -height + 8, -spread * .38, -height + 32, s, 15);
        paths.push(part(branch, t, false, secondary), part(branch, `${t} scale(-1 1)`, false, secondary));
        paths.push(part(`M 0 -20 V ${n(-top * .83)}`, t, false, secondary));
      }
    }
    if (family === 'rosette') paths.push(medallion(24));
    const extent = Math.max(top, b + 39) + 19;
    viewBox = [-extent, -extent, 2 * extent, 2 * extent];
    symmetry = family === 'quatrefoil' && q.terminals ? 'Fourfold rotation' : 'Fourfold + mirror';
  }
  const index = FAMILIES.findIndex(f => f.id === family);
  return { id: `${family}-${seed}`, family, name: FAMILIES[index]?.name || 'Imported motif', seed: String(seed), params: q, paths, viewBox, symmetry, source: 'generated', craftVersion: CRAFT_VERSION };
}

export function upgradeMotif(motif) {
  if (!motif || motif.source !== 'generated' || motif.craftVersion >= CRAFT_VERSION) return motif;
  const weight = clamp((Number(motif.params?.weight) || 5.2) * 1.8, 8.5, 12);
  return makeMotif(motif.family, { ...motif.params, weight }, motif.seed);
}
export function generateCatalogue(seed, count = 9, options = {}) {
  const random = rng(seed), items = [];
  const families = FAMILIES.map(f => f.id);
  for (let i = families.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [families[i], families[j]] = [families[j], families[i]]; }
  for (let i = 0; i < count; i++) {
    const family = options.family && options.family !== 'all' ? options.family : families[i % families.length];
    const defaults = { ...DEFAULT_PARAMS, ...options.baseParams };
    const variance = options.variance ?? 1;
    // Optical variation stays deliberately restrained. Thin stems, compressed
    // coils, and a second near-coincident contour are not random options.
    const familyWeight = { heart: 9.6, lyre: 10.4, diamond: 9.3, quatrefoil: 10.2, cartouche: 9.5, rosette: 9.1 }[family];
    const params = {
      ...defaults,
      width: clamp(defaults.width + (random() - .5) * 22 * variance, 67, 94),
      height: clamp(defaults.height + (random() - .5) * 25 * variance, 121, 150),
      curl: clamp(defaults.curl + (random() - .5) * 24 * variance, 39, 73),
      weight: clamp((options.baseParams?.weight || familyWeight) + (random() - .5) * .9 * variance, 8.7, 11),
      detail: 1,
      terminals: family === 'heart' || family === 'quatrefoil' ? random() > .12 : true
    };
    items.push(makeMotif(family, params, `${seed}-${i + 1}`));
  }
  return items;
}

export function pathMarkup(motif, color = 'currentColor') {
  return motif.paths.map(x => `<path d="${x.d}"${x.transform ? ` transform="${x.transform}"` : ''} fill="${x.fill ? color : 'none'}" stroke="${color}" stroke-width="${x.fill ? 0 : Math.max(.1, Math.min(1000, Number(x.strokeWidth ?? motif.params?.weight) || 3))}" stroke-linecap="round" stroke-linejoin="round" fill-rule="${x.fillRule === 'nonzero' ? 'nonzero' : 'evenodd'}"/>`).join('');
}
export function motifSVG(motif, { color = '#222c25', background = 'transparent', width = 900, height = 1100 } = {}) {
  const [x, y, w, h] = motif.viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${w} ${h}">${background !== 'transparent' ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>` : ''}<g>${pathMarkup(motif, color)}</g></svg>`;
}
export function sheetSVG(items, { columns = 3, gap = 36, labels = true, color = '#222c25', background = '#faf8f1', repeat = false, alternate = false } = {}) {
  const cellW = 300, cellH = 350, rows = Math.ceil(items.length / columns);
  const width = columns * cellW + gap * (columns + 1), height = rows * cellH + gap * (rows + 1);
  const groups = items.map((m, i) => {
    const col = i % columns, row = Math.floor(i / columns), [vx, vy, vw, vh] = m.viewBox;
    const scale = Math.min((cellW - 42) / vw, (cellH - (labels ? 65 : 24)) / vh);
    const x = gap + col * (cellW + gap) + cellW / 2, y = gap + row * (cellH + gap) + (cellH - (labels ? 36 : 0)) / 2;
    return `<g transform="translate(${x} ${y}) scale(${scale})${repeat && alternate && row % 2 ? ' rotate(180)' : ''} translate(${-vx - vw / 2} ${-vy - vh / 2})">${pathMarkup(m, color)}</g>${labels ? `<text x="${x}" y="${gap + row * (cellH + gap) + cellH - 12}" font-family="sans-serif" font-size="12" text-anchor="middle" fill="${color}">${String(i + 1).padStart(2, '0')} / ${m.name.replace(/[<>&]/g, '')}</text>` : ''}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background !== 'transparent' ? `<rect width="100%" height="100%" fill="${background}"/>` : ''}${groups}</svg>`;
}
