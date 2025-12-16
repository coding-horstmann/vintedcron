'use client';

import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Weiterleitung mit Passwort als Query-Parameter
      // Die Middleware prüft das Passwort
      const currentUrl = new URL(window.location.href);
      const returnUrl = currentUrl.searchParams.get('return') || '/';
      const loginUrl = `${returnUrl}?password=${encodeURIComponent(password)}`;
      
      // Speichere den aktuellen Zeitstempel, um zu erkennen ob wir zurückgeleitet wurden
      sessionStorage.setItem('loginAttempt', Date.now().toString());
      
      // Weiterleitung
      window.location.href = loginUrl;
      
      // Fallback: Wenn nach 3 Sekunden noch auf Login-Seite, war Passwort wahrscheinlich falsch
      setTimeout(() => {
        const attemptTime = sessionStorage.getItem('loginAttempt');
        if (attemptTime && Date.now() - parseInt(attemptTime) > 3000) {
          if (window.location.pathname === '/login' && !window.location.searchParams.get('password')) {
            setError('Falsches Passwort. Bitte versuche es erneut.');
            setIsLoading(false);
            sessionStorage.removeItem('loginAttempt');
          }
        }
      }, 3000);
    } catch (err) {
      setError('Fehler beim Anmelden. Bitte versuche es erneut.');
      setIsLoading(false);
    }
  };

  // Prüfe ob es einen Fehler-Parameter in der URL gibt
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'auth_failed') {
      setError('Falsches Passwort. Bitte versuche es erneut.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-surface p-8 shadow-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Passwort-Schutz</h1>
            <p className="text-slate-400 text-center text-sm">
              Bitte gib das Passwort ein, um auf die Anwendung zuzugreifen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Passwort eingeben"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Anmelden
            </Button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-6">
            Das Passwort wird in den Vercel Umgebungsvariablen als <code className="bg-slate-900 px-1 py-0.5 rounded">APP_PASSWORD</code> gespeichert.
          </p>
        </div>
      </div>
    </div>
  );
}

