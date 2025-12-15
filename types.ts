// Domain entities for Vinted and eBay Arbitrage

export interface VintedProduct {
  id: string;
  title: string;
  price: number;
  url: string;
  condition: string;
  imageUrl: string;
  category: string;
}

export interface EbayResult {
  price: number;
  url: string;
  title: string;
  shippingCost?: number;
}

export interface ArbitrageDeal {
  id: string;
  vinted: VintedProduct;
  ebay: EbayResult;
  profit: number; // Raw difference
  profitAfterFees: number; // (eBay - Vinted) * 0.85
  roi: number; // Return on Investment percentage
  timestamp: Date;
  status: 'new' | 'viewed' | 'saved';
}

export interface SearchConfig {
  categories: string[];
  minProfit: number;
  minRoi: number;
}

export interface DashboardStats {
  totalDeals: number;
  averageProfit: number;
  bestDealAmount: number;
  scannedItems: number;
}
