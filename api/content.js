import { readContent, writeContent } from './_lib/store.js';
import { requireAuth } from './_lib/auth.js';
import { SEED_ALBUMS } from './_lib/seed.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const content = await readContent(SEED_ALBUMS);
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60');
      return res.json(content);
    }
    if (req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const body = typeof req.body === 'object' ? req.body : (() => {
        try { return JSON.parse(req.body || '{}'); } catch { return null; }
      })();
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid body' });
      // Validate roughly
      if (!body.profile || !Array.isArray(body.albums)) {
        return res.status(400).json({ error: 'invalid content shape' });
      }
      const saved = await writeContent(body);
      return res.json(saved);
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('content api error', err);
    res.status(500).json({ error: 'server error', detail: String(err && err.message || err) });
  }
}
