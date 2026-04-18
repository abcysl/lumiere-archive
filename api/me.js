import { isAuthed } from './_lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ admin: isAuthed(req) });
}
