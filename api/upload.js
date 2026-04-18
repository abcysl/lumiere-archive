import { put } from '@vercel/blob';
import { isAuthed } from './_lib/auth.js';

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' });

  const body = typeof req.body === 'object' ? req.body : (() => {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  })();
  const { dataUrl, name } = body || {};
  if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl required' });

  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return res.status(400).json({ error: 'invalid dataUrl' });

  const mime = match[1].toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(mime)) {
    return res.status(400).json({ error: 'unsupported image type' });
  }
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'too large' });

  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const baseName = String(name || 'image').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'image';
  const filename = `${baseName}.${ext}`;

  try {
    const blob = await put(filename, buf, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: true,
    });
    res.json({ url: blob.url });
  } catch (err) {
    console.error('blob upload error', err);
    res.status(500).json({ error: String(err && err.message || err) });
  }
}
