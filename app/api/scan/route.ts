import { NextResponse } from 'next/server';
import { scrapeVintedCatalogUrl } from '@/lib/scrapers';
import { searchEbayByTitle, getEbaySearchUrl } from '@/lib/ebay-api';
import { sendArbitrageEmail } from '@/lib/email';
import { ArbitrageDeal } from '@/types';
import vintedUrls from '@/config/vinted-urls.json';

// This function runs on the SERVER (Node.js environment)
// It bypasses CORS restrictions that exist in the browser.
export async function GET(request: Request) {
  // Timeout für gesamten Request (30 Minuten - ausreichend für mehrere Kategorien)
  // WICHTIG: Railway hat ein Timeout von ~10 Minuten für HTTP-Requests
  // Der Request wird automatisch abgebrochen, wenn er zu lange läuft
  const requestTimeout = setTimeout(() => {
    console.error('[SCAN] KRITISCH: Request-Timeout erreicht! Der Scan läuft zu lange.');
  }, 1800000); // 30 Minuten
  
  try {
    const deals: ArbitrageDeal[] = [];
    const categoryStats: Array<{ name: string; category: string; pagesScraped: number; itemsFound: number }> = [];
    
    // Tracking für eBay-API-Statistiken
    let itemsWithEbayApi = 0;
    let itemsWithFallbackOnly = 0;
    let itemsSkippedDueToTimeout = 0;
    
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

    // Seitenlimit aus Umgebungsvariable (mit Fallback)
    // Bereinige Umgebungsvariable: Entferne Leerzeichen und führende "=" Zeichen (Railway-Bug)
    const maxPagesEnvRaw = process.env.MAX_SCAN_PAGES;
    const maxPagesEnv = maxPagesEnvRaw ? maxPagesEnvRaw.trim().replace(/^=+/, '') : null;
    console.log(`[SCAN] MAX_SCAN_PAGES Umgebungsvariable: "${maxPagesEnvRaw}" -> bereinigt: "${maxPagesEnv}" (Typ: ${typeof maxPagesEnvRaw})`);
    const maxPages = maxPagesEnv && !isNaN(Number(maxPagesEnv)) && Number(maxPagesEnv) > 0
      ? parseInt(maxPagesEnv, 10) 
      : 3;
    console.log(`[SCAN] Verwende maxPages: ${maxPages} (Fallback verwendet: ${maxPagesEnv && !isNaN(Number(maxPagesEnv)) && Number(maxPagesEnv) > 0 ? 'NEIN' : 'JA - Umgebungsvariable ungültig oder nicht gesetzt'})`);
    
    // Automatisches Item-Limit pro Kategorie basierend auf Anzahl der Kategorien
    // Railway hat ein Timeout von ~10 Minuten für HTTP-Requests
    // Berechnung für optimale Verteilung:
    // - 1 Kategorie: 300 Items × 1.8s = ~9 Minuten (sicher)
    // - 2 Kategorien: 250 Items × 1.8s × 2 = ~15 Minuten (zu lang, daher 200 Items)
    // - 2 Kategorien: 200 Items × 1.8s × 2 = ~12 Minuten (immer noch zu lang)
    // Lösung: Reduziere Delay leicht und setze Limit auf 250 pro Kategorie
    // - 2 Kategorien: 250 Items × 1.5s × 2 = ~12.5 Minuten (immer noch zu lang)
    // Beste Lösung: 250 Items pro Kategorie mit intelligentem Timeout-Check
    const enabledUrlsCount = enabledUrls.length;
    let maxItemsPerCategory: number;
    
    if (enabledUrlsCount === 1) {
      maxItemsPerCategory = 300; // 1 Kategorie: bis zu 300 Items
    } else if (enabledUrlsCount === 2) {
      maxItemsPerCategory = 300; // 2 Kategorien: 300 Items pro Kategorie (wie gewünscht)
    } else {
      maxItemsPerCategory = 200; // 3+ Kategorien: 200 Items pro Kategorie
    }
    
    // Überschreibe mit Umgebungsvariable falls gesetzt (für manuelle Anpassung)
    const maxItemsPerCategoryEnv = process.env.MAX_ITEMS_PER_SCAN || process.env.MAX_ITEMS_PER_CATEGORY;
    if (maxItemsPerCategoryEnv && !isNaN(Number(maxItemsPerCategoryEnv)) && Number(maxItemsPerCategoryEnv) > 0) {
      maxItemsPerCategory = parseInt(maxItemsPerCategoryEnv, 10);
      console.log(`[SCAN] Manuelles Item-Limit aus Umgebungsvariable: ${maxItemsPerCategory} Items pro Kategorie`);
    } else {
      console.log(`[SCAN] Automatisches Item-Limit: ${maxItemsPerCategory} Items pro Kategorie (für ${enabledUrlsCount} Kategorie${enabledUrlsCount > 1 ? 'n' : ''})`);
    }
    
    // Timeout-Handling: Railway hat ein Timeout von ~10 Minuten für HTTP-Requests
    // Wir setzen ein Limit von 9 Minuten PRO KATEGORIE, um sicher unter dem Railway-Limit zu bleiben
    // Jede Kategorie kann bis zu 9 Minuten haben, damit beide vollständig gescannt werden können
    const MAX_CATEGORY_TIME_MS = 540000; // 9 Minuten (540 Sekunden) pro Kategorie - sicher unter Railway-Limit von 10 Min

    // Für jede konfigurierte URL
    for (const urlConfig of enabledUrls) {
      // Start-Zeit für diese Kategorie
      const categoryStartTime = Date.now();
      try {
        console.log(`Scraping Vinted: ${urlConfig.name}... (max ${maxPages} Seiten)`);
        
        // Vinted Katalog scrappen mit konfiguriertem Seitenlimit und Sprache-Filter
        const scrapeResult = await scrapeVintedCatalogUrl(urlConfig.url, maxPages, languageFilter);
        const vintedItems = scrapeResult.items;
        const pagesScraped = scrapeResult.pagesScraped;
        
        console.log(`Gefunden: ${vintedItems.length} Artikel auf Vinted (${pagesScraped} Seiten)`);
        
        // Statistik für diese Kategorie speichern
        categoryStats.push({
          name: urlConfig.name,
          category: urlConfig.category || 'Unbekannt',
          pagesScraped: pagesScraped,
          itemsFound: vintedItems.length
        });
        
        // Item-Limit pro Kategorie anwenden falls gesetzt
        const itemsToProcess = maxItemsPerCategory > 0 
          ? vintedItems.slice(0, maxItemsPerCategory)
          : vintedItems;
        
        if (maxItemsPerCategory > 0 && vintedItems.length > maxItemsPerCategory) {
          console.log(`[SCAN] Item-Limit aktiv für ${urlConfig.name}: Verarbeite nur ${maxItemsPerCategory} von ${vintedItems.length} Items`);
        } else {
          console.log(`[SCAN] Verarbeite alle ${vintedItems.length} Items von ${urlConfig.name}`);
        }
        
        // Für jedes Vinted Item eBay abfragen
        // Delay optimiert für mehrere Kategorien: 1.5 Sekunden (40 requests/minute, sicher unter Limit von 60)
        // Bei 2 Kategorien × 250 Items = 500 Items × 1.5s = ~12.5 Minuten (an der Grenze, aber machbar)
        const ebayApiDelayEnv = process.env.EBAY_API_DELAY_MS;
        const ebayApiDelay = ebayApiDelayEnv && !isNaN(Number(ebayApiDelayEnv)) 
          ? parseInt(ebayApiDelayEnv, 10) 
          : enabledUrlsCount > 1 ? 1500 : 2000; // 1.5s für mehrere Kategorien, 2s für eine Kategorie
        let consecutiveRateLimitErrors = 0;
        const maxConsecutiveRateLimitErrors = 5; // Nach 5 aufeinanderfolgenden Fehlern überspringe eBay API
        
        for (let i = 0; i < itemsToProcess.length; i++) {
          // Timeout-Check PRO KATEGORIE: Berechne verbleibende Zeit für diese Kategorie
          const elapsedTime = Date.now() - categoryStartTime;
          const remainingTime = MAX_CATEGORY_TIME_MS - elapsedTime;
          
          // Logging alle 10 Items für Debugging
          if (i % 10 === 0 || i === 0) {
            console.log(`[SCAN] Verarbeite Item ${i + 1}/${itemsToProcess.length} (${Math.round(elapsedTime/1000)}s vergangen, ${Math.round(remainingTime/1000)}s übrig)`);
          }
          
          // Warnung wenn weniger als 30 Sekunden übrig sind
          if (remainingTime < 30000 && remainingTime > 0 && i % 10 === 0) {
            console.warn(`[SCAN] Warnung: Nur noch ${Math.round(remainingTime/1000)}s übrig. Verarbeite noch ${Math.min(10, itemsToProcess.length - i)} Items...`);
          }
          
          // Abbrechen wenn Timeout für diese Kategorie erreicht (mit Puffer für Response)
          // Verwende einen größeren Puffer (30 Sekunden), damit mehr Items verarbeitet werden können
          if (elapsedTime > MAX_CATEGORY_TIME_MS - 30000) { // 30 Sekunden Puffer für Response
            const remainingItems = itemsToProcess.length - i;
            console.warn(`[SCAN] Timeout nahe (${Math.round(elapsedTime/1000)}s). Breche eBay-API-Calls ab. ${remainingItems} Items werden mit Fallback-URLs hinzugefügt.`);
            
            // Füge verbleibende Items mit Fallback-URLs hinzu (ohne eBay-API-Call)
            itemsSkippedDueToTimeout += remainingItems;
            for (let j = i; j < itemsToProcess.length; j++) {
              const vItem = itemsToProcess[j];
              let searchTitle = vItem.title;
              if (!searchTitle || searchTitle.match(/^[\d,.\s€]+$/)) {
                const urlMatch = vItem.url.match(/\/items\/(\d+)-([^/?]+)/);
                if (urlMatch && urlMatch[2]) {
                  searchTitle = decodeURIComponent(urlMatch[2].replace(/-/g, ' '));
                } else {
                  searchTitle = 'Artikel';
                }
              }
              
              const searchUrl = getEbaySearchUrl(searchTitle, vItem.condition);
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
                  price: 0,
                  url: searchUrl,
                  title: searchTitle
                },
                profit: 0,
                profitAfterFees: 0,
                roi: 0,
                timestamp: new Date(),
                status: 'new'
              });
              itemsWithFallbackOnly++; // Tracking: Item wurde wegen Timeout nur mit Fallback verarbeitet
            }
            break;
          }
          const vItem = itemsToProcess[i];
          try {
            let ebayResult = null;
            
            // Prüfe ob noch genug Zeit für eBay-API-Call vorhanden ist
            const timeForNextCall = remainingTime - (ebayApiDelay + 5000); // Delay + 5s Puffer für API-Call
            
            // eBay API verwenden wenn konfiguriert, nicht zu viele Rate-Limit-Fehler UND noch genug Zeit vorhanden
            if (ebayConfig.clientId && ebayConfig.clientSecret && 
                consecutiveRateLimitErrors < maxConsecutiveRateLimitErrors &&
                timeForNextCall > 0) {
              // Rate Limiting: Warte zwischen API-Aufrufen um Rate-Limit zu vermeiden
              // Konfigurierbares Delay (Standard: 10000ms = 10 Sekunden = 6 Anfragen/Minute)
              if (i > 0) {
                // Erhöhe Delay bei Rate-Limit-Fehlern
                const currentDelay = consecutiveRateLimitErrors > 0 
                  ? ebayApiDelay * (consecutiveRateLimitErrors + 1) 
                  : ebayApiDelay;
                console.log(`[SCAN] Warte ${currentDelay}ms vor eBay-API-Call für Item ${i + 1}...`);
                await new Promise(resolve => setTimeout(resolve, currentDelay));
              }
              
              try {
                console.log(`[SCAN] Rufe eBay-API auf für Item ${i + 1}: "${vItem.title.substring(0, 50)}..."`);
                ebayResult = await searchEbayByTitle(
                  vItem.title,
                  vItem.condition,
                  ebayConfig
                );
                console.log(`[SCAN] eBay-API erfolgreich für Item ${i + 1}${ebayResult && ebayResult.price > 0 ? ` (Preis: ${ebayResult.price}€)` : ' (kein Preis gefunden)'}`);
                // Erfolgreiche Anfrage: Reset Rate-Limit-Fehler-Zähler
                consecutiveRateLimitErrors = 0;
              } catch (apiError: any) {
                console.error(`[SCAN] eBay-API-Fehler für Item ${i + 1}:`, apiError.message || apiError);
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
              if (i % 10 === 0 || i < 3) {
                console.log(`[SCAN] Verwende Fallback-URL für Item ${i + 1} (kein eBay-API-Ergebnis)`);
              }
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
              itemsWithEbayApi++; // Tracking: Item wurde erfolgreich mit eBay-API verarbeitet (mit Preis > 0)
            } else {
              // Tracking: Item wurde nur mit Fallback verarbeitet (kein eBay-Preis)
              itemsWithFallbackOnly++;
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
          } catch (itemError: any) {
            console.error(`[SCAN] Fehler bei Item ${i + 1} "${vItem?.title || 'unbekannt'}":`, itemError?.message || itemError);
            // Füge Item trotzdem mit Fallback hinzu
            try {
              let searchTitle = vItem?.title || 'Artikel';
              if (!searchTitle || searchTitle.match(/^[\d,.\s€]+$/)) {
                const urlMatch = vItem?.url?.match(/\/items\/(\d+)-([^/?]+)/);
                if (urlMatch && urlMatch[2]) {
                  searchTitle = decodeURIComponent(urlMatch[2].replace(/-/g, ' '));
                } else {
                  searchTitle = 'Artikel';
                }
              }
              
              const searchUrl = getEbaySearchUrl(searchTitle, vItem?.condition || '');
              deals.push({
                id: `deal-${Date.now()}-${deals.length}`,
                vinted: {
                  id: `v-${deals.length}`,
                  title: vItem?.title || 'Unbekannt',
                  price: vItem?.price || 0,
                  url: vItem?.url || '',
                  condition: vItem?.condition || '',
                  imageUrl: vItem?.imageUrl || 'https://placehold.co/400?text=No+Image',
                  category: urlConfig.category || 'Unbekannt',
                  language: vItem?.language
                },
                ebay: {
                  price: 0,
                  url: searchUrl,
                  title: searchTitle
                },
                profit: 0,
                profitAfterFees: 0,
                roi: 0,
                timestamp: new Date(),
                status: 'new'
              });
              itemsWithFallbackOnly++;
            } catch (fallbackError) {
              console.error(`[SCAN] Auch Fallback fehlgeschlagen für Item ${i + 1}:`, fallbackError);
            }
            // Weiter mit nächstem Item
            continue;
          }
        }
      } catch (urlError) {
        console.error(`Fehler beim Scrapen von ${urlConfig.name}:`, urlError);
        // Auch bei Fehler Statistik hinzufügen
        categoryStats.push({
          name: urlConfig.name,
          category: urlConfig.category || 'Unbekannt',
          pagesScraped: 0,
          itemsFound: 0
        });
        // Weiter mit nächster URL
        continue;
      }
    }

    const elapsedTime = Date.now() - overallStartTime;
    console.log(`[SCAN] Gefunden: ${deals.length} Arbitrage-Möglichkeiten (Gesamt-Zeit: ${Math.round(elapsedTime/1000)}s)`);
    console.log(`[SCAN] eBay-API-Statistiken: ${itemsWithEbayApi} mit eBay-API, ${itemsWithFallbackOnly} nur mit Fallback, ${itemsSkippedDueToTimeout} wegen Timeout übersprungen`);
    
    // Wenn Timeout nahe war, logge Warnung (Response bleibt Array für Kompatibilität)
    // Prüfe ob eine Kategorie das Timeout erreicht hat (9 Minuten pro Kategorie)
    if (itemsSkippedDueToTimeout > 0) {
      console.warn(`[SCAN] ${itemsSkippedDueToTimeout} Items wurden wegen Timeout-Beschränkungen (9 Min pro Kategorie) nicht vollständig verarbeitet.`);
    }
    
    // eBay-API-Statistiken für E-Mail
    const ebayApiStats = {
      itemsWithEbayApi,
      itemsWithFallbackOnly,
      itemsSkippedDueToTimeout,
      totalItems: deals.length
    };

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
        emailResult = await sendArbitrageEmail(deals, emailConfig, minRoiForEmail, categoryStats, ebayApiStats);
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
    console.log(`[SCAN] Scan abgeschlossen: ${deals.length} Deals gefunden, sende Response...`);
    return NextResponse.json(deals);
    
  } catch (error) {
    console.error("[SCAN] API Route Error:", error);
    console.error("[SCAN] Error Stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("[SCAN] Error Details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Prüfe ob es ein Timeout oder Memory-Problem ist
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Killed') || errorMessage.includes('ECONNRESET');
    
    if (isTimeout) {
      console.error("[SCAN] Timeout erkannt! Setze MAX_ITEMS_PER_SCAN auf einen niedrigeren Wert (z.B. 50)");
    }
    
    return NextResponse.json({ 
      error: "Failed to scrape", 
      details: errorMessage,
      suggestion: isTimeout ? "Der Scan wurde wegen Timeout abgebrochen. Setze MAX_ITEMS_PER_SCAN auf 50-100 in den Umgebungsvariablen." : undefined
    }, { status: 500 });
  } finally {
    // Stelle sicher, dass der Timeout-Cleanup ausgeführt wird
    clearTimeout(requestTimeout);
  }
}
