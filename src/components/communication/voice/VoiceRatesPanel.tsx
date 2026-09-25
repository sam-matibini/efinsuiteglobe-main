import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Globe, 
  Search,
  RefreshCw,
  DollarSign,
  Clock,
  Zap,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRatesPanelProps {
  className?: string;
}

interface CountryRate {
  id: string;
  country_code: string;
  country_name: string;
  dialing_code: string;
  rate_per_minute: number;
  billing_increment_seconds: number;
  currency: string;
  margin_percent: number;
  is_active: boolean;
}

interface ProviderRoute {
  id: string;
  country_code: string;
  country_name: string;
  region: string;
  routing_strategy: string;
  is_active: boolean;
}

// Country flag emoji helper
const getCountryFlag = (countryCode: string): string => {
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌍";
  }
};

// Region display names
const REGION_NAMES: Record<string, string> = {
  africa: "Africa",
  north_america: "North America",
  europe: "Europe",
  asia: "Asia Pacific",
  middle_east: "Middle East",
  south_america: "South America",
};

// Region colors
const REGION_COLORS: Record<string, string> = {
  africa: "bg-amber-500/10 text-amber-700 border-amber-200",
  north_america: "bg-blue-500/10 text-blue-700 border-blue-200",
  europe: "bg-purple-500/10 text-purple-700 border-purple-200",
  asia: "bg-green-500/10 text-green-700 border-green-200",
  middle_east: "bg-orange-500/10 text-orange-700 border-orange-200",
  south_america: "bg-red-500/10 text-red-700 border-red-200",
};

export function VoiceRatesPanel({ className }: VoiceRatesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<CountryRate[]>([]);
  const [routes, setRoutes] = useState<ProviderRoute[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<string>("all");

  const fetchRates = async () => {
    setLoading(true);
    try {
      const [ratesRes, routesRes] = await Promise.all([
        supabase
          .from("voice_country_rates")
          .select("*")
          .eq("is_active", true)
          .order("country_name"),
        supabase
          .from("voice_provider_routes")
          .select("id, country_code, country_name, region, routing_strategy, is_active")
          .eq("is_active", true),
      ]);

      if (ratesRes.data) setRates(ratesRes.data);
      if (routesRes.data) setRoutes(routesRes.data);
    } catch (err) {
      console.error("Error fetching rates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  // Merge rates with routes
  const mergedRates = rates.map(rate => {
    const route = routes.find(r => r.country_code === rate.country_code);
    return {
      ...rate,
      region: route?.region || "other",
      routing_strategy: route?.routing_strategy || "cost",
    };
  });

  // Get unique regions
  const regions = ["all", ...new Set(mergedRates.map(r => r.region).filter(Boolean))];

  // Filter by search and region
  const filteredRates = mergedRates.filter(rate => {
    const matchesSearch =
      rate.country_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rate.country_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rate.dialing_code.includes(searchQuery);
    
    const matchesRegion = activeRegion === "all" || rate.region === activeRegion;
    
    return matchesSearch && matchesRegion;
  });

  // Group by region for stats
  const statsByRegion = mergedRates.reduce((acc, rate) => {
    if (!acc[rate.region]) {
      acc[rate.region] = { count: 0, avgRate: 0, rates: [] as number[] };
    }
    acc[rate.region].count++;
    acc[rate.region].rates.push(rate.rate_per_minute);
    return acc;
  }, {} as Record<string, { count: number; avgRate: number; rates: number[] }>);

  // Calculate averages
  Object.keys(statsByRegion).forEach(region => {
    const regionRates = statsByRegion[region].rates;
    statsByRegion[region].avgRate = regionRates.reduce((a, b) => a + b, 0) / regionRates.length;
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Voice Call Rates</CardTitle>
                <CardDescription>
                  {rates.length} countries with per-second billing across Africa
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRates}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by country name, code, or dialing code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Region Tabs */}
          <Tabs value={activeRegion} onValueChange={setActiveRegion}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              {regions.map(region => (
                <TabsTrigger key={region} value={region} className="text-xs">
                  {region === "all" ? "All Regions" : REGION_NAMES[region] || region}
                  {region !== "all" && statsByRegion[region] && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1">
                      {statsByRegion[region].count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Region Stats (if Africa selected) */}
      {activeRegion === "africa" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{statsByRegion.africa?.count || 0}</div>
              <p className="text-sm text-muted-foreground">African Countries</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">6s</div>
              <p className="text-sm text-muted-foreground">Billing Increment</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                ${statsByRegion.africa?.avgRate?.toFixed(3) || "0.00"}
              </div>
              <p className="text-sm text-muted-foreground">Avg. Rate/min</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">3</div>
              <p className="text-sm text-muted-foreground">Active Providers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rates List */}
      <Card>
        <CardContent className="pt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredRates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No rates found</p>
                  <p className="text-sm">Try adjusting your search or filter</p>
                </div>
              ) : (
                filteredRates.map((rate) => (
                  <div
                    key={rate.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getCountryFlag(rate.country_code)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{rate.country_name}</p>
                            <Badge variant="outline" className="text-xs">
                              {rate.dialing_code}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", REGION_COLORS[rate.region])}
                            >
                              <MapPin className="h-3 w-3 mr-1" />
                              {REGION_NAMES[rate.region] || rate.region}
                            </Badge>
                            <span className="capitalize">{rate.routing_strategy} routing</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-bold text-primary">
                          <DollarSign className="h-4 w-4" />
                          {rate.rate_per_minute.toFixed(4)}
                          <span className="text-sm font-normal text-muted-foreground">/min</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {rate.billing_increment_seconds === 1 
                            ? "Per-second billing" 
                            : `${rate.billing_increment_seconds}s increments`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <strong>Least-Cost Routing:</strong> Calls are automatically routed to the cheapest provider
            </p>
            <p className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-amber-500" />
              <strong>Africa Coverage:</strong> 50+ African countries with Africa's Talking & Termii
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <strong>6-Second Billing:</strong> Most African countries use 6-second billing increments
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}