import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const INITIAL_STOCKS: StockData[] = [
  { symbol: '^DJI', name: 'DOW', price: 50334.84, change: 213.44, changePercent: 0.43 },
  { symbol: '^GSPC', name: 'S&P 500', price: 6083.57, change: 22.09, changePercent: 0.36 },
  { symbol: '^IXIC', name: 'NASDAQ', price: 19791.49, change: 67.83, changePercent: 0.34 },
  { symbol: '^RUT', name: 'Russell 2K', price: 2279.71, change: -5.32, changePercent: -0.23 },
  { symbol: 'BTC-USD', name: 'BTC', price: 96482.30, change: 1247.50, changePercent: 1.31 },
  { symbol: 'GC=F', name: 'Gold', price: 2886.40, change: 18.70, changePercent: 0.65 },
  { symbol: 'CL=F', name: 'Crude Oil', price: 71.12, change: -0.45, changePercent: -0.63 },
  { symbol: 'EURUSD', name: 'EUR/USD', price: 1.0362, change: 0.0018, changePercent: 0.17 },
];

export function StockMarketTicker() {
  const [stocks, setStocks] = useState<StockData[]>(INITIAL_STOCKS);

  // Simulate live updates with small random fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev =>
        prev.map(stock => {
          const fluctuation = (Math.random() - 0.48) * stock.price * 0.001;
          const newPrice = +(stock.price + fluctuation).toFixed(2);
          const newChange = +(stock.change + fluctuation).toFixed(2);
          const newPercent = +((newChange / (newPrice - newChange)) * 100).toFixed(2);
          return { ...stock, price: newPrice, change: newChange, changePercent: newPercent };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toFixed(price < 10 ? 4 : 2);
  };

  return (
    <div className="w-full bg-card/95 backdrop-blur-sm border-b border-border overflow-hidden">
      <div className="flex items-center">
        {/* Live badge */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border-r border-border">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Live</span>
        </div>

        {/* Scrolling ticker */}
        <div className="overflow-hidden flex-1">
          <div className="flex animate-ticker whitespace-nowrap">
            {[...stocks, ...stocks].map((stock, i) => (
              <div
                key={`${stock.symbol}-${i}`}
                className="inline-flex items-center gap-2 px-4 py-1.5 border-r border-border/30"
              >
                <span className="text-xs font-bold text-foreground">{stock.name}</span>
                <span className="text-xs text-muted-foreground">{formatPrice(stock.price)}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-[11px] font-semibold',
                    stock.change >= 0 ? 'text-emerald-500' : 'text-destructive'
                  )}
                >
                  {stock.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
