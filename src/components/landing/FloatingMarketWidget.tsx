import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

type MarketTab = 'US' | 'Europe' | 'Asia' | 'Crypto';

const MARKET_DATA: Record<MarketTab, MarketIndex[]> = {
  US: [
    { symbol: '^GSPC', name: 'S&P 500', price: 6926.44, change: -15.03, changePercent: -0.22 },
    { symbol: '^DJI', name: 'Dow 30', price: 50200.86, change: 79.46, changePercent: 0.16 },
    { symbol: '^IXIC', name: 'Nasdaq', price: 22889.05, change: -177.42, changePercent: -0.77 },
    { symbol: '^RUT', name: 'Russell 2000', price: 2663.31, change: -6.15, changePercent: -0.23 },
    { symbol: '^VIX', name: 'VIX', price: 17.68, change: 0.03, changePercent: 0.17 },
    { symbol: 'GC=F', name: 'Gold', price: 5069.60, change: -28.90, changePercent: -0.57 },
  ],
  Europe: [
    { symbol: '^FTSE', name: 'FTSE 100', price: 8721.40, change: 34.20, changePercent: 0.39 },
    { symbol: '^GDAXI', name: 'DAX', price: 23482.15, change: -89.30, changePercent: -0.38 },
    { symbol: '^FCHI', name: 'CAC 40', price: 8156.70, change: 12.45, changePercent: 0.15 },
    { symbol: '^STOXX', name: 'Euro Stoxx', price: 5432.80, change: -18.60, changePercent: -0.34 },
    { symbol: '^IBEX', name: 'IBEX 35', price: 12890.50, change: 45.70, changePercent: 0.36 },
    { symbol: '^AEX', name: 'AEX', price: 923.40, change: -3.20, changePercent: -0.35 },
  ],
  Asia: [
    { symbol: '^N225', name: 'Nikkei 225', price: 38452.30, change: 156.80, changePercent: 0.41 },
    { symbol: '^HSI', name: 'Hang Seng', price: 22845.60, change: -234.10, changePercent: -1.01 },
    { symbol: '000001.SS', name: 'Shanghai', price: 3298.45, change: 8.30, changePercent: 0.25 },
    { symbol: '^KOSPI', name: 'KOSPI', price: 2634.70, change: -12.40, changePercent: -0.47 },
    { symbol: '^BSESN', name: 'BSE Sensex', price: 81245.30, change: 324.60, changePercent: 0.40 },
    { symbol: '^AXJO', name: 'ASX 200', price: 8456.20, change: -28.30, changePercent: -0.33 },
  ],
  Crypto: [
    { symbol: 'BTC-USD', name: 'Bitcoin', price: 96482.30, change: 1247.50, changePercent: 1.31 },
    { symbol: 'ETH-USD', name: 'Ethereum', price: 2648.90, change: -32.40, changePercent: -1.21 },
    { symbol: 'BNB-USD', name: 'BNB', price: 682.30, change: 8.70, changePercent: 1.29 },
    { symbol: 'SOL-USD', name: 'Solana', price: 198.45, change: -4.20, changePercent: -2.07 },
    { symbol: 'XRP-USD', name: 'XRP', price: 2.84, change: 0.06, changePercent: 2.16 },
    { symbol: 'ADA-USD', name: 'Cardano', price: 0.82, change: -0.01, changePercent: -1.21 },
  ],
};

const TABS: MarketTab[] = ['US', 'Europe', 'Asia', 'Crypto'];

export function FloatingMarketWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>('US');
  const [page, setPage] = useState(0);
  const [stocks, setStocks] = useState(MARKET_DATA);

  const itemsPerPage = 6;
  const currentData = stocks[activeTab];
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const pageData = currentData.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev => {
        const updated = { ...prev };
        for (const tab of TABS) {
          updated[tab] = prev[tab].map(stock => {
            const fluctuation = (Math.random() - 0.48) * stock.price * 0.0005;
            const newPrice = +(stock.price + fluctuation).toFixed(2);
            const newChange = +(stock.change + fluctuation).toFixed(2);
            const newPercent = +((newChange / (newPrice - newChange)) * 100).toFixed(2);
            return { ...stock, price: newPrice, change: newChange, changePercent: newPercent };
          });
        }
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = useCallback((price: number) => {
    if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toFixed(price < 10 ? 4 : 2);
  }, []);

  // Mini sparkline (pure CSS)
  const Sparkline = ({ positive }: { positive: boolean }) => (
    <svg viewBox="0 0 40 16" className="w-10 h-4" fill="none">
      {positive ? (
        <polyline
          points="0,12 8,10 16,8 24,11 32,6 40,4"
          stroke="hsl(var(--success))"
          strokeWidth="1.5"
          fill="none"
        />
      ) : (
        <polyline
          points="0,4 8,6 16,8 24,5 32,10 40,12"
          stroke="hsl(var(--destructive))"
          strokeWidth="1.5"
          fill="none"
        />
      )}
    </svg>
  );

  return (
    <div className="fixed top-28 right-4 z-40">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border border-border shadow-lg transition-all duration-200 group mb-1 ml-auto',
          isOpen ? 'bg-card/98 backdrop-blur-md' : 'bg-card/95 backdrop-blur-sm hover:shadow-xl'
        )}
        aria-label={isOpen ? 'Close market widget' : 'Open market widget'}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-muted-foreground font-medium">Markets</span>
        <BarChart3 className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="w-[340px] bg-card/98 backdrop-blur-md border border-border rounded-xl shadow-xl animate-scale-in">
          {/* Tabs */}
          <div className="flex gap-1 px-3 pt-2 pb-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(0); }}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors',
              activeTab === tab
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {tab === 'Crypto' ? 'Cryptocurrencies' : tab}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-px bg-border/50 mx-3 my-2 rounded-lg overflow-hidden">
        {pageData.map(stock => (
          <div key={stock.symbol} className="bg-card p-2.5 space-y-1">
            <div className="text-[11px] font-semibold text-foreground truncate">{stock.name}</div>
            <div className="text-xs font-bold text-foreground">{formatPrice(stock.price)}</div>
            <Sparkline positive={stock.change >= 0} />
            <div
              className={cn(
                'text-[10px] font-semibold',
                stock.change >= 0 ? 'text-emerald-500' : 'text-destructive'
              )}
            >
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
              <br />
              ({stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2 border-t border-border">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
