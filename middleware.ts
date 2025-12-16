import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Prüfe ob Passwort-Schutz aktiviert ist
  const password = process.env.APP_PASSWORD;
  
  // Wenn kein Passwort gesetzt ist, keinen Schutz aktivieren
  if (!password) {
    return NextResponse.next();
  }

  // Prüfe ob bereits authentifiziert (Cookie)
  const isAuthenticated = request.cookies.get('authenticated')?.value === 'true';

  // Wenn bereits authentifiziert, weiterleiten
  if (isAuthenticated) {
    return NextResponse.next();
  }

  // Prüfe ob es ein Login-Versuch ist
  const url = request.nextUrl.clone();
  const providedPassword = url.searchParams.get('password');

  // Wenn ein Passwort übergeben wurde, prüfe es
  if (providedPassword !== null) {
    if (providedPassword === password) {
      // Passwort korrekt - Cookie setzen und weiterleiten
      // Entferne Passwort aus URL
      url.searchParams.delete('password');
      const response = NextResponse.redirect(url);
      response.cookies.set('authenticated', 'true', {
        httpOnly: true,
        secure: true, // Immer secure auf Vercel (HTTPS)
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 Tage
        path: '/'
      });
      return response;
    } else {
      // Falsches Passwort - zur Login-Seite mit Fehler
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'auth_failed');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Wenn bereits auf Login-Seite, erlauben
  if (url.pathname === '/login') {
    return NextResponse.next();
  }

  // Weiterleitung zur Login-Seite
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.svg (icon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|login).*)',
  ],
};

