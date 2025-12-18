import React, { useState, useMemo } from 'react';
import { ExternalLink, ArrowRight, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import { ArbitrageDeal } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from './ui/Button';
import { getEbayResearchUrl } from '@/lib/ebay-api';

interface ResultsTableProps {
  deals: ArbitrageDeal[];
}

type SortColumn = 'vintedPrice' | 'ebayPrice' | 'profitAfterFees' | 'roi';
type SortDirection = 'asc' | 'desc';

export const ResultsTable: React.FC<ResultsTableProps> = ({ deals }) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('ebayPrice');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedDeals = useMemo(() => {
    const sorted = [...deals].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortColumn) {
        case 'vintedPrice':
          aValue = a.vinted.price;
          bValue = b.vinted.price;
          break;
        case 'ebayPrice':
          aValue = a.ebay.price;
          bValue = b.ebay.price;
          break;
        case 'profitAfterFees':
          aValue = a.profitAfterFees;
          bValue = b.profitAfterFees;
          break;
        case 'roi':
          aValue = a.roi;
          bValue = b.roi;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'desc') {
        return bValue - aValue; // Größte zuerst
      } else {
        return aValue - bValue; // Kleinste zuerst
      }
    });

    return sorted;
  }, [deals, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to desc (largest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUp className="h-3 w-3 opacity-30" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="h-3 w-3" /> 
      : <ArrowUp className="h-3 w-3" />;
  };

  if (deals.length === 0) return null;

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Found Opportunities <span className="text-slate-500 ml-2">({deals.length})</span></h2>
        </div>
        
        <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-surface shadow-sm">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                <th className="p-4 font-medium">Item</th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors select-none"
                  onClick={() => handleSort('vintedPrice')}
                >
                  <div className="flex items-center gap-2">
                    Vinted (Buy)
                    <SortIcon column="vintedPrice" />
                  </div>
                </th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors select-none"
                  onClick={() => handleSort('ebayPrice')}
                >
                  <div className="flex items-center gap-2">
                    eBay (inkl. Versand)
                    <SortIcon column="ebayPrice" />
                  </div>
                </th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors select-none"
                  onClick={() => handleSort('roi')}
                >
                  <div className="flex items-center gap-2">
                    ROI
                    <SortIcon column="roi" />
                  </div>
                </th>
                <th className="p-4 font-medium text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {sortedDeals.map((deal) => (
                <tr key={deal.id} className="group transition-colors hover:bg-slate-800/50">
                    <td className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800 border border-slate-700">
                        <img src={deal.vinted.imageUrl} alt={deal.vinted.title} className="h-full w-full object-cover" />
                        </div>
                        <div>
                        <div className="font-medium text-slate-200 line-clamp-1 max-w-[200px]" title={deal.vinted.title}>{deal.vinted.title}</div>
                        <div className="text-xs text-slate-500">{deal.vinted.condition} • {deal.vinted.category}</div>
                        </div>
                    </div>
                    </td>
                    <td className="p-4 font-medium text-slate-300">{formatCurrency(deal.vinted.price)}</td>
                    <td className="p-4 font-medium text-slate-300">{formatCurrency(deal.ebay.price)}</td>
                    <td className="p-4">
                    <div className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                        deal.roi > 50 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : deal.roi > 20 
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                    )}>
                        {deal.roi.toFixed(0)}%
                    </div>
                    </td>
                    <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => window.open(deal.vinted.url, '_blank')}>
                         Vinted <ArrowRight className="ml-1 h-3 w-3 -rotate-45" />
                        </Button>
                        <Button variant="secondary" size="sm" className="h-8 px-2 text-xs" onClick={() => window.open(deal.ebay.url, '_blank')}>
                         eBay <ArrowRight className="ml-1 h-3 w-3 -rotate-45" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10" 
                          onClick={() => window.open(getEbayResearchUrl(deal.vinted.title, deal.vinted.condition), '_blank')}
                          title="eBay Research - Verkaufte Artikel analysieren"
                        >
                         Research <BarChart3 className="ml-1 h-3 w-3" />
                        </Button>
                    </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        </div>
    </div>
  );
};