export const config = {
  matcher: ['/((?!api|login\\.html|logo\\.png|.*\\.(?:png|jpg|ico|svg|css|js|woff|woff2|ttf)$).*)'],
};

export default function middleware(request) {
  const cookie = request.headers.get('cookie') || '';
  const isAuthenticated = cookie.includes('ti-auth=authenticated');

  if (isAuthenticated) {
    return;
  }

  const url = new URL('/login.html', request.url);
  return Response.redirect(url, 302);
}
