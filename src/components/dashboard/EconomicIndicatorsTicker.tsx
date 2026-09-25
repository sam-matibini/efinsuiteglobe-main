import { useState, useEffect, useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useEconomicRates } from '@/hooks/useEconomicRates';
import { ArrowLeftRight, Percent, TrendingUp, Sparkles, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IndicatorItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  isLoading?: boolean;
}

export function EconomicIndicatorsTicker() {
  const { organization } = useCurrentOrganization();
  const { location, weather } = useGeoLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Extract country code from organization
  const countryString = organization?.country || '';
  const getCountryCode = (country: string): string => {
    const upperCountry = country.toUpperCase().trim();
    const countryMap: Record<string, string> = {
      // North America
      'CANADA': 'CA', 'CA': 'CA', 'CAN': 'CA',
      'UNITED STATES': 'US', 'USA': 'US', 'US': 'US',
      // Europe
      'UNITED KINGDOM': 'GB', 'UK': 'GB', 'GB': 'GB', 'GBR': 'GB',
      'GERMANY': 'DE', 'DE': 'DE', 'DEU': 'DE',
      'FRANCE': 'FR', 'FR': 'FR', 'FRA': 'FR',
      // Asia-Pacific
      'AUSTRALIA': 'AU', 'AU': 'AU', 'AUS': 'AU',
      'INDIA': 'IN', 'IN': 'IN', 'IND': 'IN',
      // Africa
      'SOUTH AFRICA': 'ZA', 'ZA': 'ZA', 'ZAF': 'ZA',
      'NIGERIA': 'NG', 'NG': 'NG', 'NGA': 'NG',
      'GHANA': 'GH', 'GH': 'GH', 'GHA': 'GH',
      'ZAMBIA': 'ZM', 'ZM': 'ZM', 'ZMB': 'ZM',
      'KENYA': 'KE', 'KE': 'KE', 'KEN': 'KE',
      'BURUNDI': 'BI', 'BI': 'BI', 'BDI': 'BI',
      // Middle East
      'UNITED ARAB EMIRATES': 'AE', 'UAE': 'AE', 'AE': 'AE', 'ARE': 'AE',
      'SAUDI ARABIA': 'SA', 'SA': 'SA', 'SAU': 'SA',
    };
    return countryMap[upperCountry] || 'US';
  };

  const countryCode = getCountryCode(countryString);
  
  // Use the dynamic economic rates hook
  const economicRates = useEconomicRates(countryCode);

  // Build location display string
  const locationDisplay = useMemo(() => {
    if (location.isLoading) return 'Detecting...';
    if (location.error) return 'Unknown';
    const parts = [location.city];
    if (location.region) parts.push(location.region);
    return parts.join(', ');
  }, [location]);

  // Build temperature display
  const temperatureDisplay = useMemo(() => {
    if (weather.isLoading) return 'Loading...';
    if (weather.error) return 'N/A';
    return `${weather.celsius}°C / ${weather.fahrenheit}°F`;
  }, [weather]);

  // Build exchange rate display
  const fxRateDisplay = useMemo(() => {
    if (economicRates.exchangeRate.isLoading) return 'Loading...';
    if (economicRates.exchangeRate.rate === 1) {
      return 'USD 1.00/USD';
    }
    return `${economicRates.exchangeRate.currency} ${economicRates.exchangeRate.rate.toFixed(2)}/USD`;
  }, [economicRates.exchangeRate]);

  const indicators: IndicatorItem[] = useMemo(() => [
    {
      id: 'location',
      icon: <MapPin className="w-4 h-4" />,
      label: locationDisplay,
      value: temperatureDisplay,
      color: 'text-blue-500',
      isLoading: location.isLoading || weather.isLoading,
    },
    {
      id: 'exchange',
      icon: economicRates.exchangeRate.isLoading 
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <ArrowLeftRight className="w-4 h-4" />,
      label: 'FX Rate',
      value: fxRateDisplay,
      color: 'text-emerald-500',
      isLoading: economicRates.exchangeRate.isLoading,
    },
    {
      id: 'interest',
      icon: <Percent className="w-4 h-4" />,
      label: 'Interest Rate',
      value: `${economicRates.interestRate.rate.toFixed(2)}%`,
      color: 'text-amber-500',
    },
    {
      id: 'inflation',
      icon: <TrendingUp className="w-4 h-4" />,
      label: 'Inflation',
      value: `${economicRates.inflationRate.rate.toFixed(1)}%`,
      color: economicRates.inflationRate.rate > 5 ? 'text-red-500' : 'text-green-500',
    },
  ], [locationDisplay, temperatureDisplay, economicRates, fxRateDisplay, location.isLoading, weather.isLoading]);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % indicators.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, [indicators.length]);

  if (!organization) return null;

  const currentIndicator = indicators[activeIndex];

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500/10 via-green-500/15 to-emerald-500/10 border border-emerald-500/30 overflow-hidden w-[320px] flex-shrink-0 shadow-sm shadow-emerald-500/10">
      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Sparkles className="w-3 h-3 animate-pulse" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">AI Live</span>
      </div>
      
      <div className="h-4 w-px bg-border/50" />
      
      <div 
        className={cn(
          "flex items-center gap-2 transition-all duration-300",
          isTransitioning ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
        )}
      >
        <span className={cn("flex-shrink-0", currentIndicator.color)}>
          {currentIndicator.icon}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {currentIndicator.label}:
        </span>
        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
          {currentIndicator.value}
        </span>
      </div>

      {/* Indicator dots */}
      <div className="flex items-center gap-1 ml-auto">
        {indicators.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setActiveIndex(idx);
                setIsTransitioning(false);
              }, 150);
            }}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-200",
              idx === activeIndex 
                ? "bg-emerald-500 w-3" 
                : "bg-emerald-300/40 hover:bg-emerald-400/60"
            )}
            aria-label={`Show ${indicators[idx].label}`}
          />
        ))}
      </div>
    </div>
  );
}
