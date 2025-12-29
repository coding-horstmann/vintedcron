import { NextResponse } from 'next/server';
import { scrapeVintedCatalogUrl } from '@/lib/scrapers';
import { searchEbayByTitle, getEbaySearchUrl } from '@/lib/ebay-api';
import { sendArbitrageEmail } from '@/lib/email';
import { ArbitrageDeal } from '@/types';
import vintedUrls from '@/config/vinted-urls.json';

/**
 * CRON API Route für automatisches Scraping
 * Wird von Railway Cron-Job aufgerufen
 * Schedule: Alle 2 Stunden von 8:00 bis 21:00 Uhr (0 8,10,12,14,16,18,20 * * *)
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Zeitprüfung: Nur zwischen 8 und 21 Uhr (deutsche Zeit) ausführen
    const now = new Date();
    const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const currentHour = germanTime.getHours();
    
    if (currentHour < 8 || currentHour >= 21) {
      return NextResponse.json({
        success: false,
        message: `Cron-Job läuft nur zwischen 8:00 und 21:00 Uhr. Aktuelle Zeit: ${germanTime.toLocaleTimeString('de-DE')}`,
        skipped: true
      });
    }

    console.log(`[CRON] Starte automatischen Scan um ${germanTime.toLocaleTimeString('de-DE')}`);

    const deals: ArbitrageDeal[] = [];
    
    // eBay API Konfiguration
    const ebayConfig = {
      clientId: process.env.EBAY_CLIENT_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
      marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_DE'
    };

    // Debug: Log eBay Config Status
    console.log(`[CRON] eBay API Config: ClientID=${ebayConfig.clientId ? 'gesetzt' : 'FEHLT'}, ClientSecret=${ebayConfig.clientSecret ? 'gesetzt' : 'FEHLT'}`);

    // E-Mail Konfiguration
    const emailConfig = {
      from: process.env.EMAIL_FROM || '',
      to: process.env.EMAIL_TO || '',
      gmailAppPassword: process.env.GMAIL_APP_PASSWORD || ''
    };

    // Debug: Log E-Mail Config Status
    console.log(`[CRON] E-Mail Config: FROM=${emailConfig.from ? 'gesetzt' : 'FEHLT'}, TO=${emailConfig.to ? 'gesetzt' : 'FEHLT'}, PASSWORD=${emailConfig.gmailAppPassword ? 'gesetzt' : 'FEHLT'}`);

    // Min. ROI für E-Mail-Benachrichtigung (mit Fallback)
    const minRoiEnv = process.env.MIN_ROI_EMAIL;
    const minRoiForEmail = minRoiEnv && !isNaN(Number(minRoiEnv)) 
      ? parseInt(minRoiEnv, 10) 
      : 150;
    
    // Seitenlimit aus Umgebungsvariable (mit Fallback)
    const maxPagesEnv = process.env.MAX_SCAN_PAGES;
    const maxPages = maxPagesEnv && !isNaN(Number(maxPagesEnv)) 
      ? parseInt(maxPagesEnv, 10) 
      : 3;
    
    console.log(`[CRON] Konfiguration: MAX_SCAN_PAGES=${maxPages}, MIN_ROI_EMAIL=${minRoiForEmail}`);
    
    // Alle aktivierten URLs durchgehen
    const enabledUrls = vintedUrls.urls.filter(u => u.enabled);
    
    if (enabledUrls.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Keine aktivierten Vinted URLs gefunden' 
      }, { status: 400 });
    }

    console.log(`[CRON] Scanne ${enabledUrls.length} Kategorien mit je ${maxPages} Seiten`);

    // Für jede konfigurierte URL
    for (const urlConfig of enabledUrls) {
      try {
        console.log(`[CRON] Scraping: ${urlConfig.name}...`);
        
        // Vinted Katalog scrapen (Standard: Deutsch)
        const vintedItems = await scrapeVintedCatalogUrl(urlConfig.url, maxPages, 'Deutsch');
        
        console.log(`[CRON] ${urlConfig.name}: ${vintedItems.length} Artikel gefunden`);
        
        // eBay API Delay
        const ebayApiDelay = parseInt(process.env.EBAY_API_DELAY_MS || '2000', 10);
        
        // Debug: Log ob eBay API verwendet wird
        if (!ebayConfig.clientId || !ebayConfig.clientSecret) {
          console.log(`[CRON] WARNUNG: eBay API nicht konfiguriert. Deals werden ohne eBay-Preisvergleich erstellt.`);
        } else {
          console.log(`[CRON] eBay API konfiguriert. Starte Preisvergleich für ${vintedItems.length} Artikel...`);
        }
        
        let ebayApiCallCount = 0;
        
        for (let i = 0; i < vintedItems.length; i++) {
          const vItem = vintedItems[i];
          
          try {
            let ebayResult = null;
            
            // eBay API verwenden wenn konfiguriert
            if (ebayConfig.clientId && ebayConfig.clientSecret) {
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, ebayApiDelay));
              }
              
              try {
                ebayApiCallCount++;
                if (ebayApiCallCount % 10 === 0) {
                  console.log(`[CRON] eBay API: ${ebayApiCallCount}/${vintedItems.length} Artikel verarbeitet...`);
                }
                ebayResult = await searchEbayByTitle(
                  vItem.title,
                  vItem.condition,
                  ebayConfig
                );
              } catch (apiError) {
                console.error(`[CRON] eBay API Fehler für "${vItem.title}":`, apiError);
                ebayResult = null;
              }
            }
            
            // Fallback URL wenn kein API-Ergebnis
            if (!ebayResult) {
              const searchUrl = getEbaySearchUrl(vItem.title, vItem.condition);
              ebayResult = {
                price: 0,
                url: searchUrl,
                title: vItem.title
              };
            }
            
            // Profit berechnen
            let profit = 0;
            let profitAfterFees = 0;
            let roi = 0;
            
            if (ebayResult.price > 0 && vItem.price > 0) {
              profit = ebayResult.price - vItem.price;
              const fees = ebayResult.price * 0.11;
              const shipping = 4.50;
              profitAfterFees = ebayResult.price - vItem.price - fees - shipping;
              roi = ((ebayResult.price - vItem.price) / vItem.price) * 100;
            }
            
            deals.push({
              id: `cron-${Date.now()}-${deals.length}`,
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
                title: ebayResult.title || vItem.title
              },
              profit,
              profitAfterFees,
              roi,
              timestamp: new Date(),
              status: 'new'
            });
          } catch (itemError) {
            console.error(`[CRON] Fehler bei Item "${vItem.title}":`, itemError);
            continue;
          }
        }
        
        if (ebayConfig.clientId && ebayConfig.clientSecret) {
          console.log(`[CRON] ${urlConfig.name}: ${ebayApiCallCount} eBay API Calls durchgeführt`);
        }
      } catch (urlError) {
        console.error(`[CRON] Fehler bei ${urlConfig.name}:`, urlError);
        continue;
      }
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`[CRON] Scan abgeschlossen: ${deals.length} Deals in ${Math.round(elapsedTime / 1000)}s`);

    // E-Mail senden wenn konfiguriert
    let emailResult = { success: false, message: 'E-Mail nicht konfiguriert', filteredCount: 0 };
    
    if (emailConfig.from && emailConfig.to && emailConfig.gmailAppPassword) {
      console.log(`[CRON] Sende E-Mail von "${emailConfig.from}" an "${emailConfig.to}" (Min. ROI: ${minRoiForEmail}%)...`);
      console.log(`[CRON] E-Mail Config Details: FROM="${emailConfig.from}", TO="${emailConfig.to}", PASSWORD_LENGTH=${emailConfig.gmailAppPassword.length}`);
      
      try {
        emailResult = await sendArbitrageEmail(deals, emailConfig, minRoiForEmail);
        console.log(`[CRON] E-Mail: ${emailResult.message} (${emailResult.filteredCount} Deals mit ROI >= ${minRoiForEmail}%)`);
      } catch (emailError) {
        console.error(`[CRON] E-Mail Fehler beim Senden:`, emailError);
        emailResult = {
          success: false,
          message: emailError instanceof Error ? emailError.message : 'Unbekannter E-Mail-Fehler',
          filteredCount: 0
        };
      }
    } else {
      console.log('[CRON] E-Mail nicht konfiguriert (EMAIL_FROM, EMAIL_TO oder GMAIL_APP_PASSWORD fehlt)');
    }

    // Ergebnis zurückgeben
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      scanDuration: Math.round(elapsedTime / 1000),
      totalDeals: deals.length,
      dealsWithMinRoi: deals.filter(d => d.roi >= minRoiForEmail).length,
      minRoiFilter: minRoiForEmail,
      email: emailResult,
      categories: enabledUrls.map(u => u.name),
      deals: deals // Alle Deals für API-Zugriff
    });
    
  } catch (error) {
    console.error('[CRON] Kritischer Fehler:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Cron-Job fehlgeschlagen', 
      details: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

