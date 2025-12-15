import { NextResponse } from 'next/server';
import { scrapeRealVinted, scrapeRealEbay } from '../../../lib/scrapers';
import { ArbitrageDeal } from '../../../lib/types';

// This function runs on the SERVER (Node.js environment)
// It bypasses CORS restrictions that exist in the browser.
export async function GET() {
  try {
    // 1. Define what to search for (random selection to avoid timeouts)
    const searchQueries = [
      { term: "Pokemon Smaragd Edition", cat: "Video Games" },
      { term: "One Piece Manga Set", cat: "Manga" },
      { term: "Clean Code Robert Martin", cat: "Books" }
    ];
    
    // Pick one random category to scrape to keep execution time low (Vercel Limit)
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    
    console.log(`Server: Scraping for ${query.term}...`);

    // 2. Run Scrapers in Parallel
    const [vintedItems, ebayItems] = await Promise.all([
      scrapeRealVinted(query.term),
      scrapeRealEbay(query.term)
    ]);

    // 3. Find Arbitrage Deals
    const deals: ArbitrageDeal[] = [];

    // Simple matching algorithm
    // In a real app, you would need fuzzy string matching
    if (vintedItems.length > 0 && ebayItems.length > 0) {
      // Calculate median eBay price as reference
      const sortedEbayPrices = ebayItems.map((i: any) => i.price).sort((a: number, b: number) => a - b);
      const medianEbayPrice = sortedEbayPrices[Math.floor(sortedEbayPrices.length / 2)] || 0;

      vintedItems.forEach((vItem: any, index: number) => {
        // Only consider if price is significantly lower than eBay median
        if (vItem.price < medianEbayPrice * 0.7) { 
          const fees = medianEbayPrice * 0.11;
          const shipping = 4.50;
          const profit = medianEbayPrice - vItem.price - fees - shipping;

          if (profit > 5) { // Min 5€ profit
             deals.push({
               id: `real-${Date.now()}-${index}`,
               vinted: {
                 id: `v-${index}`,
                 title: vItem.title,
                 price: vItem.price,
                 url: vItem.url,
                 condition: 'Gebraucht',
                 imageUrl: vItem.imageUrl || 'https://placehold.co/400?text=No+Image',
                 category: query.cat
               },
               ebay: {
                 price: medianEbayPrice,
                 url: `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(query.term)}&LH_Sold=1`,
                 title: `~ ${medianEbayPrice}€ Market Value`
               },
               profit: medianEbayPrice - vItem.price,
               profitAfterFees: profit,
               roi: (profit / vItem.price) * 100,
               timestamp: new Date(),
               status: 'new'
             });
          }
        }
      });
    }

    return NextResponse.json(deals);
    
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: "Failed to scrape on server" }, { status: 500 });
  }
}