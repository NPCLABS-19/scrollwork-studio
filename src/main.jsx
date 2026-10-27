import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Aperture, ArrowDownToLine, ArrowRight, Bookmark, Check, Grid2X2, HelpCircle, Layers3, LockKeyhole, Pause, Play, Plus, RotateCcw, Shuffle, SlidersHorizontal, Sparkles, Upload, X } from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/cormorant-garamond/500.css';
import { FAMILIES, DEFAULT_PARAMS, CRAFT_VERSION, upgradeMotif, generateCatalogue, makeMotif, motifSVG, sheetSVG } from './engine';
import './style.css';

const STORE = 'scrollwork-studio-v1';
const PALETTES = [
  { name: 'Graphite', ink: '#222c25', paper: '#faf8f1' },
  { name: 'Oxblood', ink: '#702f31', paper: '#fbf2e7' },
  { name: 'Cobalt', ink: '#2e4b84', paper: '#f3f4ee' },
  { name: 'Chalk', ink: '#eee9d9', paper: '#263b30' }
];
function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORE)) || {};
    if (state.craftVersion !== CRAFT_VERSION && (state.catalogue || state.saved)) {
      try { if (!localStorage.getItem(`${STORE}-before-craft-v2`)) localStorage.setItem(`${STORE}-before-craft-v2`, JSON.stringify(state)); } catch { /* The existing project remains readable if backup storage is full. */ }
    }
    return { ...state, catalogue: Array.isArray(state.catalogue) ? state.catalogue.map(upgradeMotif) : undefined, saved: Array.isArray(state.saved) ? state.saved.map(upgradeMotif) : [] };
  } catch { return {}; }
}
function seedValue() { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 7).toUpperCase(); }
const initial = readState();
function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function validMotif(m) { return m && typeof m.id === 'string' && typeof m.name === 'string' && Array.isArray(m.paths) && m.paths.length > 0 && m.paths.length < 1000 && m.paths.every(p => typeof p.d === 'string' && p.d.length < 2_000_000 && /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]+$/.test(p.d) && (!p.transform || /^[\d\s.,eE+()\-a-z]+$/.test(p.transform))) && m.viewBox?.length === 4 && m.viewBox.every(Number.isFinite) && m.viewBox[2] > 0 && m.viewBox[3] > 0; }
function IconButton({ title, children, active, ...rest }) { return <button type="button" className={`icon-button${active ? ' active' : ''}`} title={title} aria-label={title} {...rest}>{children}</button>; }
function Motif({ motif, className = '', style, guides = false, onGeometryChange }) {
  const svg = useRef(null), dragging = useRef(null);
  const q = motif.params || DEFAULT_PARAMS;
  function move(e) {
    if (!dragging.current || !onGeometryChange) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current.getScreenCTM().inverse());
    if (dragging.current === 'width') onGeometryChange('width', Math.max(58, Math.min(100, Math.abs(point.x))));
    else onGeometryChange('height', Math.max(105, Math.min(158, Math.abs(point.y) / 1.1)));
  }
  return <svg ref={svg} className={`motif ${className}`} style={style} viewBox={motif.viewBox.join(' ')} role="img" aria-label={`${motif.name}, ${motif.symmetry || 'original motif'}`} onPointerMove={move} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
    <title>{motif.name}</title>
    {guides && <g className="construction"><path d={`M ${motif.viewBox[0]} 0 H ${motif.viewBox[0] + motif.viewBox[2]} M 0 ${motif.viewBox[1]} V ${motif.viewBox[1] + motif.viewBox[3]}`} /><rect x={motif.viewBox[0] + 12} y={motif.viewBox[1] + 12} width={motif.viewBox[2] - 24} height={motif.viewBox[3] - 24} /></g>}
    <g>{motif.paths.map((p, i) => <path key={i} d={p.d} transform={p.transform || undefined} fill={p.fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={p.fill ? 0 : p.strokeWidth ?? (q.weight || 3)} strokeLinecap="round" strokeLinejoin="round" fillRule={p.fillRule || "evenodd"} />)}</g>
    {guides && onGeometryChange && <g className="geometry-handles">{[['width', q.width, 0], ['height', 0, -q.height * 1.1]].map(([name, x, y]) => <g key={name} onPointerDown={e => { e.preventDefault(); svg.current.setPointerCapture(e.pointerId); dragging.current = name; }}><circle cx={x} cy={y} r="15" fill="transparent" stroke="none" /><circle cx={x} cy={y} r="5" /><title>Drag to change {name}</title></g>)}</g>}
  </svg>;
}
function Slider({ label, value, min, max, step = 1, onChange, suffix = '' }) { return <label className="slider-field"><span>{label}<output>{Number(value).toFixed(step < 1 ? 1 : 0)}{suffix}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>; }

