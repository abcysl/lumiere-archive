import crypto from 'node:crypto';

const COOKIE_NAME = 'lumiere_session';
const SESSION_DAYS = 30;

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is not set');
  return s;
}

function getPasswordHash() {
  const h = process.env.ADMIN_PASSWORD_HASH;
  if (!h) throw new Error('ADMIN_PASSWORD_HASH env var is not set');
  return h.toLowerCase();
}

export function hashPassword(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}

export function verifyPassword(plain) {
  const expected = getPasswordHash();
  const got = hashPassword(plain);
  if (expected.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function makeSessionCookie() {
  const payload = `admin.${Date.now()}.${crypto.randomBytes(8).toString('hex')}`;
  const sig = sign(payload);
  const value = `${payload}.${sig}`;
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function isAuthed(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((s) => s.trim()).filter(Boolean).map((c) => {
      const eq = c.indexOf('=');
      return [c.slice(0, eq), decodeURIComponent(c.slice(eq + 1))];
    }),
  );
  const value = cookies[COOKIE_NAME];
  if (!value) return false;
  const lastDot = value.lastIndexOf('.');
  if (lastDot < 0) return false;
  const payload = value.slice(0, lastDot);
  const sig = value.slice(lastDot + 1);
  let expected;
  try { expected = sign(payload); } catch { return false; }
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

export function requireAuth(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
