import { NextResponse } from 'next/server';
import { scrapeVintedCatalogUrl } from '@/lib/scrapers';
import { searchEbayByTitle, getEbaySearchUrl } from '@/lib/ebay-api';
import { ArbitrageDeal } from '@/types';
import vintedUrls from '@/config/vinted-urls.json';

// This function runs on the SERVER (Node.js environment)
// It bypasses CORS restrictions that exist in the browser.
export async function GET(request: Request) {
  try {
    const deals: ArbitrageDeal[] = [];
    
    // eBay API Konfiguration aus Umgebungsvariablen
    const ebayConfig = {
      appId: process.env.EBAY_APP_ID || '',
      certId: process.env.EBAY_CERT_ID,
      devId: process.env.EBAY_DEV_ID,
      authToken: process.env.EBAY_AUTH_TOKEN,
      siteId: process.env.EBAY_SITE_ID || '77', // 77 = Deutschland
      apiVersion: (process.env.EBAY_API_VERSION as 'finding' | 'browse') || 'finding'
    };

    // Prüfe ob eBay API konfiguriert ist
    if (!ebayConfig.appId) {
      console.warn('eBay API nicht konfiguriert. Setze EBAY_APP_ID in Umgebungsvariablen.');
    }

    // URLs aus Request-Query oder Standard-URLs verwenden
    let urlsToUse = vintedUrls.urls;
    const urlParam = new URL(request.url).searchParams.get('urls');
    if (urlParam) {
      try {
        const customUrls = JSON.parse(decodeURIComponent(urlParam));
        urlsToUse = customUrls;
      } catch (e) {
        console.warn('Fehler beim Parsen der URLs, verwende Standard-URLs');
      }
    }

    // Alle aktivierten Vinted URLs durchgehen
    const enabledUrls = urlsToUse.filter((u: any) => u.enabled);
    
    if (enabledUrls.length === 0) {
      return NextResponse.json({ 
        error: 'Keine aktivierten Vinted URLs gefunden. Bitte config/vinted-urls.json prüfen.' 
      }, { status: 400 });
    }

    // Für jede konfigurierte URL
    for (const urlConfig of enabledUrls) {
      try {
        console.log(`Scraping Vinted: ${urlConfig.name}...`);
        
        // Vinted Katalog scrappen
        const vintedItems = await scrapeVintedCatalogUrl(urlConfig.url);
        
        console.log(`Gefunden: ${vintedItems.length} Artikel auf Vinted`);
        
        // Limit für Vercel Timeout (max 10 Items pro URL)
        const itemsToProcess = vintedItems.slice(0, 10);
        
        // Für jedes Vinted Item eBay abfragen
        for (const vItem of itemsToProcess) {
          try {
            let ebayResult = null;
            
            // eBay API verwenden wenn konfiguriert
            if (ebayConfig.appId) {
              ebayResult = await searchEbayByTitle(
                vItem.title,
                vItem.condition,
                ebayConfig
              );
            }
            
            // Wenn keine eBay API oder kein Ergebnis, Fallback URL generieren
            if (!ebayResult) {
              const searchUrl = getEbaySearchUrl(vItem.title, vItem.condition);
              ebayResult = {
                price: 0,
                url: searchUrl,
                title: vItem.title
              };
            }
            
            // IMMER alle Items hinzufügen, nicht nur profitable Deals
            let profit = 0;
            let profitAfterFees = 0;
            let roi = 0;
            
            // Berechne Profit nur wenn eBay Preis verfügbar
            if (ebayConfig.appId && ebayResult.price > 0 && vItem.price > 0) {
              profit = ebayResult.price - vItem.price;
              const fees = ebayResult.price * 0.11; // eBay Gebühren ~11%
              const shipping = 4.50; // Geschätzter Versand
              profitAfterFees = ebayResult.price - vItem.price - fees - shipping;
              roi = vItem.price > 0 ? (profitAfterFees / vItem.price) * 100 : 0;
            }
            
            // Alle Items hinzufügen, unabhängig von Profit
            deals.push({
              id: `deal-${Date.now()}-${deals.length}`,
              vinted: {
                id: `v-${deals.length}`,
                title: vItem.title,
                price: vItem.price,
                url: vItem.url,
                condition: vItem.condition,
                imageUrl: vItem.imageUrl || 'https://placehold.co/400?text=No+Image',
                category: urlConfig.category || 'Unbekannt'
              },
              ebay: {
                price: ebayResult.price || 0,
                url: ebayResult.url,
                title: ebayResult.price > 0 ? ebayResult.title : 'eBay Preis nicht verfügbar (API nicht konfiguriert)'
              },
              profit,
              profitAfterFees,
              roi,
              timestamp: new Date(),
              status: 'new'
            });
            
            // Rate Limiting zwischen eBay API Calls
            if (ebayConfig.appId) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (itemError) {
            console.error(`Fehler bei Item "${vItem.title}":`, itemError);
            // Weiter mit nächstem Item
            continue;
          }
        }
      } catch (urlError) {
        console.error(`Fehler beim Scrapen von ${urlConfig.name}:`, urlError);
        // Weiter mit nächster URL
        continue;
      }
    }

    console.log(`Gefunden: ${deals.length} Arbitrage-Möglichkeiten`);
    return NextResponse.json(deals);
    
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ 
      error: "Failed to scrape", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
