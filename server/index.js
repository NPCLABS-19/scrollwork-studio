import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { traceImage } from './trace.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '18mb' }));
app.get('/api/health', (_, res) => res.json({ ok: true, app: 'Scrollwork Studio' }));
app.post('/api/trace', async (req, res) => {
  try {
    const { image, ...options } = req.body;
    if (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(image)) return res.status(400).json({ error: 'Choose a PNG, JPEG, or WebP reference.' });
    const result = await traceImage(Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'), options);
    res.json(result);
  } catch (error) { res.status(400).json({ error: error.message || 'The image could not be traced.' }); }
});
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
}
app.use((err, _, res, next) => { if (res.headersSent) return next(err); res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'Choose an image smaller than 12 MB.' : 'The request could not be processed.' }); });
const port = Number(process.env.SCROLLWORK_PORT || 4317);
app.listen(port, '127.0.0.1', () => console.log(`Scrollwork Studio ready at http://127.0.0.1:${port}`));
