import { createHmac } from 'crypto';

const SITE_PASSWORD = process.env.SITE_PASSWORD || 'Grammie1926';
const AUTH_SECRET = process.env.MODERATION_SECRET;
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function createAuthToken() {
  const issued = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', AUTH_SECRET).update(String(issued)).digest('hex');
  return `${issued}.${sig}`;
}

export function verifyAuthToken(token) {
  if (!token || !token.includes('.')) return false;
  const [issuedStr, sig] = token.split('.');
  const issued = parseInt(issuedStr, 10);
  if (isNaN(issued)) return false;

  // Check signature
  const expected = createHmac('sha256', AUTH_SECRET).update(String(issued)).digest('hex');
  if (sig !== expected) return false;

  // Check expiry (server-enforced 30 days)
  const now = Math.floor(Date.now() / 1000);
  if (now - issued > MAX_AGE) return false;

  return true;
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (password === SITE_PASSWORD) {
    const token = createAuthToken();
    res.setHeader('Set-Cookie', `ti-auth=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`);
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Incorrect password' });
}
