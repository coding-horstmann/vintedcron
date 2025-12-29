import { NextResponse } from 'next/server';
import { scrapeVintedCatalogUrl } from '@/lib/scrapers';
import { searchEbayByTitle, getEbaySearchUrl } from '@/lib/ebay-api';
import { sendArbitrageEmail } from '@/lib/email';
import { ArbitrageDeal } from '@/types';
import vintedUrls from '@/config/vinted-urls.json';

// This function runs on the SERVER (Node.js environment)
// It bypasses CORS restrictions that exist in the browser.
export async function GET(request: Request) {
  try {
    const deals: ArbitrageDeal[] = [];
    
    // eBay API Konfiguration aus Umgebungsvariablen (OAuth2)
    // Unterstützt sowohl EBAY_CLIENT_SECRET als auch EBAY_CERT_ID (für Kompatibilität)
    const ebayConfig = {
      clientId: process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || process.env.EBAY_CERT_ID || '',
      marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_DE' // EBAY_DE, EBAY_US, etc.
    };

    // Prüfe ob eBay API konfiguriert ist
    if (!ebayConfig.clientId || !ebayConfig.clientSecret) {
      console.warn('eBay OAuth2 API nicht konfiguriert. Setze EBAY_CLIENT_ID (oder EBAY_APP_ID) und EBAY_CLIENT_SECRET (oder EBAY_CERT_ID) in Umgebungsvariablen.');
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

    // Sprache-Filter aus Request-Query (Standard: Deutsch)
    const languageFilter = new URL(request.url).searchParams.get('language') || 'Deutsch';

    // Alle aktivierten Vinted URLs durchgehen
    const enabledUrls = urlsToUse.filter((u: any) => u.enabled);
    
    if (enabledUrls.length === 0) {
      return NextResponse.json({ 
        error: 'Keine aktivierten Vinted URLs gefunden. Bitte config/vinted-urls.json prüfen.' 
      }, { status: 400 });
    }

    // Seitenlimit aus Umgebungsvariable oder Default (3)
    const maxPages = parseInt(process.env.MAX_SCAN_PAGES || '3', 10);
    
    // Item-Limit pro Scan (optional, um Timeouts zu vermeiden)
    const maxItemsPerScan = parseInt(process.env.MAX_ITEMS_PER_SCAN || '0', 10); // 0 = kein Limit
    
    // Timeout-Handling: Vercel hat 300s Timeout (5 Min), wir brechen bei 250s ab
    const startTime = Date.now();
    const MAX_EXECUTION_TIME_MS = 250000; // 250 Sekunden (4:10 Min) - Puffer für Response

    // Für jede konfigurierte URL
    for (const urlConfig of enabledUrls) {
      try {
        console.log(`Scraping Vinted: ${urlConfig.name}... (max ${maxPages} Seiten)`);
        
        // Vinted Katalog scrappen mit konfiguriertem Seitenlimit und Sprache-Filter
        const vintedItems = await scrapeVintedCatalogUrl(urlConfig.url, maxPages, languageFilter);
        
        console.log(`Gefunden: ${vintedItems.length} Artikel auf Vinted`);
        
        // Item-Limit anwenden falls gesetzt
        const itemsToProcess = maxItemsPerScan > 0 
          ? vintedItems.slice(0, maxItemsPerScan)
          : vintedItems;
        
        if (maxItemsPerScan > 0 && vintedItems.length > maxItemsPerScan) {
          console.log(`Item-Limit aktiv: Verarbeite nur ${maxItemsPerScan} von ${vintedItems.length} Items`);
        }
        
        // Für jedes Vinted Item eBay abfragen
        // Delay reduziert auf 2 Sekunden (3 requests/minute, sicher unter Limit von 6)
        const ebayApiDelay = parseInt(process.env.EBAY_API_DELAY_MS || '2000', 10); // Standard: 2000ms (2 Sekunden = 30 Anfragen/Minute, aber wir machen nur ~3)
        let consecutiveRateLimitErrors = 0;
        const maxConsecutiveRateLimitErrors = 5; // Nach 5 aufeinanderfolgenden Fehlern überspringe eBay API
        
        for (let i = 0; i < itemsToProcess.length; i++) {
          // Timeout-Check: Wenn wir nahe am Timeout sind, abbrechen
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime > MAX_EXECUTION_TIME_MS) {
            console.warn(`Timeout nahe (${Math.round(elapsedTime/1000)}s). Breche Scan ab und gebe bisherige Ergebnisse zurück.`);
            break;
          }
          const vItem = itemsToProcess[i];
          try {
            let ebayResult = null;
            
            // eBay API verwenden wenn konfiguriert und nicht zu viele Rate-Limit-Fehler
            if (ebayConfig.clientId && ebayConfig.clientSecret && consecutiveRateLimitErrors < maxConsecutiveRateLimitErrors) {
              // Rate Limiting: Warte zwischen API-Aufrufen um Rate-Limit zu vermeiden
              // Konfigurierbares Delay (Standard: 10000ms = 10 Sekunden = 6 Anfragen/Minute)
              if (i > 0) {
                // Erhöhe Delay bei Rate-Limit-Fehlern
                const currentDelay = consecutiveRateLimitErrors > 0 
                  ? ebayApiDelay * (consecutiveRateLimitErrors + 1) 
                  : ebayApiDelay;
                await new Promise(resolve => setTimeout(resolve, currentDelay));
              }
              
              try {
                ebayResult = await searchEbayByTitle(
                  vItem.title,
                  vItem.condition,
                  ebayConfig
                );
                // Erfolgreiche Anfrage: Reset Rate-Limit-Fehler-Zähler
                consecutiveRateLimitErrors = 0;
              } catch (apiError: any) {
                // Prüfe ob es ein Rate-Limit-Fehler ist
                if (apiError?.message === 'RATE_LIMIT' || apiError?.response?.status === 429) {
                  consecutiveRateLimitErrors++;
                  console.warn(`eBay Rate-Limit-Fehler (${consecutiveRateLimitErrors}/${maxConsecutiveRateLimitErrors}). Überspringe eBay API für verbleibende Items.`);
                  // Überspringe eBay API für verbleibende Items wenn zu viele Fehler
                  if (consecutiveRateLimitErrors >= maxConsecutiveRateLimitErrors) {
                    console.warn('Zu viele Rate-Limit-Fehler. Überspringe eBay API für verbleibende Items.');
                  }
                } else {
                  // Anderer Fehler: Reset Zähler
                  consecutiveRateLimitErrors = 0;
                }
                // Setze ebayResult auf null, damit Fallback URL verwendet wird
                ebayResult = null;
              }
            }
            
            // Wenn keine eBay API oder kein Ergebnis, Fallback URL generieren
            if (!ebayResult) {
              // Stelle sicher, dass der Titel nicht nur ein Preis ist
              let searchTitle = vItem.title;
              // Wenn Titel nur Preis ist, versuche aus URL zu extrahieren
              if (!searchTitle || searchTitle.match(/^[\d,.\s€]+$/)) {
                const urlMatch = vItem.url.match(/\/items\/(\d+)-([^/?]+)/);
                if (urlMatch && urlMatch[2]) {
                  searchTitle = decodeURIComponent(urlMatch[2].replace(/-/g, ' '));
                } else {
                  // Fallback: verwende generischen Suchbegriff
                  searchTitle = 'Artikel';
                }
              }
              
              const searchUrl = getEbaySearchUrl(searchTitle, vItem.condition);
              ebayResult = {
                price: 0,
                url: searchUrl,
                title: searchTitle
              };
            }
            
            // IMMER alle Items hinzufügen, nicht nur profitable Deals
            let profit = 0;
            let profitAfterFees = 0;
            let roi = 0;
            
            // Berechne Profit nur wenn eBay Preis verfügbar
            if (ebayConfig.clientId && ebayConfig.clientSecret && ebayResult.price > 0 && vItem.price > 0) {
              profit = ebayResult.price - vItem.price;
              const fees = ebayResult.price * 0.11; // eBay Gebühren ~11%
              const shipping = 4.50; // Geschätzter Versand
              profitAfterFees = ebayResult.price - vItem.price - fees - shipping;
              // ROI = einfache prozentuale Differenz zwischen eBay und Vinted (ohne Gebühren)
              roi = vItem.price > 0 ? ((ebayResult.price - vItem.price) / vItem.price) * 100 : 0;
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
                category: urlConfig.category || 'Unbekannt',
                language: vItem.language
              },
              ebay: {
                price: ebayResult.price || 0,
                url: ebayResult.url,
                title: ebayResult.price > 0 ? ebayResult.title : (ebayResult.title || vItem.title || 'eBay Preis nicht verfügbar')
              },
              profit,
              profitAfterFees,
              roi,
              timestamp: new Date(),
              status: 'new'
            });
            
            // Rate Limiting wird bereits vor dem API-Call durchgeführt (siehe oben)
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

    const elapsedTime = Date.now() - startTime;
    console.log(`[SCAN] Gefunden: ${deals.length} Arbitrage-Möglichkeiten (Zeit: ${Math.round(elapsedTime/1000)}s)`);
    
    // Wenn Timeout nahe war, logge Warnung (Response bleibt Array für Kompatibilität)
    if (elapsedTime > MAX_EXECUTION_TIME_MS * 0.9) {
      console.warn('[SCAN] Scan wurde aufgrund von Timeout-Beschränkungen vorzeitig beendet. Einige Items wurden möglicherweise nicht verarbeitet.');
    }

    // E-Mail senden wenn konfiguriert (eine E-Mail pro Scan)
    let emailResult = { success: false, message: 'E-Mail nicht konfiguriert', filteredCount: 0 };
    
    // E-Mail Konfiguration
    const resendApiKey = process.env.RESEND_API_KEY || '';
    const emailConfig = {
      from: process.env.EMAIL_FROM || '',
      to: process.env.EMAIL_TO || '',
      gmailAppPassword: process.env.GMAIL_APP_PASSWORD || ''
    };

    // Min. ROI für E-Mail-Benachrichtigung (mit Fallback)
    const minRoiEnv = process.env.MIN_ROI_EMAIL;
    const minRoiForEmail = minRoiEnv && !isNaN(Number(minRoiEnv)) 
      ? parseInt(minRoiEnv, 10) 
      : 150;

    const canSendWithResend = resendApiKey && emailConfig.to;
    const canSendWithGmail = emailConfig.from && emailConfig.to && emailConfig.gmailAppPassword;
    
    if (canSendWithResend || canSendWithGmail) {
      const method = canSendWithResend ? 'Resend API' : 'Gmail SMTP';
      console.log(`[SCAN] Sende E-Mail via ${method} an "${emailConfig.to}" (Min. ROI: ${minRoiForEmail}%)...`);
      
      try {
        emailResult = await sendArbitrageEmail(deals, emailConfig, minRoiForEmail);
        console.log(`[SCAN] E-Mail: ${emailResult.message} (${emailResult.filteredCount} Deals mit ROI >= ${minRoiForEmail}%)`);
      } catch (emailError) {
        console.error(`[SCAN] E-Mail Fehler beim Senden:`, emailError);
        emailResult = {
          success: false,
          message: emailError instanceof Error ? emailError.message : 'Unbekannter E-Mail-Fehler',
          filteredCount: 0
        };
      }
    } else {
      console.log('[SCAN] E-Mail nicht konfiguriert. Setze RESEND_API_KEY + EMAIL_TO (empfohlen) oder EMAIL_FROM + EMAIL_TO + GMAIL_APP_PASSWORD');
    }
    
    // Response mit Deals und optional E-Mail-Status (für Kompatibilität bleibt es ein Array)
    // Frontend kann emailResult ignorieren, wenn es nur die Deals braucht
    return NextResponse.json(deals);
    
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ 
      error: "Failed to scrape", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
