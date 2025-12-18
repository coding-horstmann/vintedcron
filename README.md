# VintedHunter - Arbitrage Finder

Ein automatisiertes Tool zum Finden von Arbitrage-Möglichkeiten zwischen Vinted.de und eBay.de.

## Features

- 🔍 **Automatisches Scraping** von Vinted Katalog-URLs
- 💰 **eBay API Integration** für realistische Preisvergleiche
- 🤖 **KI-Fallback** mit Gemini (optional ein/ausschaltbar)
- 📊 **Dashboard** mit Profit- und ROI-Analyse
- ⚙️ **Konfigurierbare URLs** für verschiedene Kategorien
- 🛡️ **Rate Limiting** zum Schutz vor Bot-Erkennung

## Installation

**Prerequisites:** Node.js 18+

1. Dependencies installieren:
```bash
npm install
```

2. Umgebungsvariablen konfigurieren:

Erstelle eine `.env.local` Datei basierend auf `env.example`:

```env
# Gemini AI API Key (optional - nur für KI-Fallback)
GEMINI_API_KEY=your_gemini_api_key_here

# eBay API Konfiguration (OAuth2 - erforderlich für echte Preise)
# Erhältlich von: https://developer.ebay.com/
EBAY_CLIENT_ID=your_ebay_client_id_here
EBAY_CLIENT_SECRET=your_ebay_client_secret_here

# eBay Marketplace ID (Standard: EBAY_DE für Deutschland)
# Verfügbare IDs: EBAY_DE, EBAY_US, EBAY_GB, etc.
EBAY_MARKETPLACE_ID=EBAY_DE
```

3. App starten:
```bash
npm run dev
```

## Konfiguration

### Vinted URLs konfigurieren

Bearbeite `config/vinted-urls.json` um URLs hinzuzufügen oder zu entfernen:

```json
{
  "urls": [
    {
      "id": "sachbuecher-all",
      "name": "Sachbücher (Sehr gut, Neu, Neu mit Etikett)",
      "url": "https://www.vinted.de/catalog?catalog[]=2320&status_ids[]=1&status_ids[]=2&status_ids[]=6&order=newest_first",
      "category": "Bücher & Medien - Sachbücher",
      "enabled": true
    }
  ]
}
```

**Vinted URL Parameter:**
- `catalog[]=2320` = Kategorie-ID (2320 = Sachbücher)
- `status_ids[]=1` = Neu
- `status_ids[]=2` = Sehr gut
- `status_ids[]=6` = Neu mit Etikett
- `order=newest_first` = Sortierung

### eBay API Setup

1. Registriere dich bei [eBay Developers](https://developer.ebay.com/)
2. Erstelle eine neue App (Production oder Sandbox)
3. Kopiere `Client ID` (App ID) und `Client Secret` in deine `.env.local`
4. Die App verwendet automatisch OAuth2 Token-Caching (Token wird 2 Stunden gecacht)

## Verwendung

1. **KI-Toggle**: Aktiviere/deaktiviere den Gemini AI Fallback im Dashboard
2. **Scan starten**: Klicke auf "Start Scan" um die konfigurierten Vinted URLs zu durchsuchen
3. **Ergebnisse analysieren**: Die App zeigt gefundene Arbitrage-Möglichkeiten mit Profit und ROI

## Architektur

- **Frontend**: React + TypeScript + Vite
- **Backend**: Next.js API Routes
- **Scraping**: Axios + Cheerio (Vinted)
- **API**: eBay Browse API mit OAuth2 (automatisches Token-Caching)
- **KI**: Google Gemini (optional)

## Deployment auf Vercel

1. Push zu GitHub
2. Verbinde Repository mit Vercel
3. Setze Umgebungsvariablen in Vercel Dashboard
4. Deploy!

**Wichtig für Vercel:**
- Hobby Plan: 10s Timeout pro Request
- Pro Plan: 60s Timeout pro Request
- Rate Limiting ist wichtig um nicht gesperrt zu werden

## Bot-Schutz

Die App verwendet verschiedene Strategien um Bot-Erkennung zu vermeiden:

- ✅ User-Agent Rotation
- ✅ Rate Limiting (2-5 Sekunden zwischen Requests)
- ✅ Realistische HTTP Headers
- ✅ Referer Header
- ✅ Delays zwischen eBay API Calls

**Hinweis**: Bei intensivem Scraping kann Vinted trotzdem sperren. In diesem Fall:
- Längere Delays verwenden
- Proxies einsetzen
- Weniger Items pro Scan verarbeiten

## Lizenz

MIT
