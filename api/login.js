import { verifyPassword, makeSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const body = typeof req.body === 'object' ? req.body : (() => {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  })();
  const password = String(body.password || '');
  if (!password) return res.status(400).json({ error: 'password required' });
  if (!verifyPassword(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'invalid password' });
  }
  res.setHeader('Set-Cookie', makeSessionCookie());
  res.json({ ok: true });
}
