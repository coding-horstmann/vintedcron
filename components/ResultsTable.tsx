import React from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { ArbitrageDeal } from '../lib/types';
import { formatCurrency, cn } from '../lib/utils';
import { Button } from './ui/Button';

interface ResultsTableProps {
  deals: ArbitrageDeal[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ deals }) => {
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
                <th className="p-4 font-medium">Vinted (Buy)</th>
                <th className="p-4 font-medium">eBay (Sell)</th>
                <th className="p-4 font-medium">Net Profit</th>
                <th className="p-4 font-medium">ROI</th>
                <th className="p-4 font-medium text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {deals.map((deal) => (
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
                    <div className="flex flex-col">
                        <span className={cn(
                            "font-bold",
                            deal.profitAfterFees > 0 ? "text-secondary" : "text-red-400"
                        )}>{formatCurrency(deal.profitAfterFees)}</span>
                        <span className="text-[10px] text-slate-500">after fees & ship</span>
                    </div>
                    </td>
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