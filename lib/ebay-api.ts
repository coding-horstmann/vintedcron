import axios from 'axios';

interface EbayApiConfig {
  appId: string;
  certId?: string;
  devId?: string;
  authToken?: string;
  siteId?: string; // 77 = Deutschland
  apiVersion?: 'finding' | 'browse'; // Welche eBay API verwendet wird
}

interface EbayResult {
  price: number;
  url: string;
  title: string;
  shippingCost?: number;
}

/**
 * Zustand-Mapping: Vinted → eBay API Condition Codes
 */
function mapConditionToEbay(vintedCondition: string): string {
  const normalized = vintedCondition.toLowerCase();
  if (normalized.includes('neu')) return 'New'; // eBay: 1000
  if (normalized.includes('sehr gut') || normalized.includes('gut')) return 'Used'; // eBay: 3000
  return 'Used'; // Default: Gebraucht
}

/**
 * Sucht bei eBay nach einem Artikel basierend auf Titel und Zustand
 * Verwendet die eBay Finding API oder Browse API
 */
export const searchEbayByTitle = async (
  title: string, 
  condition: string,
  config: EbayApiConfig
): Promise<EbayResult | null> => {
  try {
    const ebayCondition = mapConditionToEbay(condition);
    const apiType = config.apiVersion || 'finding';
    
    if (apiType === 'finding') {
      return await searchWithFindingAPI(title, ebayCondition, config);
    } else {
      return await searchWithBrowseAPI(title, ebayCondition, config);
    }
  } catch (error) {
    console.error("eBay API Error:", error);
    return null;
  }
};

/**
 * eBay Finding API (ältere API, aber weit verbreitet)
 */
async function searchWithFindingAPI(
  title: string,
  condition: string,
  config: EbayApiConfig
): Promise<EbayResult | null> {
  try {
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findItemsAdvanced',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': config.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': title,
      'itemFilter(0).name': 'Condition',
      'itemFilter(0).value': condition,
      'itemFilter(1).name': 'ListingType',
      'itemFilter(1).value': 'FixedPrice',
      'sortOrder': 'PricePlusShippingLowest',
      'paginationInput.entriesPerPage': '10',
      'siteid': config.siteId || '77' // Deutschland
    });

    const response = await axios.get('https://svcs.ebay.com/services/search/FindingService/v1', {
      params,
      timeout: 10000
    });

    const items = response.data?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
    
    if (items.length === 0) return null;

    // Günstigstes Angebot finden
    const cheapest = items
      .map((item: any) => {
        const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0');
        const shipping = parseFloat(item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || '0');
        return {
          totalPrice: price + shipping,
          price,
          shippingCost: shipping,
          url: item.viewItemURL?.[0] || '',
          title: item.title?.[0] || title
        };
      })
      .filter((item: any) => item.totalPrice > 0)
      .sort((a: any, b: any) => a.totalPrice - b.totalPrice)[0];

    if (!cheapest) return null;

    return {
      price: cheapest.totalPrice,
      url: cheapest.url,
      title: cheapest.title,
      shippingCost: cheapest.shippingCost
    };
  } catch (error: any) {
    // Detailliertes Logging für Debugging
    if (error.response) {
      console.error(`eBay Finding API Error: ${error.response.status} - ${error.response.statusText}`);
      if (error.response.data) {
        console.error('eBay API Response:', JSON.stringify(error.response.data).substring(0, 200));
      }
    } else {
      console.error("eBay Finding API Error:", error.message || error);
    }
    return null;
  }
}

/**
 * eBay Browse API (neuere API, benötigt OAuth Token)
 */
async function searchWithBrowseAPI(
  title: string,
  condition: string,
  config: EbayApiConfig
): Promise<EbayResult | null> {
  try {
    if (!config.authToken) {
      console.warn("Browse API requires authToken, falling back to Finding API");
      return await searchWithFindingAPI(title, condition, config);
    }

    // eBay Browse API Endpoint
    const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: {
        q: title,
        condition: condition,
        limit: '10',
        sort: 'price',
        filter: 'deliveryCountry:DE'
      },
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const items = response.data?.itemSummaries || [];
    
    if (items.length === 0) return null;

    // Günstigstes Angebot finden
    const cheapest = items
      .map((item: any) => {
        const price = parseFloat(item.price?.value || '0');
        const shipping = parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || '0');
        return {
          totalPrice: price + shipping,
          price,
          shippingCost: shipping,
          url: item.itemWebUrl || '',
          title: item.title || title
        };
      })
      .filter((item: any) => item.totalPrice > 0)
      .sort((a: any, b: any) => a.totalPrice - b.totalPrice)[0];

    if (!cheapest) return null;

    return {
      price: cheapest.totalPrice,
      url: cheapest.url,
      title: cheapest.title,
      shippingCost: cheapest.shippingCost
    };
  } catch (error) {
    console.error("eBay Browse API Error:", error);
    // Fallback zu Finding API
    return await searchWithFindingAPI(title, condition, config);
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
  const conditionParam = ebayCondition === 'New' ? '&LH_ItemCondition=1000' : '&LH_ItemCondition=3000';
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

