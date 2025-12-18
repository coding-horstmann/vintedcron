import axios from 'axios';

interface EbayApiConfig {
  clientId: string;
  clientSecret: string;
  marketplaceId?: string; // EBAY_DE, EBAY_US, etc.
}

interface EbayResult {
  price: number;
  url: string;
  title: string;
  shippingCost?: number;
}

interface EbayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Sekunden
}

interface CachedToken {
  token: string;
  expiresAt: number; // Timestamp in Millisekunden
}

// Token-Cache (in-memory, wird bei Server-Neustart zurückgesetzt)
let tokenCache: CachedToken | null = null;

/**
 * Zustand-Mapping: Vinted → eBay API Condition Codes
 */
function mapConditionToEbay(vintedCondition: string): string {
  const normalized = vintedCondition.toLowerCase();
  if (normalized.includes('neu')) return 'NEW';
  if (normalized.includes('sehr gut') || normalized.includes('gut')) return 'USED';
  return 'USED'; // Default: Gebraucht
}

/**
 * Ruft ein OAuth2 Access Token von eBay ab
 * Grant Type: client_credentials (Server-to-Server)
 * Scope: https://api.ebay.com/oauth/api_scope
 */
async function getEbayAccessToken(config: EbayApiConfig): Promise<string> {
  // Prüfe ob gecachtes Token noch gültig ist (mit 5 Minuten Puffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  try {
    // Basic Auth Header erstellen
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await axios.post<EbayTokenResponse>(
      'https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        timeout: 10000
      }
    );

    if (!response.data.access_token) {
      throw new Error('Kein Access Token in der Antwort erhalten');
    }

    // Token cachen
    const expiresIn = response.data.expires_in || 7200; // Standard: 2 Stunden
    tokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000) - (5 * 60 * 1000) // 5 Minuten Puffer
    };

    console.log('eBay OAuth2 Token erfolgreich abgerufen und gecacht');
    return tokenCache.token;
  } catch (error: any) {
    console.error('Fehler beim Abrufen des eBay OAuth2 Tokens:', error.response?.data || error.message);
    throw new Error(`eBay OAuth2 Token-Fehler: ${error.response?.data?.error_description || error.message}`);
  }
}

/**
 * Sucht bei eBay nach einem Artikel basierend auf Titel und Zustand
 * Verwendet die eBay Browse API mit OAuth2
 */
export const searchEbayByTitle = async (
  title: string, 
  condition: string,
  config: EbayApiConfig
): Promise<EbayResult | null> => {
  try {
    // Prüfe ob Credentials vorhanden sind
    if (!config.clientId || !config.clientSecret) {
      console.warn('eBay OAuth2 Credentials fehlen. Setze EBAY_CLIENT_ID und EBAY_CLIENT_SECRET.');
      return null;
    }

    // OAuth2 Token abrufen (mit Caching)
    const accessToken = await getEbayAccessToken(config);
    
    // eBay Browse API verwenden
    return await searchWithBrowseAPI(title, condition, accessToken, config);
  } catch (error: any) {
    console.error("eBay API Error:", error.message || error);
    
    // Bei Token-Fehlern, gib null zurück (kein Fallback mehr zur Finding API)
    if (error.message?.includes('Token')) {
      return null;
    }
    
    return null;
  }
};

/**
 * eBay Browse API (neuere API mit OAuth2)
 * Verwendet Filter für FIXED_PRICE und NEW Condition
 */
async function searchWithBrowseAPI(
  title: string,
  condition: string,
  accessToken: string,
  config: EbayApiConfig
): Promise<EbayResult | null> {
  try {
    const ebayCondition = mapConditionToEbay(condition);
    const marketplaceId = config.marketplaceId || 'EBAY_DE';

    // Filter für Buying Options und Condition zusammenstellen
    const filters: string[] = ['buyingOptions:{FIXED_PRICE}'];
    
    // Condition Filter hinzufügen
    if (ebayCondition === 'NEW') {
      filters.push('conditions:{NEW}');
    } else {
      filters.push('conditions:{USED}');
    }

    // eBay Browse API Endpoint
    const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: {
        q: title,
        sort: 'price', // Niedrigster Preis zuerst
        limit: '1', // Nur 1 Ergebnis (günstigstes)
        filter: filters.join(',')
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Prüfe ob Antwort erfolgreich ist
    if (!response.data) {
      return null;
    }

    const items = response.data?.itemSummaries || [];
    
    if (items.length === 0) {
      return null;
    }

    // Nimm das erste (günstigste) Ergebnis
    const item = items[0];
    const price = parseFloat(item.price?.value || '0');
    const shipping = parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || '0');
    const totalPrice = price + shipping;

    if (totalPrice <= 0) {
      return null;
    }

    return {
      price: totalPrice,
      url: item.itemWebUrl || '',
      title: item.title || title,
      shippingCost: shipping
    };
  } catch (error: any) {
    // Detailliertes Logging für Debugging
    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      const errorData = error.response.data;
      
      console.error(`eBay Browse API Error: ${status} - ${statusText}`);
      
      if (errorData) {
        console.error('eBay API Response:', JSON.stringify(errorData).substring(0, 500));
      }

      // Rate Limit Fehler erkennen
      if (status === 429 || (errorData?.errors?.[0]?.errorId === '10001')) {
        throw new Error('RATE_LIMIT');
      }
    } else {
      console.error("eBay Browse API Error:", error.message || error);
    }
    
    return null;
  }
}

/**
 * Alternative: Falls keine API verfügbar, kann man auch die eBay-Such-URL zurückgeben
 * für manuelle Überprüfung
 */
/**
 * Generiert eine URL zur eBay-Suche für AKTIVE Angebote
 * Verwendet für den normalen eBay-Button
 */
export const getEbaySearchUrl = (title: string, condition: string): string => {
  const ebayCondition = mapConditionToEbay(condition);
  const conditionParam = ebayCondition === 'NEW' ? '&LH_ItemCondition=1000' : '&LH_ItemCondition=3000';
  // OHNE LH_Sold=1 für aktive Angebote
  return `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(title)}&LH_Complete=1${conditionParam}`;
};

/**
 * Generiert eine URL zur eBay Research-Seite für VERKAUFTE Artikel
 * Verwendet für den Research-Button, zeigt historische Verkaufsdaten
 * URL-Format: https://www.ebay.de/sh/research?marketplace=EBAY-DE&tabName=SOLD&keywords=PRODUKTTITEL
 */
export const getEbayResearchUrl = (title: string, condition: string): string => {
  // eBay Research-Seite verwendet 'keywords' (plural) als Parameter
  return `https://www.ebay.de/sh/research?marketplace=EBAY-DE&tabName=SOLD&keywords=${encodeURIComponent(title)}`;
};

