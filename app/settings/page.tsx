'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Settings, Plus, Trash2, Edit2, Save, X, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface VintedUrl {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

export default function SettingsPage() {
  const [urls, setUrls] = useState<VintedUrl[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<VintedUrl>>({
    name: '',
    url: '',
    category: '',
    enabled: true
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Deutsch');

  // URLs und Sprache aus localStorage laden
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUrls = localStorage.getItem('vinted-urls');
      if (storedUrls) {
        try {
          const parsed = JSON.parse(storedUrls);
          setUrls(parsed);
        } catch (e) {
          console.error('Fehler beim Laden der URLs');
        }
      } else {
        // Standard-URLs laden
        setUrls([
          {
            id: 'sachbuecher-all',
            name: 'Sachbücher (Sehr gut, Neu, Neu mit Etikett)',
            url: 'https://www.vinted.de/catalog?catalog[]=2320&status_ids[]=1&status_ids[]=2&status_ids[]=6&order=newest_first',
            category: 'Bücher & Medien - Sachbücher',
            enabled: true
          },
          {
            id: 'comics-manga-all',
            name: 'Comics/Manga (Sehr gut, Neu, Neu mit Etikett)',
            url: 'https://www.vinted.de/catalog?catalog[]=5425&status_ids[]=1&status_ids[]=2&status_ids[]=6&order=newest_first',
            category: 'Bücher & Medien - Comics/Manga',
            enabled: true
          },
          {
            id: 'spiele-neu',
            name: 'Spiele (Nur Neu)',
            url: 'https://www.vinted.de/catalog?catalog[]=3026&status_ids[]=6&order=newest_first',
            category: 'Unterhaltung - Spiele',
            enabled: true
          }
        ]);
      }
      
      // Sprache aus localStorage laden
      const storedLanguage = localStorage.getItem('vinted-language-filter');
      if (storedLanguage) {
        setSelectedLanguage(storedLanguage);
      }
    }
  }, []);

  // URLs in localStorage speichern
  const saveUrls = (newUrls: VintedUrl[]) => {
    setUrls(newUrls);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vinted-urls', JSON.stringify(newUrls));
    }
  };

  // Sprache speichern
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vinted-language-filter', language);
    }
  };

  const handleAdd = () => {
    if (!formData.name || !formData.url) {
      alert('Bitte fülle Name und URL aus');
      return;
    }
    const newUrl: VintedUrl = {
      id: `custom-${Date.now()}`,
      name: formData.name || '',
      url: formData.url || '',
      category: formData.category || 'Unbekannt',
      enabled: formData.enabled ?? true
    };
    saveUrls([...urls, newUrl]);
    setFormData({ name: '', url: '', category: '', enabled: true });
    setShowAddForm(false);
  };

  const handleEdit = (id: string) => {
    const url = urls.find(u => u.id === id);
    if (url) {
      setFormData(url);
      setEditingId(id);
      setShowAddForm(true);
    }
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name || !formData.url) return;
    const updated = urls.map(u => 
      u.id === editingId 
        ? { ...u, ...formData } as VintedUrl
        : u
    );
    saveUrls(updated);
    setEditingId(null);
    setShowAddForm(false);
    setFormData({ name: '', url: '', category: '', enabled: true });
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchtest du diese URL wirklich löschen?')) {
      saveUrls(urls.filter(u => u.id !== id));
    }
  };

  const toggleEnabled = (id: string) => {
    const updated = urls.map(u => 
      u.id === id ? { ...u, enabled: !u.enabled } : u
    );
    saveUrls(updated);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Verwalte deine Einstellungen und Vinted-URLs</p>
        </div>

        {/* Vinted URLs Verwaltung */}
        <div className="rounded-xl border border-slate-800 bg-surface p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Vinted URLs
            </h2>
            {!showAddForm && (
              <Button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingId(null);
                  setFormData({ name: '', url: '', category: '', enabled: true });
                }}
                size="sm"
                variant="primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                URL hinzufügen
              </Button>
            )}
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-4 border border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">
                  {editingId ? 'URL bearbeiten' : 'Neue URL hinzufügen'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                    setFormData({ name: '', url: '', category: '', enabled: true });
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="z.B. Sachbücher"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kategorie
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="z.B. Bücher & Medien"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vinted URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://www.vinted.de/catalog?..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Kopiere die vollständige Vinted-Katalog-URL hier ein
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled ?? true}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
                />
                <label htmlFor="enabled" className="text-sm text-slate-300">
                  Aktiviert (wird beim Scan verwendet)
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={editingId ? handleUpdate : handleAdd}
                  variant="primary"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? 'Speichern' : 'Hinzufügen'}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                    setFormData({ name: '', url: '', category: '', enabled: true });
                  }}
                  variant="outline"
                  size="sm"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* URLs Liste */}
          <div className="space-y-2">
            {urls.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">
                Noch keine URLs hinzugefügt
              </p>
            ) : (
              urls.map((url) => (
                <div
                  key={url.id}
                  className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-white">{url.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            url.enabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {url.enabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-1">{url.category}</p>
                      <p className="text-xs text-slate-500 truncate">{url.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleEnabled(url.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          url.enabled
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                        title={url.enabled ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {url.enabled ? '✓' : '○'}
                      </button>
                      <button
                        onClick={() => handleEdit(url.id)}
                        className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(url.id)}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sprache-Filter Einstellung */}
        <div className="rounded-xl border border-slate-800 bg-surface p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Sprache-Filter</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bücher-Sprache filtern
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary"
                >
                  <option value="Alle Sprachen">Alle Sprachen</option>
                  <option value="Deutsch">Deutsch</option>
                  <option value="Französisch">Französisch</option>
                  <option value="Niederländisch">Niederländisch</option>
                  <option value="Englisch">Englisch</option>
                  <option value="Italienisch">Italienisch</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Nur Bücher mit der ausgewählten Sprache werden beim Scraping berücksichtigt. Standard: Deutsch
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* API Konfiguration */}
        <div className="rounded-xl border border-slate-800 bg-surface p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">API Konfiguration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  eBay OAuth2 Credentials
                </label>
                <input
                  type="text"
                  placeholder="Wird aus Umgebungsvariablen geladen"
                  disabled
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Konfiguriere EBAY_CLIENT_ID und EBAY_CLIENT_SECRET in deinen Vercel Umgebungsvariablen
                  <br />
                  Erhältlich von: <a href="https://developer.ebay.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">eBay Developer Portal</a>
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
        </div>
      </div>
    </Layout>
  );
}
