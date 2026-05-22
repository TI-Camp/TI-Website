export const config = {
  matcher: ['/((?!api|login\\.html|login$|logo\\.png|.*\\.(?:png|jpg|ico|svg|css|js|json|woff|woff2|ttf)$).*)'],
};

export default function middleware(request) {
  const cookie = request.headers.get('cookie') || '';
  const isAuthenticated = cookie.includes('ti-auth=authenticated');

  if (isAuthenticated) {
    return;
  }

  // Preserve the original URL so login can redirect back with query params intact
  const returnTo = encodeURIComponent(request.url);
  const url = new URL('/login.html?returnTo=' + returnTo, request.url);
  return Response.redirect(url, 302);
}
