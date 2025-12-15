'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Verwalte deine Einstellungen und API-Konfigurationen</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-surface p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">API Konfiguration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  eBay API App ID
                </label>
                <input
                  type="text"
                  placeholder="Wird aus Umgebungsvariablen geladen"
                  disabled
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Konfiguriere EBAY_APP_ID in deinen Vercel Umgebungsvariablen
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  placeholder="Wird aus Umgebungsvariablen geladen"
                  disabled
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Konfiguriere GEMINI_API_KEY in deinen Vercel Umgebungsvariablen
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Vinted URLs</h2>
            <p className="text-sm text-slate-400 mb-4">
              Verwaltete Vinted-Katalog-URLs werden in <code className="bg-slate-900 px-2 py-1 rounded text-xs">config/vinted-urls.json</code> konfiguriert.
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-xs text-slate-500">
                Aktuell werden alle aktivierten URLs aus der Konfigurationsdatei verwendet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

