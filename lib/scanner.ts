import { GoogleGenAI, Type } from "@google/genai";
import { ArbitrageDeal } from '@/types';

/**
 * ORCHESTRATOR
 * 
 * 1. Tries to call the Next.js Server API (/api/scan).
 *    - Works if deployed on Vercel.
 *    - Works if running a full Next.js local server.
 * 
 * 2. If API fails (e.g. 404, Network Error, or client-side only env),
 *    falls back to Gemini AI Simulation (nur wenn useAI=true).
 * 
 * @param useAI - Wenn true, wird bei API-Fehler Gemini AI verwendet. Wenn false, wird leeres Array zurückgegeben.
 * @param specificUrlId - Optional: ID einer spezifischen URL aus vinted-urls.json, um nur diese zu scannen
 */
// Exportiere AbortController-Typ für externe Verwendung
export type ScanAbortController = AbortController;

export const scanDeals = async (
  useAI: boolean = false, 
  specificUrlId?: string,
  abortController?: AbortController
): Promise<ArbitrageDeal[]> => {
  
  // --- STRATEGY 1: REAL SERVER SCRAPING ---
  try {
    console.log("Client: Attempting to fetch from /api/scan...");
    
    // URLs aus localStorage laden, falls vorhanden
    let customUrls: any[] | null = null;
    if (typeof window !== 'undefined') {
      const storedUrls = localStorage.getItem('vinted-urls');
      if (storedUrls) {
        try {
          const allUrls = JSON.parse(storedUrls);
          // Wenn specificUrlId angegeben, filtere nur diese URL
          if (specificUrlId) {
            customUrls = allUrls.filter((u: any) => u.id === specificUrlId);
          } else {
            customUrls = allUrls;
          }
        } catch (e) {
          console.warn('Fehler beim Laden der URLs aus localStorage');
        }
      }
    }
    
    // Verwende übergebenen AbortController oder erstelle neuen
    const controller = abortController || new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 Minuten timeout für vollständige Scans (ausreichend für 2-3 Kategorien)

    // Sprache-Einstellung aus localStorage laden
    let languageFilter = 'Deutsch'; // Standard
    if (typeof window !== 'undefined') {
      const storedLanguage = localStorage.getItem('vinted-language-filter');
      if (storedLanguage) {
        languageFilter = storedLanguage;
      }
    }

    // URLs und Sprache als Query-Parameter senden
    const params = new URLSearchParams();
    if (customUrls && customUrls.length > 0) {
      params.append('urls', JSON.stringify(customUrls));
    }
    params.append('language', languageFilter);
    
    const url = `/api/scan?${params.toString()}`;

    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        console.log(`Client: Successfully fetched ${data.length} deals from server API`);
        // Convert string dates back to Date objects if necessary
        return data.map(d => ({
          ...d, 
          timestamp: d.timestamp ? new Date(d.timestamp) : new Date()
        }));
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.warn("Client: /api/scan endpoint error. Status:", response.status, errorData);
    }
  } catch (e: any) {
    // Prüfe ob Request abgebrochen wurde
    if (e.name === 'AbortError' || e.message?.includes('aborted')) {
      console.log("Client: Scan wurde abgebrochen");
      throw new Error('Scan wurde abgebrochen');
    }
    console.warn("Client: Could not reach backend API:", e);
  }

  // --- STRATEGY 2: AI SIMULATION (Fallback nur wenn aktiviert) ---
  if (useAI) {
    console.log("Client: Falling back to AI Simulation...");
    return scanWithAI();
  }
  
  // Wenn KI deaktiviert und API fehlgeschlagen, leeres Array zurückgeben
  console.log("Client: API failed and AI is disabled. Returning empty array.");
  return [];
};

// ... Internal AI Logic (Moved to helper function) ...

async function scanWithAI(): Promise<ArbitrageDeal[]> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return getFallbackData();

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Act as a web scraper. Generate 5 realistic arbitrage deals (Vinted.de vs eBay.de sold).
      Categories: Video Games, Manga, Non-fiction Books.
      Return JSON array with title, vintedPrice, ebayPrice, category, condition.
      Make sure ebayPrice > vintedPrice * 1.4.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                vintedPrice: { type: Type.NUMBER },
                ebayPrice: { type: Type.NUMBER },
                category: { type: Type.STRING },
                condition: { type: Type.STRING },
              },
              required: ["title", "vintedPrice", "ebayPrice", "category", "condition"]
            }
          }
      }
    });

    const rawDeals = JSON.parse(response.text || "[]");

    return rawDeals.map((deal: any, index: number) => {
        const shippingCost = 4.50;
        const fees = deal.ebayPrice * 0.11;
        const profitRaw = deal.ebayPrice - deal.vintedPrice;
        const profitAfterFees = profitRaw - fees - shippingCost;
        const color = deal.category.toLowerCase().includes('game') ? '8b5cf6' : 
                      deal.category.toLowerCase().includes('manga') ? 'f43f5e' : '3b82f6';

        return {
          id: `sim-${Date.now()}-${index}`,
          vinted: {
              id: `v-${index}`,
              title: deal.title,
              price: deal.vintedPrice,
              url: `https://www.vinted.de/items?search_text=${encodeURIComponent(deal.title)}`,
              condition: deal.condition || 'Sehr gut',
              imageUrl: `https://placehold.co/400x400/${color}/white?text=${encodeURIComponent(deal.title.slice(0,5))}`,
              category: deal.category
          },
          ebay: {
              price: deal.ebayPrice,
              url: `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(deal.title)}&LH_Sold=1`,
              title: deal.title
          },
          profit: profitRaw,
          profitAfterFees: profitAfterFees,
          // ROI = einfache prozentuale Differenz zwischen eBay und Vinted (ohne Gebühren)
          roi: deal.vintedPrice > 0 ? ((deal.ebayPrice - deal.vintedPrice) / deal.vintedPrice) * 100 : 0,
          timestamp: new Date(),
          status: 'new'
        } as ArbitrageDeal;
    });
  } catch (error) {
    console.error("AI Scan Error:", error);
    return getFallbackData();
  }
}

function getFallbackData(): ArbitrageDeal[] {
  return [
    {
      id: "fallback-1",
      vinted: {
        id: "v-f-1",
        title: "Pokemon HeartGold (DS) - Nur Modul",
        price: 45.00,
        url: "#",
        condition: "Gut",
        imageUrl: "https://placehold.co/400x400/8b5cf6/white?text=Pokemon",
        category: "Video Games"
      },
      ebay: {
        price: 85.00,
        url: "#",
        title: "Pokemon HeartGold"
      },
      profit: 40.00,
      profitAfterFees: 26.65,
      roi: 59,
      timestamp: new Date(),
      status: 'new'
    }
  ];
}