export const config = {
  matcher: ['/((?!api|login\\.html|login$|logo\\.png|.*\\.(?:png|jpg|ico|svg|css|js|json|woff|woff2|ttf)$).*)'],
};

const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

async function verifyAuthCookie(cookieHeader) {
  if (!cookieHeader) return false;

  const match = cookieHeader.match(/ti-auth=([^;]+)/);
  if (!match) return false;

  const token = match[1];
  if (token === 'authenticated') return false; // reject legacy cookies

  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return false;

  const issuedStr = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const issued = parseInt(issuedStr, 10);
  if (isNaN(issued)) return false;

  // Server-enforced expiry
  const now = Math.floor(Date.now() / 1000);
  if (now - issued > MAX_AGE) return false;
  if (issued > now + 60) return false;

  // Full HMAC verification using crypto.subtle (Edge Runtime compatible)
  const secret = process.env.MODERATION_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(issuedStr));
  const expected = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  return sig === expected;
}

export default async function middleware(request) {
  const cookie = request.headers.get('cookie') || '';

  if (await verifyAuthCookie(cookie)) {
    return;
  }

  const returnTo = encodeURIComponent(request.url);
  const url = new URL('/login.html?returnTo=' + returnTo, request.url);
  return Response.redirect(url, 302);
}
