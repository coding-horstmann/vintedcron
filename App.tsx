import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/ui/Button';
import { Search, ArrowRight, DollarSign, Package, TrendingUp, AlertCircle, Code, Info, Server } from 'lucide-react';
import { formatCurrency } from './lib/utils';
import { scanDeals } from './lib/scanner';
import { ResultsTable } from './components/ResultsTable';
import type { DashboardStats, ArbitrageDeal } from './types';

// Placeholder Stats Component
const StatsCard = ({ title, value, icon: Icon, trend }: { title: string, value: string, icon: any, trend?: string }) => (
  <div className="rounded-xl border border-slate-800 bg-surface p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <div className="p-2 bg-slate-800 rounded-lg">
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </div>
    <div className="mt-4">
      <h3 className="text-2xl font-bold text-white">{value}</h3>
      {trend && <p className="text-xs text-secondary mt-1 flex items-center gap-1">+{trend} from last scan</p>}
    </div>
  </div>
);

const App: React.FC = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [deals, setDeals] = useState<ArbitrageDeal[]>([]);
  const [showCodeInfo, setShowCodeInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const totalPotentialProfit = deals.reduce((acc, deal) => acc + (deal.profitAfterFees > 0 ? deal.profitAfterFees : 0), 0);
  const avgRoi = deals.length > 0 ? deals.reduce((acc, deal) => acc + deal.roi, 0) / deals.length : 0;

  const handleStartScan = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const foundDeals = await scanDeals();
      setDeals(foundDeals);
    } catch (err) {
      console.error(err);
      setError("Scan error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-1">Vinted vs eBay Arbitrage Analysis</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" size="sm" onClick={() => setShowCodeInfo(!showCodeInfo)}>
             <Server className="mr-2 h-4 w-4" />
             Scraper Status
           </Button>
           <Button onClick={handleStartScan} isLoading={isSearching} className="shadow-lg shadow-blue-500/20">
             {isSearching ? 'Scanning Markets...' : (
               <>
                <Search className="mr-2 h-4 w-4" />
                Start Scan
               </>
             )}
           </Button>
        </div>
      </div>

      {/* Developer Info Panel */}
      {showCodeInfo && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-white mb-1">Architecture Status</h3>
              <p className="text-sm text-slate-400 mb-2">
                <strong>Current Environment:</strong> {window.location.hostname.includes('vercel') ? 'Vercel (Hybrid)' : 'Client-Side Preview'}
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                 <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <div className="text-xs font-mono text-emerald-400 mb-1">STRATEGY 1: Server API</div>
                    <p className="text-xs text-slate-400">Attempts to call <code>/api/scan</code>. This performs <strong>Real Scraping</strong> (Axios/Cheerio) on the server. Works on Vercel deployments.</p>
                 </div>
                 <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <div className="text-xs font-mono text-blue-400 mb-1">STRATEGY 2: AI Fallback</div>
                    <p className="text-xs text-slate-400">If API fails (CORS/Offline), falls back to <strong>Gemini AI Simulation</strong> to generate realistic mock deals for demonstration.</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Potential Profit" 
          value={formatCurrency(deals.length > 0 ? totalPotentialProfit : 0)} 
          icon={DollarSign} 
          trend={deals.length > 0 ? "New" : undefined}
        />
        <StatsCard 
          title="Active Deals" 
          value={deals.length.toString()} 
          icon={Package} 
        />
        <StatsCard 
          title="Avg. ROI" 
          value={`${avgRoi.toFixed(1)}%`} 
          icon={TrendingUp} 
        />
        <StatsCard 
          title="Market Status" 
          value="Active" 
          icon={AlertCircle}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {deals.length > 0 ? (
        <ResultsTable deals={deals} />
      ) : (
        /* Empty State / Initial View */
        <div className="rounded-2xl border border-dashed border-slate-700 bg-surface/30 p-12 text-center animate-in fade-in duration-500">
          <div className="mx-auto h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
            <Search className="h-8 w-8 text-slate-400" />
            {isSearching && (
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {isSearching ? 'Analyzing Market Data...' : 'Arbitrage Search Engine'}
          </h3>
          <p className="text-slate-400 max-w-md mx-auto mb-8">
            {isSearching 
              ? 'Scanning Vinted catalog and comparing with eBay sold listings...' 
              : 'Start a new scan to find underpriced items on Vinted that sell for more on eBay.'
            }
          </p>
          
          {!isSearching && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
              {['Books (Non-Fiction)', 'Comics/Manga', 'Retro Games'].map((cat) => (
                <button key={cat} onClick={handleStartScan} className="p-4 rounded-xl border border-slate-700 bg-surface hover:border-primary/50 transition-all cursor-pointer group hover:bg-slate-800 text-left w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 group-hover:text-primary transition-colors">{cat}</span>
                    <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;