function ImportDialog({ source, onClose, onImport }) {
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [threshold, setThreshold] = useState(155), [speckle, setSpeckle] = useState(5), [smoothing, setSmoothing] = useState(.8);
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [invert, setInvert] = useState(false), [name, setName] = useState(source.name.replace(/\.[^.]+$/, ''));
  const [aspect, setAspect] = useState(1.5);
  const frame = useRef(null), origin = useRef(null), close = useRef(null);
  useEffect(() => { close.current.focus(); const handler = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  const point = e => { const rect = frame.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) }; };
  function start(e) { if (busy) return; origin.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); setResult(null); }
  function drag(e) { if (!origin.current) return; const end = point(e), from = origin.current; setCrop({ x: Math.min(from.x, end.x), y: Math.min(from.y, end.y), w: Math.max(.003, Math.abs(end.x - from.x)), h: Math.max(.003, Math.abs(end.y - from.y)) }); }
  function setCropValue(key, percent) {
    const value = Math.max(0, Math.min(1, Number(percent) / 100 || 0));
    setCrop(previous => {
      const next = { ...previous, [key]: value };
      next.x = Math.min(.995, next.x); next.y = Math.min(.995, next.y);
      next.w = Math.max(.005, Math.min(1 - next.x, next.w));
      next.h = Math.max(.005, Math.min(1 - next.y, next.h));
      return next;
    });
    setResult(null);
  }
  async function trace() {
    setBusy(true); setError('');
    try { const { traceImageInBrowser } = await import('./trace-browser.js'); const json = await traceImageInBrowser(source.data, { crop, threshold, speckle, smoothing, invert }); setResult({ ...json, id: `import-${Date.now()}`, name: name || 'Imported motif', family: 'heart', seed: 'Imported', source: 'imported', symmetry: 'Original outline', params: { weight: 0 } }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onKeyDown={e => { if (e.key !== 'Tab') return; const nodes = [...e.currentTarget.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]')]; if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); } }}>
    <header><div><h2 id="import-title">Bring a reference into the studio.</h2><p>Drag a rectangle around one ornament, leaving out labels.</p></div><button ref={close} className="icon-button" aria-label="Close import" onClick={onClose}><X size={19} /></button></header>
    <div className="import-content"><div className="source-pane"><div ref={frame} className="crop-frame" style={{ aspectRatio: aspect, maxWidth: Math.min(580, 420 * aspect) }} onPointerDown={start} onPointerMove={drag} onPointerUp={() => { origin.current = null; }} onPointerCancel={() => { origin.current = null; }}>
      <img src={source.data} alt="Uploaded reference; drag to select an ornament" draggable="false" onLoad={e => setAspect(e.target.naturalWidth / e.target.naturalHeight)} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><mask id="crop-hole"><rect width="100" height="100" fill="white" /><rect x={crop.x * 100} y={crop.y * 100} width={crop.w * 100} height={crop.h * 100} fill="black" /></mask></defs><rect width="100" height="100" fill="black" opacity=".4" mask="url(#crop-hole)" /><rect x={crop.x * 100} y={crop.y * 100} width={crop.w * 100} height={crop.h * 100} fill="none" stroke="#c7e6bd" strokeWidth=".45" vectorEffect="non-scaling-stroke" /></svg>
    </div><div className="crop-numbers" role="group" aria-label="Crop region in percentages">{[['x', 'Left'], ['y', 'Top'], ['w', 'Width'], ['h', 'Height']].map(([key, label]) => <label key={key}>{label} (%)<input type="number" aria-label={`Crop ${label.toLowerCase()} (%)`} min={key === 'w' || key === 'h' ? .5 : 0} max="100" step=".5" value={Math.round(crop[key] * 1000) / 10} onChange={e => setCropValue(key, e.target.value)} /></label>)}</div><button className="text-button" onClick={() => { setCrop({ x: 0, y: 0, w: 1, h: 1 }); setResult(null); }}>Use full image</button></div>
    <div className="trace-controls"><label className="input-label">Motif name<input value={name} onChange={e => { setName(e.target.value); if (result) setResult({ ...result, name: e.target.value }); }} maxLength={60} /></label>
      <Slider label="Ink threshold" value={threshold} min={20} max={240} onChange={v => { setThreshold(v); setResult(null); }} />
      <Slider label="Speckle cleanup" value={speckle} min={0} max={50} onChange={v => { setSpeckle(v); setResult(null); }} />
      <Slider label="Curve smoothing" value={smoothing} min={0} max={1.3} step={.1} onChange={v => { setSmoothing(v); setResult(null); }} />
      <label className="check-field"><input type="checkbox" checked={invert} onChange={e => { setInvert(e.target.checked); setResult(null); }} />Light motif on a dark background</label>
      <button className="button primary" disabled={busy} onClick={trace}>{busy ? <><span className="spinner" />Tracing curves…</> : <><Aperture size={16} />Trace selected region</>}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {result && <div className="trace-result"><Motif motif={result} /><span><Check size={15} /> {(result.metrics.maskIoU * 100).toFixed(1)}% source-mask overlap</span><p>Compared with the cropped, thresholded image. This measures silhouette fidelity, not design quality.</p></div>}
    </div></div>
    <footer><span>Your image stays on this computer.</span><button className="button primary" disabled={!result || busy} onClick={() => onImport({ ...result, name: name || result.name })}><Plus size={16} />Add motif to catalogue</button></footer>
  </section></div>;
}

function Notes() { return <article className="notes"><h2>The rules behind the curves.</h2><p>These ornaments feel alive because their movement is ordered: mirrored silhouettes contain broad, slow bends, tighter curls, and carefully shaped empty spaces.</p><div className="notes-grid"><section><h3>Preserve the reference</h3><p>A crop removes catalogue labels. Thresholding separates ink from paper; Potrace converts the silhouette into closed Bézier outlines. Cleanup and smoothing are adjustable because a scan cannot tell us which irregularities were intentional.</p><p>The overlap value is intersection over union between the trace and its thresholded source mask. It does not measure resemblance to an unknown original drawing.</p></section><section><h3>Generate the structure</h3><p>Six construction families use paired C-scrolls, mirrored heart forms, bowed diamonds, fourfold lobes, collars, and rosettes. Cubic Bézier curves create the broad-to-tight transitions. Transforming the same curve enforces exact symmetry.</p><p>Variation operates within parameter bounds. A saved seed reproduces the same sheet. This is a procedural grammar, not a model trained on these images.</p></section><section><h3>Compose the sheet</h3><p>The catalogue arranges distinct ornaments. Repeat uses exact copies of the selected motif, with an optional alternating rotation. Open tile gaps are deliberate: repeat does not automatically invent connecting ironwork at the edges.</p><p>Imported outlines retain their original shape; procedural controls apply to generated motifs. Use “Explore this family” for related constructions.</p></section><section><h3>Research & further accuracy</h3><p>Recovering editable construction curves from any image would require skeleton extraction, junction interpretation, symmetry estimation, curve fitting, and a correction interface. A silhouette trace preserves appearance but cannot recover hidden rods at crossings.</p><a href="https://potrace.sourceforge.net/potrace.pdf" target="_blank" rel="noreferrer">Selinger: the Potrace algorithm <ArrowRight size={14} /></a><a href="https://graphics.stanford.edu/~yitingy/papers/symmetry.pdf" target="_blank" rel="noreferrer">Detecting symmetries in vector art <ArrowRight size={14} /></a><a href="https://paperjs.org/tutorials/paths/smoothing-simplifying-flattening/" target="_blank" rel="noreferrer">Curve smoothing and simplification <ArrowRight size={14} /></a></section></div></article>; }

function App() {
  const [catalogue, setCatalogue] = useState(() => initial.catalogue?.every(validMotif) && initial.catalogue.length ? initial.catalogue : generateCatalogue('FIELD-001'));
  const [selectedIndex, setSelectedIndex] = useState(0), [mode, setMode] = useState('catalogue');
  const [seed, setSeed] = useState(initial.seed || 'FIELD-001'), [family, setFamily] = useState('all');
  const [columns, setColumns] = useState(3), [count, setCount] = useState(9), [gap, setGap] = useState(30);
  const [paletteIndex, setPaletteIndex] = useState(0), [labels, setLabels] = useState(true), [alternate, setAlternate] = useState(false);
  const [guides, setGuides] = useState(false), [live, setLive] = useState(false), [locked, setLocked] = useState([]);
  const [saved, setSaved] = useState(() => initial.saved?.filter(validMotif) || []), [archive, setArchive] = useState([]);
  const [toast, setToast] = useState(''), [source, setSource] = useState(null), [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState([]), [overlay, setOverlay] = useState(false), [sheetSource, setSheetSource] = useState('Generated collection');
  const file = useRef(null), toastTimer = useRef(null), stage = useRef(null);
  const palette = PALETTES[paletteIndex];
  const selected = catalogue[Math.min(selectedIndex, catalogue.length - 1)] || catalogue[0];
  const displayed = mode === 'saved' ? saved : mode === 'repeat' ? Array.from({ length: count }, () => selected) : catalogue;
  function notify(message) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3400); }
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}references/archive.json`).then(r => r.json()).then(setArchive).catch(() => {}); }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ catalogue, saved, seed, craftVersion: CRAFT_VERSION })); } catch { notify('Browser storage is full. Export a project to keep your work.'); } }, [catalogue, saved, seed]);
  useEffect(() => { if (!live) return; const interval = setInterval(() => generate(), 4500); return () => clearInterval(interval); }, [live, family, count, catalogue, locked]);
  useEffect(() => { function keys(e) { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || source || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key.toLowerCase() === 'g') generate(); if (e.key.toLowerCase() === 'f') saveMotif(selected); if (e.key === 'ArrowRight') setSelectedIndex(i => (i + 1) % catalogue.length); if (e.key === 'ArrowLeft') setSelectedIndex(i => (i + catalogue.length - 1) % catalogue.length); } window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys); });
  function generate(nextSeed = seedValue(), customFamily = family, baseParams) {
    setHistory(h => [...h.slice(-19), { catalogue, seed, sheetSource }]);
    const next = generateCatalogue(nextSeed, count, { family: customFamily, baseParams });
    locked.forEach(i => { if (catalogue[i] && i < next.length) next[i] = catalogue[i]; });
    setCatalogue(next); setSeed(nextSeed); setSelectedIndex(0); setMode('catalogue'); setSheetSource('Generated collection'); setOverlay(false);
  }
  function undo() { const prev = history.at(-1); if (!prev) return; setCatalogue(prev.catalogue); setSeed(prev.seed); setSheetSource(prev.sheetSource); setHistory(h => h.slice(0, -1)); setSelectedIndex(0); setLive(false); }
  function updateParam(key, value) { setLive(false); setCatalogue(items => items.map((m, i) => i === selectedIndex ? makeMotif(m.family, { ...m.params, [key]: value }, m.seed) : m)); }
  function saveMotif(m) { if (saved.some(x => x.id === m.id)) { setSaved(s => s.filter(x => x.id !== m.id)); notify('Removed from saved motifs.'); } else { setSaved(s => [...s, structuredClone(m)]); notify('Motif saved.'); } }
  function selectMotif(index) { setLive(false); setSelectedIndex(index); setOverlay(false); }
  function loadArchive() { if (!archive.length) return notify('Reference archive is still loading. Try again in a moment.'); setHistory(h => [...h.slice(-19), { catalogue, seed, sheetSource }]); setCatalogue(structuredClone(archive)); setSelectedIndex(0); setLocked([]); setLive(false); setMode('catalogue'); setSheetSource('Your reference archive'); setSeed('REFERENCE'); }
  function addImported(motif) { setCatalogue(prev => [motif, ...prev].slice(0, 25)); setSelectedIndex(0); setSource(null); setMode('catalogue'); setSheetSource('Collection with imported reference'); setLocked([]); setLive(false); notify('Reference traced and added. Its outline is preserved.'); }
  async function openFile(event) {
    const selectedFile = event.target.files?.[0]; event.target.value = ''; if (!selectedFile) return;
    if (selectedFile.size > 12 * 1024 * 1024) return notify('Choose an image or project smaller than 12 MB.');
    try {
      if (/\.json$/i.test(selectedFile.name)) {
        const data = JSON.parse(await selectedFile.text());
        if (data.version !== 1 || !Array.isArray(data.catalogue) || !data.catalogue.length || data.catalogue.length > 100 || !data.catalogue.every(validMotif) || !Array.isArray(data.saved) || data.saved.length > 100 || !data.saved.every(validMotif)) throw new Error('Choose a Scrollwork Studio project exported by this app.');
        setCatalogue(data.catalogue.map(upgradeMotif)); setSaved(data.saved.map(upgradeMotif)); setSeed(String(data.seed || 'RESTORED')); setSelectedIndex(0); setMode('catalogue'); setLive(false); setLocked([]); notify('Project restored.'); return;
      }
      if (/\.svg$/i.test(selectedFile.name)) {
        const doc = new DOMParser().parseFromString(await selectedFile.text(), 'image/svg+xml');
        if (doc.querySelector('parsererror')) throw new Error('This SVG could not be parsed.');
        const inherited = (node, attr, fallback) => { for (let item = node; item; item = item.parentElement) { const inline = item.getAttribute('style')?.split(';').map(pair => pair.split(':').map(v => v.trim())).find(pair => pair[0] === attr)?.[1]; const value = inline || item.getAttribute(attr); if (value && value !== 'inherit') return value; } return fallback; };
        const root = doc.documentElement, vb = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) || [0, 0, parseFloat(root.getAttribute('width')), parseFloat(root.getAttribute('height'))];
        const paths = [...doc.querySelectorAll('path')].map(el => {
          const transforms = []; let current = el;
          while (current && current !== root.parentNode) { const t = current.getAttribute('transform'); if (t && /^[\d\s.,eE+()\-a-z]+$/.test(t)) transforms.unshift(t); current = current.parentElement; }
          return { d: el.getAttribute('d') || '', transform: transforms.join(' '), fill: inherited(el, 'fill', 'black') !== 'none', strokeWidth: Math.min(1000, Math.max(.1, parseFloat(inherited(el, 'stroke-width', '1')) || 1)), fillRule: inherited(el, 'fill-rule', 'nonzero') === 'evenodd' ? 'evenodd' : 'nonzero' };
        });
        if (doc.querySelector('use,text,rect,circle,ellipse,polygon,polyline,line,clipPath,mask,style') || !paths.length || paths.some(p => !p.d)) throw new Error('Import an SVG made only of paths. Convert shapes and text to paths and flatten masks first.');
        const m = { id: `svg-${Date.now()}`, name: selectedFile.name.replace(/\.svg$/i, ''), paths, viewBox: vb, family: 'heart', source: 'imported', symmetry: 'Original outline', seed: 'SVG import', params: { weight: parseFloat(root.getAttribute('stroke-width')) || 3 } };
        if (!validMotif(m)) throw new Error('The SVG needs a valid viewBox and path geometry.'); addImported(m); return;
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(selectedFile.type)) throw new Error('Choose a PNG, JPEG, WebP, path-based SVG, or studio project.');
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(selectedFile); });
      setSource({ data, name: selectedFile.name }); setLive(false);
    } catch (e) { notify(e.message || 'The file could not be opened.'); }
  }
  function exportSheet() {
    if (!displayed.length) return notify('Save a motif before exporting this collection.');
    download(sheetSVG(displayed, { columns, gap, labels, color: palette.ink, background: palette.paper, repeat: mode === 'repeat', alternate }), `scrollwork-${seed.toLowerCase()}-sheet.svg`, 'image/svg+xml'); notify('Vector sheet exported.');
  }
  async function exportPNG() {
    if (!displayed.length) return notify('Save a motif before exporting this collection.');
    setExporting(true);
    try { const text = sheetSVG(displayed, { columns, gap, labels, color: palette.ink, background: palette.paper, repeat: mode === 'repeat', alternate }); const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); const img = new Image(); await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; }); const canvas = document.createElement('canvas'); canvas.width = 3600; canvas.height = Math.round(3600 * img.height / img.width); const context = canvas.getContext('2d'); context.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error(); const a = document.createElement('a'), blobURL = URL.createObjectURL(blob); a.href = blobURL; a.download = `scrollwork-${seed.toLowerCase()}-3600px.png`; a.click(); setTimeout(() => URL.revokeObjectURL(blobURL), 1000); notify('High-resolution PNG exported.'); } catch { notify('PNG export failed. Try the SVG export instead.'); } finally { setExporting(false); }
  }
  const isSaved = selected && saved.some(x => x.id === selected.id);
  return <div className="app" style={{ '--paper': palette.paper, '--ink': palette.ink }}>
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setMode('catalogue'); }}><span className="brand-mark"><Aperture size={22} strokeWidth={1.3} /></span><span>Scrollwork<span className="brand-studio"> studio</span></span></a><span className="header-note">A study in curves.</span><div className="header-actions"><span className="local-indicator"><i />Local workspace</span><button className="button subtle" onClick={() => { download(JSON.stringify({ version: 1, catalogue, saved, seed }, null, 2), `scrollwork-${seed.toLowerCase()}.json`, 'application/json'); notify('Project exported. Import it to restore your collection.'); }}><ArrowDownToLine size={15} />Save project</button></div></header>
    <div className="workspace">
      <aside className="sidebar"><div className="side-section"><div className="section-label">Library</div><nav className="library-nav" aria-label="Workspace views"><button className={mode === 'catalogue' ? 'selected' : ''} onClick={() => setMode('catalogue')}><Grid2X2 size={17} />Catalogue<span>{catalogue.length}</span></button><button className={mode === 'repeat' ? 'selected' : ''} onClick={() => { setMode('repeat'); setLive(false); }}><Layers3 size={17} />Repeat study</button><button className={mode === 'saved' ? 'selected' : ''} onClick={() => { setMode('saved'); setLive(false); }}><Bookmark size={17} />Saved motifs<span>{saved.length}</span></button></nav></div>
      <div className="side-section family-section"><div className="section-label">Construction family</div><button className={`family-option ${family === 'all' ? 'chosen' : ''}`} onClick={() => setFamily('all')}><span className="family-radio" />All constructions<span className="family-count">6</span></button>{FAMILIES.map(f => <button className={`family-option ${family === f.id ? 'chosen' : ''}`} key={f.id} onClick={() => setFamily(f.id)}><span className="family-radio" />{f.name}</button>)}<p className="small-note">Choose a family for the next sheet.</p></div>
      <div className="side-section reference-section"><div className="section-label">From your references</div><button className="archive-preview" onClick={loadArchive} aria-label="Open original reference archive">{archive.slice(0, 3).map(m => <Motif key={m.id} motif={m} />)}</button><button className="text-button archive-link" onClick={loadArchive}>Open reference archive <ArrowRight size={14} /></button><p className="small-note">Ten silhouettes traced from your two images.</p><button className="button import-button" onClick={() => file.current.click()}><Upload size={16} />Import a motif</button><input ref={file} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml,.json" onChange={openFile} /></div>
      <div className="sidebar-bottom"><button className={`text-button ${mode === 'notes' ? 'active' : ''}`} onClick={() => { setMode('notes'); setLive(false); }}><HelpCircle size={15} />The rules behind the curves</button><span>Made of lines. Full of possibility.</span></div></aside>
      <main className="main"><div className="workspace-heading"><div><h1>{mode === 'repeat' ? 'Rhythm, repeated.' : mode === 'saved' ? 'The ones worth keeping.' : mode === 'notes' ? 'A little structure. A lot of life.' : 'A catalogue of possibilities.'}</h1><p>{mode === 'repeat' ? 'One ornament, a different kind of rhythm.' : mode === 'saved' ? 'Your collected motifs, ready to revisit and export.' : mode === 'notes' ? 'How the references become editable vector studies.' : 'Explore the space between precision and ornament.'}</p></div><div className="heading-actions"><IconButton title="Previous sheet" disabled={!history.length} onClick={undo}><RotateCcw size={17} /></IconButton><button className="button primary generate-button" onClick={() => generate()}><Shuffle size={16} />New sheet<span className="key-hint">G</span></button></div></div>
      {mode !== 'notes' && <div className="sheet-toolbar"><div className="sheet-description"><span className="sheet-dot" />{mode === 'repeat' ? selected.name : mode === 'saved' ? 'Saved collection' : sheetSource}<span className="toolbar-divider" /><span>{displayed.length} motifs</span></div><div className="sheet-controls"><label title="Grid columns"><Grid2X2 size={14} /><select aria-label="Grid columns" value={columns} onChange={e => setColumns(Number(e.target.value))}><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option></select></label><IconButton title={labels ? 'Hide captions' : 'Show captions'} active={labels} onClick={() => setLabels(!labels)}><SlidersHorizontal size={15} /></IconButton><button className="button export-sheet" onClick={exportSheet}><ArrowDownToLine size={15} />Export sheet</button></div></div>}
      {mode === 'notes' ? <Notes /> : <div ref={stage} className={`sheet ${mode === 'repeat' ? 'repeat-sheet' : ''}`} style={{ '--columns': columns, '--tile-gap': `${gap / 2}px` }}>
        {displayed.length === 0 && <div className="empty-state"><Bookmark size={32} strokeWidth={1} /><h2>A collection starts with one curve.</h2><p>Select a motif in the catalogue and save it here.</p><button className="button primary" onClick={() => setMode('catalogue')}>Explore the catalogue <ArrowRight size={15} /></button></div>}
        {displayed.map((m, i) => <div className={`specimen ${mode === 'catalogue' && i === selectedIndex ? 'is-selected' : ''}`} key={`${m.id}-${i}`} style={{ '--i': i }}>
          <button className="specimen-main" aria-label={`Select ${m.name} ${i + 1}`} aria-pressed={mode === 'catalogue' && i === selectedIndex} onClick={() => { if (mode === 'saved') { setCatalogue([structuredClone(m), ...catalogue.filter(x => x.id !== m.id)]); setSelectedIndex(0); setMode('catalogue'); setLocked([]); } else if (mode === 'catalogue') selectMotif(i); }}><Motif motif={m} style={{ transform: mode === 'repeat' && alternate && Math.floor(i / columns) % 2 ? 'rotate(180deg)' : undefined }} /><span className={`specimen-caption ${labels ? '' : 'invisible'}`}><span className="specimen-number">{String(i + 1).padStart(2, '0')}</span><span>{m.name}</span><span className="specimen-source">{m.source === 'generated' ? 'STUDY' : 'TRACE'}</span></span></button>
          <div className="tile-actions"><IconButton title={saved.some(x => x.id === m.id) ? 'Unsave motif' : 'Save motif'} active={saved.some(x => x.id === m.id)} onClick={() => saveMotif(m)}><Bookmark size={14} fill={saved.some(x => x.id === m.id) ? 'currentColor' : 'none'} /></IconButton>{mode === 'catalogue' && <IconButton title={locked.includes(i) ? 'Unlock motif' : 'Lock motif for next sheet'} active={locked.includes(i)} onClick={() => setLocked(v => v.includes(i) ? v.filter(x => x !== i) : [...v, i])}><LockKeyhole size={14} /></IconButton>}</div>
          {mode === 'catalogue' && i === selectedIndex && <span className="selection-corner"><Check size={10} /></span>}
        </div>)}
      </div>}
      <footer className="workspace-footer"><span>{mode === 'notes' ? 'Built from curves, not image generation.' : 'Every curve has a counterpart.'}</span><span>SVG artwork <span className="footer-dot">·</span> {mode === 'repeat' ? 'Exact motif repeats' : 'Seeded & reproducible'}</span></footer></main>
      <aside className="inspector" aria-label="Selected motif controls"><div className="inspector-heading"><span className="section-label">Selected motif</span><span>{String(Math.min(selectedIndex + 1, catalogue.length)).padStart(2, '0')} / {String(catalogue.length).padStart(2, '0')}</span></div>
        <div className="inspector-preview"><Motif motif={selected} guides={guides && selected.source === 'generated'} onGeometryChange={selected.source === 'generated' ? updateParam : undefined} />{overlay && selected.preview && <img className="source-overlay" src={selected.preview} alt="Thresholded source overlay" />}</div>
        <div className="motif-title"><h2>{selected.name}</h2><IconButton title={isSaved ? 'Unsave selected motif' : 'Save selected motif'} active={isSaved} onClick={() => saveMotif(selected)}><Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} /></IconButton></div><p className="motif-description">{selected.source === 'generated' ? FAMILIES.find(f => f.id === selected.family)?.description : 'A preserved vector outline from your reference.'}</p><div className="symmetry-label"><Aperture size={13} />{selected.symmetry}</div>
        {selected.source === 'generated' ? <div className="inspector-controls"><Slider label="Breadth" value={selected.params.width} min={58} max={100} onChange={v => updateParam('width', v)} /><Slider label="Height" value={selected.params.height} min={105} max={158} onChange={v => updateParam('height', v)} /><Slider label="Curl character" value={selected.params.curl} min={20} max={90} onChange={v => updateParam('curl', v)} /><Slider label="Line weight" value={selected.params.weight} min={6} max={14} step={.1} onChange={v => updateParam('weight', v)} />{['heart', 'quatrefoil'].includes(selected.family) && <label className="check-field"><input type="checkbox" checked={selected.params.terminals} onChange={e => updateParam('terminals', e.target.checked)} />Floral & leaf terminals</label>}<label className="check-field"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Construction guides & drag handles</label></div> : <div className="trace-info">{selected.metrics && <><strong>{(selected.metrics.maskIoU * 100).toFixed(1)}% source-mask overlap</strong><p>Silhouette agreement with the thresholded crop.</p></>}{selected.preview && <label className="check-field"><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} />Overlay thresholded source</label>}<label className="input-label">Related construction<select value={family === 'all' ? selected.family : family} onChange={e => setFamily(e.target.value)}>{FAMILIES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button className="button explore-family" onClick={() => generate(seedValue(), family === 'all' ? selected.family : family)}><Sparkles size={15} />Explore this family</button><p className="small-note">Creates related procedural motifs; the traced outline stays in your archive or saved collection.</p></div>}
        <div className="side-section palette-section"><div className="section-label">Ink & paper</div><div className="palette-row">{PALETTES.map((c, i) => <button key={c.name} title={c.name} aria-label={`${c.name} palette`} aria-pressed={paletteIndex === i} className={`palette-swatch ${paletteIndex === i ? 'chosen' : ''}`} style={{ background: c.paper, color: c.ink }} onClick={() => setPaletteIndex(i)}><span style={{ background: c.ink }} />{paletteIndex === i && <Check size={11} />}</button>)}<span>{palette.name}</span></div></div>
        <div className="export-motif"><button className="button" onClick={() => { download(motifSVG(selected, { color: palette.ink }), `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`, 'image/svg+xml'); notify('Motif exported as a transparent SVG.'); }}><ArrowDownToLine size={15} />Export motif <span>SVG</span></button><button className="text-button" disabled={exporting} onClick={exportPNG}>{exporting ? 'Rendering PNG…' : 'Export sheet as PNG'}<ArrowRight size={14} /></button></div>
      </aside>
    </div>
    <footer className="generator-bar"><div className="seed-control"><label htmlFor="seed">Sheet seed</label><input id="seed" aria-label="Sheet seed" value={seed} onChange={e => setSeed(e.target.value.toUpperCase().slice(0, 30))} onKeyDown={e => { if (e.key === 'Enter') generate(seed); }} /><IconButton title="Regenerate from this seed" onClick={() => generate(seed)}><RotateCcw size={14} /></IconButton></div><div className="generation-settings"><label>Motifs<select aria-label="Motif count" value={count} onChange={e => setCount(Number(e.target.value))}><option value={9}>9</option><option value={16}>16</option><option value={25}>25</option></select></label>{mode === 'repeat' ? <label className="check-field"><input type="checkbox" checked={alternate} onChange={e => setAlternate(e.target.checked)} />Alternate rotation</label> : <span className="locked-note">{locked.length ? `${locked.length} locked` : 'Lock a motif to keep it'}</span>}<label className="spacing-control">Spacing<input aria-label="Sheet spacing" type="range" min="0" max="70" value={gap} onChange={e => setGap(Number(e.target.value))} /></label></div><button className={`button endless-button ${live ? 'running' : ''}`} aria-pressed={live} onClick={() => { setLive(!live); setMode('catalogue'); }}>{live ? <Pause size={15} /> : <Play size={15} />}{live ? 'Pause exploration' : 'Endless exploration'}<span className="live-dot" /></button></footer>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    {source && <ImportDialog source={source} onClose={() => { setSource(null); file.current?.focus(); }} onImport={addImported} />}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
