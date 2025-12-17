import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * NOTE: This code is designed to run on a Node.js SERVER.
 * If run in the browser, it will fail due to CORS (Cross-Origin Resource Sharing) policies.
 * Vinted and eBay block direct browser requests from other domains.
 */

// User-Agent rotation to avoid simple blocking
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/**
 * Zustand-Mapping: Vinted → Standardisiert
 */
function mapVintedCondition(vintedCondition: string): string {
  const normalized = vintedCondition.toLowerCase();
  if (normalized.includes('neu') && normalized.includes('etikett')) return 'Neu mit Etikett';
  if (normalized.includes('neu')) return 'Neu';
  if (normalized.includes('sehr gut')) return 'Sehr gut';
  if (normalized.includes('gut')) return 'Gut';
  if (normalized.includes('akzeptabel')) return 'Akzeptabel';
  return 'Gebraucht';
}

/**
 * Extrahiert die Sprache von einer Vinted-Produktseite
 */
async function scrapeVintedItemLanguage(itemUrl: string): Promise<string | null> {
  try {
    // Erhöhtes Rate Limiting: 3-5 Sekunden zwischen Anfragen
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    
    const { data } = await axios.get(itemUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.vinted.de/',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(data);
    
    // Suche nach "Sprache" Label und dem zugehörigen Wert
    // Verschiedene Selektoren für verschiedene Layouts
    const languageSelectors = [
      // Suche nach Label "Sprache" und dann den nächsten Wert
      'dt:contains("Sprache"), dt:contains("Language"), dt:contains("Langue")',
      'span:contains("Sprache:"), span:contains("Language:"), span:contains("Langue:")',
      '[class*="detail"]:contains("Sprache")',
      '[data-testid*="language"]',
      '[class*="language"]',
    ];

    for (const selector of languageSelectors) {
      const $label = $(selector).first();
      if ($label.length > 0) {
        // Versuche den Wert nach dem Label zu finden
        const $value = $label.next('dd').first();
        if ($value.length > 0) {
          const languageText = $value.text().trim();
          if (languageText) {
            return normalizeLanguage(languageText);
          }
        }
        
        // Alternative: Suche im gleichen Element nach dem Wert
        const parentText = $label.parent().text();
        const languageMatch = parentText.match(/Sprache[:\s]+([^\n\r]+)/i);
        if (languageMatch && languageMatch[1]) {
          return normalizeLanguage(languageMatch[1].trim());
        }
      }
    }

    // Fallback: Suche nach bekannten Sprachnamen im gesamten Text
    const bodyText = $('body').text();
    const languagePatterns = [
      { pattern: /Deutsch/i, value: 'Deutsch' },
      { pattern: /German/i, value: 'Deutsch' },
      { pattern: /Französisch/i, value: 'Französisch' },
      { pattern: /French/i, value: 'Französisch' },
      { pattern: /Niederländisch/i, value: 'Niederländisch' },
      { pattern: /Dutch/i, value: 'Niederländisch' },
      { pattern: /Englisch/i, value: 'Englisch' },
      { pattern: /English/i, value: 'Englisch' },
      { pattern: /Italienisch/i, value: 'Italienisch' },
      { pattern: /Italian/i, value: 'Italienisch' },
    ];

    for (const { pattern, value } of languagePatterns) {
      if (pattern.test(bodyText)) {
        return value;
      }
    }

    return null;
  } catch (error) {
    console.error(`Fehler beim Extrahieren der Sprache von ${itemUrl}:`, error);
    return null;
  }
}

/**
 * Normalisiert Sprachnamen zu Standardwerten
 */
function normalizeLanguage(languageText: string): string {
  const normalized = languageText.toLowerCase().trim();
  
  if (normalized.includes('deutsch') || normalized.includes('german')) {
    return 'Deutsch';
  }
  if (normalized.includes('französisch') || normalized.includes('french') || normalized.includes('français')) {
    return 'Französisch';
  }
  if (normalized.includes('niederländisch') || normalized.includes('dutch') || normalized.includes('nederlands')) {
    return 'Niederländisch';
  }
  if (normalized.includes('englisch') || normalized.includes('english')) {
    return 'Englisch';
  }
  if (normalized.includes('italienisch') || normalized.includes('italian') || normalized.includes('italiano')) {
    return 'Italienisch';
  }
  
  return languageText; // Fallback: Original zurückgeben
}

/**
 * Mappt Sprachnamen zu Vinted language_book_ids
 * Basierend auf: https://www.vinted.de/catalog?...&language_book_ids[]=6437 (Deutsch)
 */
function getLanguageBookId(language: string): string | null {
  const languageMap: Record<string, string> = {
    'Deutsch': '6437',
    'German': '6437',
    'Englisch': '6435',
    'English': '6435',
    'Französisch': '6436',
    'French': '6436',
    'Niederländisch': '6441',
    'Dutch': '6441',
    'Italienisch': '6439',
    'Italian': '6439',
  };
  
  return languageMap[language] || null;
}

/**
 * Erweitert eine Vinted URL um den language_book_ids Parameter
 * searchParams.append() kodiert automatisch korrekt (%5B%5D für [])
 */
function addLanguageFilterToUrl(url: string, language: string): string {
  if (!language || language === 'Alle Sprachen') {
    return url;
  }
  
  const languageId = getLanguageBookId(language);
  if (!languageId) {
    console.warn(`Unbekannte Sprache-ID für "${language}". Verwende URL ohne Sprachfilter.`);
    return url;
  }
  
  try {
    const urlObj = new URL(url);
    
    // Entferne vorhandene language_book_ids Parameter
    urlObj.searchParams.delete('language_book_ids[]');
    
    // Füge neuen Parameter hinzu - searchParams.append() kodiert automatisch korrekt
    urlObj.searchParams.append('language_book_ids[]', languageId);
    
    return urlObj.toString();
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Sprachfilters zur URL:', error);
    return url;
  }
}

/**
 * Scraped eine einzelne Vinted-Seite
 */
async function scrapeVintedPage(url: string): Promise<{ items: any[], hasNextPage: boolean, nextPageUrl?: string }> {
  // Rate Limiting: 2-5 Sekunden Delay zwischen Requests
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.vinted.de/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    },
    timeout: 30000,
  });

  const $ = cheerio.load(data);
  const items: any[] = [];

  // Vinted Selektoren - erweiterte Varianten für verschiedene Seitenlayouts
  const selectors = [
    '.feed-grid__item',
    '[data-testid="item-box"]',
    '.item-box',
    '.new-item-box',
    'article[data-testid="item-box"]',
    '[class*="ItemBox"]',
    '[class*="item-box"]',
    'div[class*="feed"] > div',
    'div[class*="grid"] > div',
    'a[href*="/items/"]'
  ];

  let foundItems = false;
  for (const selector of selectors) {
    const elements = $(selector);
    
    if (elements.length > 0) {
      foundItems = true;
      elements.each((_, element) => {
        const $el = $(element);
        
        // Preis zuerst extrahieren, um ihn später aus dem Titel ausschließen zu können
        const priceText = $el.find('[data-testid="item-box-price"], .item-box__price, .price, [class*="price"], [class*="Price"]').first().text().trim() ||
                         $el.find('span:contains("€")').first().text().trim();
        const priceMatch = priceText.match(/[\d,]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : null;
        const priceString = priceText.replace(/[^\d,]/g, '').trim();
        
        // Titel extrahieren - mehrere Varianten, aber Preis ausschließen
        let title = $el.find('[data-testid="item-box-title"], .item-box__title, h2, h3, h4, [class*="title"]').first().text().trim();
        
        // Wenn kein Titel gefunden, versuche andere Quellen
        if (!title || title.length < 3) {
          title = $el.attr('title') || '';
        }
        
        // Wenn immer noch kein Titel, versuche aus Link-Text (aber nicht Preis)
        if (!title || title.length < 3) {
          const linkText = $el.find('a').first().text().trim();
          // Prüfe ob Link-Text nicht nur Preis ist
          if (linkText && !linkText.match(/^[\d,.\s€]+$/)) {
            title = linkText;
          }
        }
        
        // Fallback: Versuche aus dem gesamten Text, aber entferne Preis
        if (!title || title.length < 3 || title.match(/^[\d,.\s€]+$/)) {
          const allText = $el.clone().children().remove().end().text().trim();
          // Entferne Preis-ähnliche Muster
          const cleanedText = allText
            .replace(/[\d,.\s€]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleanedText.length > 3) {
            title = cleanedText;
          }
        }
        
        // URL extrahieren
        const relativeUrl = $el.find('a').first().attr('href') || 
                          $el.attr('href') ||
                          $el.closest('a').attr('href');
        const url = relativeUrl 
          ? (relativeUrl.startsWith('http') ? relativeUrl : `https://www.vinted.de${relativeUrl}`)
          : null;
        
        // Versuche Titel aus URL zu extrahieren, falls noch kein Titel gefunden
        if ((!title || title.length < 3 || title.match(/^[\d,.\s€]+$/)) && url) {
          const urlMatch = url.match(/\/items\/(\d+)-([^/?]+)/);
          if (urlMatch && urlMatch[2]) {
            title = decodeURIComponent(urlMatch[2].replace(/-/g, ' '));
          }
        }
        
        // Bild extrahieren - mehrere Varianten
        const img = $el.find('img').first().attr('src') || 
                    $el.find('img').first().attr('data-src') ||
                    $el.find('img').first().attr('data-lazy-src') ||
                    $el.find('img').first().attr('data-original') ||
                    $el.find('[style*="background-image"]').attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] ||
                    '';
        
        // Zustand extrahieren
        const conditionText = $el.find('[data-testid="item-box-condition"], .item-box__condition, .condition, [class*="condition"]').first().text().trim();
        const condition = conditionText ? mapVintedCondition(conditionText) : 'Sehr gut';

        // Versuche Sprache aus der Liste-Seite zu extrahieren (falls verfügbar)
        // Suche nach Sprache-Informationen im Item-Element
        let language: string | null = null;
        
        // Suche nach Sprache-Attributen und Klassen
        const languageElement = $el.find('[class*="language"], [data-testid*="language"]').first();
        if (languageElement.length > 0) {
          const languageText = languageElement.text().trim() || languageElement.attr('title') || '';
          if (languageText) {
            language = normalizeLanguage(languageText);
          }
        }
        
        // Fallback: Suche im gesamten Item-Text nach Sprachnamen
        if (!language) {
          const itemText = $el.text();
          const languagePatterns = [
            { pattern: /\bDeutsch\b/i, value: 'Deutsch' },
            { pattern: /\bGerman\b/i, value: 'Deutsch' },
            { pattern: /\bFranzösisch\b/i, value: 'Französisch' },
            { pattern: /\bFrench\b/i, value: 'Französisch' },
            { pattern: /\bNiederländisch\b/i, value: 'Niederländisch' },
            { pattern: /\bDutch\b/i, value: 'Niederländisch' },
            { pattern: /\bEnglisch\b/i, value: 'Englisch' },
            { pattern: /\bEnglish\b/i, value: 'Englisch' },
            { pattern: /\bItalienisch\b/i, value: 'Italienisch' },
            { pattern: /\bItalian\b/i, value: 'Italienisch' },
          ];
          
          for (const { pattern, value } of languagePatterns) {
            if (pattern.test(itemText)) {
              language = value;
              break;
            }
          }
        }

        // Validierung: Titel darf nicht nur Preis sein
        const isOnlyPrice = title && title.match(/^[\d,.\s€]+$/);
        
        // Validierung: Mindestens Titel und URL müssen vorhanden sein, Titel darf nicht nur Preis sein
        if (title && title.length > 3 && !isOnlyPrice && url && url.includes('/items/')) {
          // Preis kann auch 0 sein oder fehlen
          const finalPrice = (price !== null && !isNaN(price) && price > 0) ? price : 0;
          
          items.push({
            title: title.substring(0, 200), // Titel begrenzen
            price: finalPrice,
            url,
            imageUrl: img || 'https://placehold.co/400?text=No+Image',
            condition,
            language: language || undefined, // Sprache kann später von Produktseite geholt werden
            platform: 'vinted'
          });
        }
      });
      
      // Wenn Items gefunden wurden, nicht weiter suchen
      if (items.length > 0) {
        break;
      }
    }
  }

  // Fallback: Suche nach JSON-Daten im HTML (Vinted nutzt manchmal JSON)
  if (!foundItems || items.length === 0) {
    // Versuche JSON-Daten aus Script-Tags zu extrahieren
    $('script[type="application/json"]').each((_, element) => {
      try {
        const jsonText = $(element).html();
        if (jsonText && jsonText.includes('items')) {
          const jsonData = JSON.parse(jsonText);
          // Versuche Items aus verschiedenen JSON-Strukturen zu extrahieren
          const extractedItems = extractItemsFromJSON(jsonData);
          if (extractedItems.length > 0) {
            items.push(...extractedItems);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
    
    // Fallback: Suche nach allen Links die zu /items/ führen
    if (items.length === 0) {
      $('a[href*="/items/"]').each((_, element) => {
        const $el = $(element);
        const title = $el.text().trim() || $el.attr('title') || '';
        const url = $el.attr('href');
        
        if (title && title.length > 5 && url) {
          // Versuche Preis aus dem umgebenden Element zu finden
          const priceText = $el.closest('div, article, section').find('.price, [class*="price"], span:contains("€")').first().text().trim();
          const priceMatch = priceText.match(/[\d,]+/);
          const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : 0;
          
          items.push({
            title: title.substring(0, 200),
            price,
            url: url.startsWith('http') ? url : `https://www.vinted.de${url}`,
            imageUrl: '',
            condition: 'Sehr gut',
            platform: 'vinted'
          });
        }
      });
    }
  }

  // Prüfe auf nächste Seite
  let hasNextPage = false;
  let nextPageUrl: string | undefined;
  
  // Suche nach Pagination-Links
  const nextPageLink = $('a[aria-label*="next"], a[aria-label*="Next"], a[aria-label*="weiter"], .pagination__next, [class*="pagination"] a:contains("›"), [class*="pagination"] a:contains(">")').first();
  if (nextPageLink.length > 0) {
    const href = nextPageLink.attr('href');
    if (href && !href.includes('javascript')) {
      hasNextPage = true;
      nextPageUrl = href.startsWith('http') ? href : `https://www.vinted.de${href}`;
    }
  }
  
  // Alternative: Prüfe auf "page" Parameter in URL
  const urlObj = new URL(url);
  const currentPage = parseInt(urlObj.searchParams.get('page') || '1');
  // Wenn wir Items gefunden haben, versuche nächste Seite
  if (items.length > 0) {
    urlObj.searchParams.set('page', (currentPage + 1).toString());
    // Teste ob nächste Seite existiert (wird später geprüft)
    hasNextPage = true;
    nextPageUrl = urlObj.toString();
  }

  return { items, hasNextPage, nextPageUrl };
}

/**
 * Helper-Funktion für JSON-Extraktion
 */
function extractItemsFromJSON(data: any): any[] {
  const results: any[] = [];
  
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (item.title || item.name) {
        results.push({
          title: item.title || item.name || '',
          price: item.price || item.price_value || 0,
          url: item.url || item.web_url || '',
          imageUrl: item.image_url || item.photo?.url || '',
          condition: item.condition || 'Sehr gut',
          platform: 'vinted'
        });
      }
    });
  } else if (data.items) {
    return extractItemsFromJSON(data.items);
  } else if (data.catalog) {
    return extractItemsFromJSON(data.catalog.items || data.catalog);
  }
  
  return results;
}

/**
 * Scraped Vinted Katalog-URLs direkt (z.B. für spezifische Kategorien)
 * Scraped ALLE Seiten, nicht nur die erste
 * Mit Rate Limiting um Bot-Schutz zu umgehen
 * @param languageFilter - Optional: Filter für Sprache (z.B. "Deutsch", "Alle Sprachen")
 */
export const scrapeVintedCatalogUrl = async (catalogUrl: string, maxPages: number = 3, languageFilter?: string) => {
  try {
    // Erweitere URL um Sprachfilter, falls angegeben
    let urlToScrape = catalogUrl;
    if (languageFilter && languageFilter !== 'Alle Sprachen') {
      urlToScrape = addLanguageFilterToUrl(catalogUrl, languageFilter);
      console.log(`Starting scrape of Vinted catalog: ${urlToScrape} (Sprache: ${languageFilter})`);
    } else {
      console.log(`Starting scrape of Vinted catalog: ${urlToScrape}`);
    }
    
    const allItems: any[] = [];
    let currentUrl: string | undefined = urlToScrape;
    let pageCount = 0;
    let consecutiveEmptyPages = 0;

    while (currentUrl && pageCount < maxPages) {
      pageCount++;
      console.log(`Scraping page ${pageCount}...`);
      
      const { items, hasNextPage, nextPageUrl } = await scrapeVintedPage(currentUrl);
      
      if (items.length > 0) {
        // Wenn URL bereits Sprachfilter enthält, sind alle Items bereits gefiltert
        // Füge Items direkt hinzu (Sprache ist bereits in der URL gefiltert)
        allItems.push(...items);
        console.log(`Found ${items.length} items on page ${pageCount} (Total: ${allItems.length})`);
        
        consecutiveEmptyPages = 0;
      } else {
        consecutiveEmptyPages++;
        console.log(`No items found on page ${pageCount}`);
        // Wenn 2 Seiten hintereinander leer sind, stoppe
        if (consecutiveEmptyPages >= 2) {
          console.log('Stopping: 2 consecutive empty pages');
          break;
        }
      }

      // Wenn keine nächste Seite oder zu viele leere Seiten, stoppe
      if (!hasNextPage || !nextPageUrl) {
        console.log('No next page found, stopping');
        break;
      }

      // Stelle sicher, dass der Sprachfilter auch in der nächsten Seite erhalten bleibt
      if (languageFilter && languageFilter !== 'Alle Sprachen') {
        currentUrl = addLanguageFilterToUrl(nextPageUrl, languageFilter);
      } else {
        currentUrl = nextPageUrl;
      }
    }

    console.log(`Scraped ${allItems.length} total items from ${pageCount} pages`);
    return allItems;
  } catch (error) {
    console.error("Vinted Catalog Scrape Error:", error);
    throw new Error(`Failed to scrape Vinted catalog: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const scrapeRealVinted = async (searchTerm: string) => {
  try {
    const url = `https://www.vinted.de/catalog?search_text=${encodeURIComponent(searchTerm)}&order=newest_first`;
    
    // In a real server environment, you might need a proxy here
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    const $ = cheerio.load(data);
    const items: any[] = [];

    // Vinted selector strategy (Note: Class names change frequently)
    // Looking for grid items
    $('.feed-grid__item').each((_, element) => {
      const $el = $(element);
      const title = $el.find('[data-testid="item-box-title"]').text().trim();
      const priceText = $el.find('[data-testid="item-box-price"]').text().trim();
      const url = $el.find('a').attr('href');
      const img = $el.find('img').attr('src');

      if (title && priceText && url) {
        items.push({
          title,
          price: parseFloat(priceText.replace('€', '').replace(',', '.').trim()),
          url: url.startsWith('http') ? url : `https://www.vinted.de${url}`,
          imageUrl: img,
          platform: 'vinted'
        });
      }
    });

    return items;
  } catch (error) {
    console.error("Real Vinted Scrape Error:", error);
    throw new Error("Failed to scrape Vinted. Bot protection might be active.");
  }
};

export const scrapeRealEbay = async (searchTerm: string) => {
  try {
    // LH_Sold=1 filters for SOLD items to get realistic market value
    const url = `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}&LH_Sold=1&LH_Complete=1`;
    
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent()
      }
    });

    const $ = cheerio.load(data);
    const results: any[] = [];

    $('.s-item__wrapper').each((_, element) => {
      const $el = $(element);
      const title = $el.find('.s-item__title').text().trim();
      const priceText = $el.find('.s-item__price').text().trim();
      const link = $el.find('.s-item__link').attr('href');
      
      if (title && priceText && !title.includes('Shop on eBay')) {
        results.push({
          title,
          price: parseFloat(priceText.replace('EUR', '').replace('.', '').replace(',', '.').trim()),
          url: link,
          platform: 'ebay'
        });
      }
    });

    // Return the median price of sold items
    return results;
  } catch (error) {
    console.error("Real eBay Scrape Error:", error);
    throw new Error("Failed to scrape eBay.");
  }
};
