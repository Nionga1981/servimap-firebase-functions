"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
  address?: string;
}

interface LocationContextType {
  userLocation: LocationData | null;
  locationLoading: boolean;
  locationError: string | null;
  setUserLocation: (location: LocationData | null) => void;
  getCurrentLocation: (options?: PositionOptions) => Promise<LocationData>;
  watchLocation: () => void;
  stopWatching: () => void;
  getAddressFromCoordinates: (lat: number, lng: number) => Promise<string>;
}

const LocationContext = createContext<LocationContextType>({
  userLocation: null,
  locationLoading: false,
  locationError: null,
  setUserLocation: () => {},
  getCurrentLocation: async () => { throw new Error('LocationContext not initialized'); },
  watchLocation: () => {},
  stopWatching: () => {},
  getAddressFromCoordinates: async () => { throw new Error('LocationContext not initialized'); },
});

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocationState] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Default geolocation options
  const defaultOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 300000 // 5 minutes
  };

  // Set user location and persist to localStorage
  const setUserLocation = useCallback((location: LocationData | null) => {
    setUserLocationState(location);
    if (location) {
      localStorage.setItem('userLocation', JSON.stringify(location));
    } else {
      localStorage.removeItem('userLocation');
    }
  }, []);

  // Get address from coordinates using reverse geocoding
  const getAddressFromCoordinates = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      // Using a free geocoding service (you can replace with Google Maps or other services)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${lat}, ${lng}`;
      } else {
        return `${lat}, ${lng}`;
      }
    } catch (error) {
      console.warn('Error getting address:', error);
      return `${lat}, ${lng}`;
    }
  }, []);

  // Get current location once
  const getCurrentLocation = useCallback(async (options?: PositionOptions): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        setLocationError(error);
        reject(new Error(error));
        return;
      }

      setLocationLoading(true);
      setLocationError(null);

      const opts = { ...defaultOptions, ...options };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };

          // Get address
          try {
            locationData.address = await getAddressFromCoordinates(
              locationData.lat,
              locationData.lng
            );
          } catch (error) {
            console.warn('Could not get address for location:', error);
          }

          setUserLocation(locationData);
          setLocationLoading(false);
          resolve(locationData);
        },
        (error) => {
          setLocationLoading(false);
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          
          setLocationError(errorMessage);
          reject(new Error(errorMessage));
        },
        opts
      );
    });
  }, [getAddressFromCoordinates, setUserLocation]);

  // Start watching user location
  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    if (watchId !== null) {
      return; // Already watching
    }

    setLocationError(null);

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const locationData: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        // Get address for the new location
        try {
          locationData.address = await getAddressFromCoordinates(
            locationData.lat,
            locationData.lng
          );
        } catch (error) {
          console.warn('Could not get address for location:', error);
        }

        setUserLocation(locationData);
      },
      (error) => {
        let errorMessage = 'Failed to watch location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        
        setLocationError(errorMessage);
      },
      defaultOptions
    );

    setWatchId(id);
  }, [watchId, getAddressFromCoordinates, setUserLocation]);

  // Stop watching user location
  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Load saved location from localStorage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const location = JSON.parse(savedLocation);
        // Check if location is not too old (24 hours)
        if (location.timestamp && Date.now() - location.timestamp < 24 * 60 * 60 * 1000) {
          setUserLocationState(location);
        } else {
          localStorage.removeItem('userLocation');
        }
      } catch (error) {
        console.warn('Error parsing saved location:', error);
        localStorage.removeItem('userLocation');
      }
    }
  }, []);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const value: LocationContextType = {
    userLocation,
    locationLoading,
    locationError,
    setUserLocation,
    getCurrentLocation,
    watchLocation,
    stopWatching,
    getAddressFromCoordinates,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}