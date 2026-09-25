import { useState, useEffect } from 'react';

interface GeoLocationData {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  isLoading: boolean;
  error: string | null;
}

interface WeatherData {
  celsius: number;
  fahrenheit: number;
  isLoading: boolean;
  error: string | null;
}

export function useGeoLocation() {
  const [location, setLocation] = useState<GeoLocationData>({
    city: '',
    region: '',
    country: '',
    countryCode: '',
    latitude: 0,
    longitude: 0,
    isLoading: true,
    error: null,
  });

  const [weather, setWeather] = useState<WeatherData>({
    celsius: 0,
    fahrenheit: 32,
    isLoading: true,
    error: null,
  });

  // Fetch location using browser geolocation
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Try browser geolocation first for accuracy
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              // Reverse geocode to get city name
              try {
                const response = await fetch(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                );
                const data = await response.json();
                setLocation({
                  city: data.city || data.locality || 'Unknown',
                  region: data.principalSubdivision || '',
                  country: data.countryName || '',
                  countryCode: data.countryCode || '',
                  latitude,
                  longitude,
                  isLoading: false,
                  error: null,
                });
              } catch {
                // Use coordinates without city name
                setLocation(prev => ({
                  ...prev,
                  city: 'Unknown',
                  latitude,
                  longitude,
                  isLoading: false,
                  error: null,
                }));
              }
            },
            () => {
              // User denied geolocation - silently handle as optional feature
              setLocation(prev => ({
                ...prev,
                city: 'Unknown',
                isLoading: false,
                error: null,
              }));
            },
            { timeout: 5000 }
          );
        } else {
          // Geolocation not available - silently handle
          setLocation(prev => ({
            ...prev,
            city: 'Unknown',
            isLoading: false,
            error: null,
          }));
        }
      } catch {
        setLocation(prev => ({
          ...prev,
          city: 'Unknown',
          isLoading: false,
          error: null,
        }));
      }
    };

    fetchLocation();
  }, []);

  // Fetch weather when location is available
  useEffect(() => {
    if (location.isLoading || location.error || !location.latitude) return;

    const fetchWeather = async () => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m&temperature_unit=celsius`
        );
        const data = await response.json();
        
        if (data.current?.temperature_2m !== undefined) {
          const celsius = Math.round(data.current.temperature_2m);
          setWeather({
            celsius,
            fahrenheit: Math.round((celsius * 9/5) + 32),
            isLoading: false,
            error: null,
          });
        } else {
          throw new Error('Weather data unavailable');
        }
      } catch {
        setWeather(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to fetch weather',
        }));
      }
    };

    fetchWeather();
    
    // Refresh weather every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location.latitude, location.longitude, location.isLoading, location.error]);

  return { location, weather };
}
