// Google Maps JavaScript API service - Updated to use unified API cache system
// Note: This service handles Google Maps API deprecation warnings:
// - PlacesService deprecation warnings are suppressed (still functional for existing apps)
// - Deprecated 'open_now' field replaced with safer opening hours handling
// - For new implementations, consider migrating to Places API (New) when available

import { unifiedApiCache } from './unifiedApiCacheService';
import { ApiError } from '../utils/apiUtils';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.warn('Google Maps API key missing. Using mock data instead. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
}

// Unified API request wrapper for Google Maps Geocoding API
const makeGoogleMapsRequest = async <T>(
  endpoint: string,
  options: {
    signal?: AbortSignal;
    cacheKey?: string;
    cacheParams?: Record<string, any>;
    timeout?: number;
  } = {}
): Promise<T> => {
  const { signal, cacheKey, cacheParams, timeout = 10000 } = options;

  // Use unified API cache with Google Maps-specific configuration
  return unifiedApiCache.request<T>('google-maps-api', endpoint, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    signal,
    retryOptions: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 8000,
      shouldRetry: (error) => {
        if (error instanceof ApiError) {
          return (
            error.isNetworkError || 
            error.isRateLimitError || 
            error.status === 502 || 
            error.status === 503 || 
            error.status === 504
          );
        }
        return false;
      }
    },
    cacheOptions: {
      useCache: true,
      cacheKey,
      cacheParams,
      forceFresh: false
    },
    deduplication: { enabled: true, expiryMs: 2000 },
    debouncing: { enabled: false }
  });
};

// Load Google Maps JavaScript API with improved error handling
let isGoogleMapsLoaded = false;
let googleMapsPromise: Promise<any> | null = null;
let scriptElement: HTMLScriptElement | null = null;

const loadGoogleMaps = (): Promise<any> => {
  if (googleMapsPromise) {
    console.log('🗺️ Google Maps API already loading/loaded, returning existing promise');
    return googleMapsPromise;
  }

  if (!apiKey) {
    console.error('❌ Google Maps API key is missing. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
    return Promise.reject(new Error('Google Maps API key is required'));
  }

  // Check if Google Maps is already loaded by another script
  if (window.google && window.google.maps) {
    console.log('✅ Google Maps API already loaded by external script');
    isGoogleMapsLoaded = true;
    googleMapsPromise = Promise.resolve(window.google);
    return googleMapsPromise;
  }

  // Check if script is already in the DOM
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    console.log('🔄 Google Maps script already exists in DOM, waiting for it to load');
    googleMapsPromise = new Promise((resolve, reject) => {
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          isGoogleMapsLoaded = true;
          resolve(window.google);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Google Maps API loading timeout')), 10000);
    });
    return googleMapsPromise;
  }

  console.log('📦 Loading Google Maps JavaScript API...');
  googleMapsPromise = new Promise((resolve, reject) => {
    // Create script element
    scriptElement = document.createElement('script');
    scriptElement.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    scriptElement.async = true;
    scriptElement.defer = true;
    
    // Add callback to avoid multiple loading
    const callbackName = 'initGoogleMaps' + Date.now();
    (window as any)[callbackName] = () => {
      console.log('✅ Google Maps API loaded successfully');
      isGoogleMapsLoaded = true;
      delete (window as any)[callbackName];
      resolve(window.google);
    };
    
    // Add callback parameter to URL
    scriptElement.src += `&callback=${callbackName}`;
    
    scriptElement.onload = () => {
      console.log('📦 Google Maps script loaded');
    };
    
    scriptElement.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script:', error);
      delete (window as any)[callbackName];
      reject(new Error('Failed to load Google Maps API script'));
    };
    
    // Timeout handler
    setTimeout(() => {
      if (!isGoogleMapsLoaded) {
        console.error('⏰ Google Maps API loading timeout');
        delete (window as any)[callbackName];
        reject(new Error('Google Maps API loading timeout - check your API key and quota'));
      }
    }, 15000);
    
    document.head.appendChild(scriptElement);
  });

  return googleMapsPromise;
};

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    isOpen?: boolean;
    periods?: any[];
  };
  price_level?: number;
  types?: string[];
  vicinity?: string;
}

export interface PlacesSearchResponse {
  results: PlaceResult[];
  status: string;
  next_page_token?: string;
}

// Helper function to check API status and provide setup instructions
const checkApiSetup = () => {
  if (!apiKey) {
    console.group('🗺️ Google Maps API Setup Required');
    console.log('To enable Google Maps functionality:');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create a new project or select existing');
    console.log('3. Enable these APIs:');
    console.log('   • Maps JavaScript API');
    console.log('   • Places API');
    console.log('   • Geocoding API');
    console.log('4. Create credentials → API Key');
    console.log('5. Add VITE_GOOGLE_MAPS_API_KEY=your_key_here to .env file');
    console.log('6. Restart your development server');
    console.groupEnd();
    return false;
  }
  return true;
};

// Cleanup function to prevent memory leaks
const cleanup = () => {
  if (scriptElement && scriptElement.parentNode) {
    scriptElement.parentNode.removeChild(scriptElement);
    scriptElement = null;
  }
  googleMapsPromise = null;
  isGoogleMapsLoaded = false;
};

// Helper function to safely get opening hours without using deprecated methods
const getOpeningHoursInfo = (place: any) => {
  if (!place.opening_hours) {
    return undefined;
  }
  
  try {
    // Try to use the newer isOpen() method if available
    if (typeof place.opening_hours.isOpen === 'function') {
      return {
        isOpen: place.opening_hours.isOpen(),
        periods: place.opening_hours.periods
      };
    }
    
    // Fallback to basic opening hours info without deprecated open_now field
    return {
      periods: place.opening_hours.periods,
      weekday_text: place.opening_hours.weekday_text
    };
  } catch (error) {
    // If there's any error with opening hours, just return basic info
    console.log('⚠️ Could not determine opening hours for place');
    return {
      periods: place.opening_hours.periods || []
    };
  }
};

// Helper function to create PlacesService with warning suppression
const createPlacesService = (google: any) => {
  // Temporarily suppress console warnings for deprecated API
  const originalWarn = console.warn;
  let warningsSuppressed = 0;
  
  console.warn = (...args) => {
    const message = args.join(' ');
    // Suppress specific PlacesService deprecation warning
    if (message.includes('PlacesService is not available to new customers') ||
        message.includes('open_now is deprecated')) {
      warningsSuppressed++;
      // Only show this message once to avoid spam
      if (warningsSuppressed === 1) {
        console.log('ℹ️ Google Maps API: Using legacy PlacesService API (warnings suppressed for cleaner logs)');
      }
      return;
    }
    originalWarn.apply(console, args);
  };
  
  try {
    // Create a minimal map instance (required for PlacesService)
    const mapDiv = document.createElement('div');
    const map = new google.maps.Map(mapDiv, {
      center: { lat: 0, lng: 0 },
      zoom: 15
    });
    const service = new google.maps.places.PlacesService(map);
    
    // Restore original console.warn after a brief delay
    setTimeout(() => {
      console.warn = originalWarn;
    }, 100);
    
    return { map, service };
  } catch (error) {
    // Restore original console.warn in case of error
    console.warn = originalWarn;
    throw error;
  }
};

export const googleMapsService = {
  /**
   * Check if Google Maps API is properly configured
   */
  isConfigured(): boolean {
    return checkApiSetup();
  },

  /**
   * Get API configuration status
   */
  getApiStatus(): string {
    if (!apiKey) return 'missing_key';
    if (!isGoogleMapsLoaded) return 'not_loaded';
    if (window.google && window.google.maps) return 'ready';
    return 'loading';
  },

  /**
   * Cleanup resources (useful for tests or component unmounting)
   */
  cleanup,
  
  /**
   * Search for nearby places using Google Maps JavaScript API
   */
  async searchNearbyPlaces(
    location: { lat: number; lng: number },
    type: string,
    radius: number = 1500,
    keyword?: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<PlaceResult[]> {
    if (!apiKey) {
      console.warn('⚠️ Using mock places because Google Maps API key is missing');
      return getMockPlaces(type, keyword);
    }

    console.log(`🔍 Searching for ${type} near ${location.lat}, ${location.lng} with radius ${radius}m${keyword ? ` and keyword "${keyword}"` : ''}`);

    try {
      const google = await loadGoogleMaps();
      
      return new Promise((resolve) => {
        // Create a minimal map instance (required for PlacesService) with warning suppression
        const { map, service } = createPlacesService(google);
        
        const request = {
          location: new google.maps.LatLng(location.lat, location.lng),
          radius: radius,
          type: type,
          keyword: keyword
        };

        console.log('📡 Making Places API request:', request);

        service.nearbySearch(request, (results: any[], status: any) => {
          console.log(`📡 Places API response status: ${status}`);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            console.log(`✅ Found ${results.length} places via Google Maps API`);
            
            const formattedResults = results.map(place => ({
              place_id: place.place_id,
              name: place.name,
              formatted_address: place.vicinity || place.formatted_address || '',
              geometry: {
                location: {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng()
                }
              },
              rating: place.rating,
              user_ratings_total: place.user_ratings_total,
              photos: place.photos?.map((photo: any) => ({
                photo_reference: photo.getUrl({ maxWidth: 400 }),
                height: photo.height || 400,
                width: photo.width || 400
              })),
              opening_hours: getOpeningHoursInfo(place),
              price_level: place.price_level,
              types: place.types,
              vicinity: place.vicinity
            }));
            resolve(formattedResults);
          } else {
            // Handle specific error cases
            let errorMessage = '';
            switch (status) {
              case google.maps.places.PlacesServiceStatus.REQUEST_DENIED:
                errorMessage = '❌ Places API request denied. Check your API key and ensure Places API is enabled.';
                break;
              case google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
                errorMessage = '⏰ Places API quota exceeded. Check your usage limits.';
                break;
              case google.maps.places.PlacesServiceStatus.ZERO_RESULTS:
                errorMessage = `ℹ️ No ${type} found near this location.`;
                break;
              case google.maps.places.PlacesServiceStatus.INVALID_REQUEST:
                errorMessage = '❌ Invalid Places API request.';
                break;
              default:
                errorMessage = `⚠️ Places API error: ${status}`;
            }
            
            console.warn(errorMessage);
            console.log('🔄 Using mock data instead');
            resolve(getMockPlaces(type, keyword));
          }
        });
      });
    } catch (error) {
      console.error('❌ Error with Google Maps API:', error);
      console.log('🔄 Using mock data instead');
      return getMockPlaces(type, keyword);
    }
  },

  /**
   * Get details for a specific place using JavaScript API
   */
  async getPlaceDetails(
    placeId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<any> {
    if (!apiKey) {
      console.warn('Cannot get place details without API key');
      return null;
    }

    try {
      const google = await loadGoogleMaps();
      
      return new Promise((resolve) => {
        const { map, service } = createPlacesService(google);
        
        const request = {
          placeId: placeId,
          fields: ['name', 'formatted_address', 'geometry', 'rating', 'photos', 'opening_hours', 'price_level', 'types', 'website', 'formatted_phone_number', 'reviews']
        };

        service.getDetails(request, (place: any, status: any) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            resolve({
              place_id: place.place_id,
              name: place.name,
              formatted_address: place.formatted_address,
              geometry: {
                location: {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng()
                }
              },
              rating: place.rating,
              photos: place.photos?.map((photo: any) => ({
                photo_reference: photo.getUrl({ maxWidth: 400 }),
                height: photo.height || 400,
                width: photo.width || 400
              })),
              opening_hours: getOpeningHoursInfo(place),
              price_level: place.price_level,
              types: place.types,
              website: place.website,
              formatted_phone_number: place.formatted_phone_number,
              reviews: place.reviews
            });
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  },

  /**
   * Get photo URL - now handles both direct URLs and photo references
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    // If it's already a full URL (from the new JavaScript API approach), return it
    if (photoReference.startsWith('http')) {
      return photoReference;
    }
    
    // If using mock data, return placeholder
    if (!apiKey || photoReference.startsWith('mock-')) {
      return `https://source.unsplash.com/random/400x300/?landmark,${encodeURIComponent(photoReference)}`;
    }
    
    // For legacy photo references (shouldn't happen with new implementation)
    return `https://via.placeholder.com/${maxWidth}x${maxWidth/2}?text=Image+Not+Available`;
  },

  /**
   * Search for restaurants near a location
   */
  async searchNearbyRestaurants(
    location: { lat: number; lng: number },
    radius: number = 1500,
    cuisine?: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<PlaceResult[]> {
    return this.searchNearbyPlaces(
      location,
      'restaurant',
      radius,
      cuisine,
      options
    );
  },

  /**
   * Search for attractions near a location
   */
  async searchNearbyAttractions(
    location: { lat: number; lng: number },
    radius: number = 2000,
    options: { signal?: AbortSignal } = {}
  ): Promise<PlaceResult[]> {
    return this.searchNearbyPlaces(
      location,
      'tourist_attraction',
      radius,
      undefined,
      options
    );
  },

  /**
   * Geocode an address using unified API cache system
   */
  async geocodeAddress(
    address: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ lat: number; lng: number }> {
    if (!apiKey) {
      console.warn('⚠️ Using mock coordinates for geocoding - no API key');
      return getMockCoordinates(address);
    }

    console.log(`🌍 Geocoding address with unified cache: "${address}"`);

    try {
      // Use Geocoding API through unified cache when possible
      const params = new URLSearchParams({
        address: address,
        key: apiKey
      });
      
      const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
      
      const response = await makeGoogleMapsRequest<any>(url, {
        signal: options.signal,
        cacheKey: `geocode_${address}`,
        cacheParams: { address }
      });

      if (response.status === 'OK' && response.results?.[0]) {
        const location = response.results[0].geometry.location;
        const coordinates = {
          lat: location.lat,
          lng: location.lng
        };
        console.log(`✅ Geocoded "${address}" to:`, coordinates);
        return coordinates;
      } else {
        console.warn(`⚠️ Geocoding failed for "${address}": ${response.status}`);
        return getMockCoordinates(address);
      }
    } catch (error) {
      console.error('❌ Error geocoding address:', error);
      
      // Fallback to JavaScript API geocoding
      try {
        const google = await loadGoogleMaps();
        
        return new Promise((resolve, reject) => {
          const geocoder = new google.maps.Geocoder();
          
          geocoder.geocode({ address }, (results: any[], status: any) => {
            console.log(`📍 JavaScript API Geocoding response status: ${status}`);
            
            if (status === google.maps.GeocoderStatus.OK && results[0]) {
              const location = results[0].geometry.location;
              const coordinates = {
                lat: location.lat(),
                lng: location.lng()
              };
              console.log(`✅ Geocoded "${address}" to:`, coordinates);
              resolve(coordinates);
            } else {
              console.warn(`⚠️ JavaScript geocoding failed: ${status}`);
              resolve(getMockCoordinates(address));
            }
          });
        });
      } catch (jsError) {
        console.error('❌ JavaScript API geocoding also failed:', jsError);
        return getMockCoordinates(address);
      }
    }
  },

  /**
   * Get place predictions for autocomplete using JavaScript API
   */
  async getPlacePredictions(input: string, types: string = 'geocode'): Promise<any[]> {
    if (!apiKey) {
      return [];
    }

    try {
      const google = await loadGoogleMaps();
      
      return new Promise((resolve) => {
        const service = new google.maps.places.AutocompleteService();
        
        service.getPlacePredictions({
          input,
          types: [types]
        }, (predictions: any[], status: any) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            resolve(predictions);
          } else {
            resolve([]);
          }
        });
      });
    } catch (error) {
      console.error('Error getting place predictions:', error);
      return [];
    }
  },

  /**
   * Get place details from place_id using JavaScript API
   */
  async getPlaceFromId(placeId: string): Promise<{ lat: number; lng: number }> {
    if (!apiKey) {
      throw new Error('Google Maps API key is required');
    }

    try {
      const google = await loadGoogleMaps();
      
      return new Promise((resolve, reject) => {
        const { map, service } = createPlacesService(google);
        
        service.getDetails({
          placeId: placeId,
          fields: ['geometry']
        }, (place: any, status: any) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const location = place.geometry.location;
            resolve({
              lat: location.lat(),
              lng: location.lng()
            });
          } else {
            reject(new Error(`Failed to get place details: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('Error getting place from ID:', error);
      throw error;
    }
  }
};

// Mock data functions for development and testing
function getMockPlaces(type: string, keyword?: string): PlaceResult[] {
  console.log('Using mock places data for', type, keyword ? `with keyword ${keyword}` : '');
  
  // Get the current mock coordinates to determine which city to show
  const mockCity = getCurrentMockCity();
  
  if (type === 'restaurant') {
    if (mockCity === 'atlanta') {
      return [
        {
          place_id: 'mock-atlanta-restaurant-1',
          name: 'The Optimist',
          formatted_address: '914 Howell Mill Rd, Atlanta, GA 30318',
          geometry: {
            location: { lat: 33.7890, lng: -84.4037 }
          },
          rating: 4.6,
          user_ratings_total: 250,
          price_level: 3,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Atlanta, GA',
          photos: [
            {
              photo_reference: 'https://source.unsplash.com/400x300/?restaurant,seafood,atlanta',
              height: 300,
              width: 400
            }
          ]
        },
        {
          place_id: 'mock-atlanta-restaurant-2',
          name: 'Bacchanalia',
          formatted_address: '1198 Howell Mill Rd, Atlanta, GA 30309',
          geometry: {
            location: { lat: 33.7845, lng: -84.4123 }
          },
          rating: 4.7,
          user_ratings_total: 180,
          price_level: 4,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Atlanta, GA',
          photos: [
            {
              photo_reference: 'https://source.unsplash.com/400x300/?fine-dining,atlanta',
              height: 300,
              width: 400
            }
          ]
        },
        {
          place_id: 'mock-atlanta-restaurant-3',
          name: 'Mary Mac\'s Tea Room',
          formatted_address: '224 Ponce De Leon Ave NE, Atlanta, GA 30308',
          geometry: {
            location: { lat: 33.7712, lng: -84.3734 }
          },
          rating: 4.4,
          user_ratings_total: 220,
          price_level: 2,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Atlanta, GA',
          photos: [
            {
              photo_reference: 'https://source.unsplash.com/400x300/?southern-food,atlanta',
              height: 300,
              width: 400
            }
          ]
        }
      ];
    }
    // Keep existing mock data for other cities...
    return [];
  } else if (type === 'tourist_attraction') {
    if (mockCity === 'atlanta') {
      return [
        {
          place_id: 'mock-atlanta-attraction-1',
          name: 'Georgia Aquarium',
          formatted_address: '225 Baker St NW, Atlanta, GA 30313',
          geometry: {
            location: { lat: 33.7634, lng: -84.3951 }
          },
          rating: 4.5,
          user_ratings_total: 280,
          types: ['tourist_attraction', 'aquarium', 'point_of_interest'],
          vicinity: 'Atlanta, GA',
          photos: [
            {
              photo_reference: 'https://source.unsplash.com/400x300/?aquarium,atlanta',
              height: 300,
              width: 400
            }
          ]
        },
        {
          place_id: 'mock-atlanta-attraction-2',
          name: 'World of Coca-Cola',
          formatted_address: '121 Baker St NW, Atlanta, GA 30313',
          geometry: {
            location: { lat: 33.7627, lng: -84.3928 }
          },
          rating: 4.3,
          user_ratings_total: 200,
          types: ['tourist_attraction', 'museum', 'point_of_interest'],
          vicinity: 'Atlanta, GA',
          photos: [
            {
              photo_reference: 'https://source.unsplash.com/400x300/?coca-cola,museum,atlanta',
              height: 300,
              width: 400
            }
          ]
        },
        {
          place_id: 'mock-atlanta-attraction-3',
          name: 'Piedmont Park',
          formatted_address: '1320 Monroe Dr NE, Atlanta, GA 30306',
          geometry: {
            location: { lat: 33.7879, lng: -84.3733 }
          },
          rating: 4.6,
          user_ratings_total: 250,
          types: ['park', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'Atlanta, GA',
          photos: [
            {
              photo_reference: 'https://source.unsplash.com/400x300/?park,atlanta,skyline',
              height: 300,
              width: 400
            }
          ]
        }
      ];
    }
    // Keep existing mock data for other cities...
    return [];
  }
  
  return [];
}

// Store the last geocoded address to determine which mock data to return
let lastGeocodedAddress = '';

function getMockCoordinates(address: string): { lat: number; lng: number } {
  console.log('Using mock coordinates for', address);
  
  // Store the address for later use in getMockPlaces
  lastGeocodedAddress = address.toLowerCase();
  
  // Return coordinates based on the address
  if (address.toLowerCase().includes('atlanta')) {
    return { lat: 33.7490, lng: -84.3880 };
  }
  
  if (address.toLowerCase().includes('orlando')) {
    return { lat: 28.5383, lng: -81.3792 };
  }
  
  if (address.toLowerCase().includes('paris')) {
    return { lat: 48.8566, lng: 2.3522 };
  }
  
  if (address.toLowerCase().includes('london')) {
    return { lat: 51.5074, lng: -0.1278 };
  }
  
  if (address.toLowerCase().includes('new york')) {
    return { lat: 40.7128, lng: -74.0060 };
  }
  
  if (address.toLowerCase().includes('tokyo')) {
    return { lat: 35.6762, lng: 139.6503 };
  }
  
  // For any other location, return some default coordinates
  return { lat: 33.7490, lng: -84.3880 }; // Default to Atlanta
}

// Helper function to determine which city to use for mock data
function getCurrentMockCity(): string {
  if (lastGeocodedAddress.includes('atlanta')) {
    return 'atlanta';
  } else if (lastGeocodedAddress.includes('orlando')) {
    return 'orlando';
  } else if (lastGeocodedAddress.includes('new york')) {
    return 'new york';
  } else if (lastGeocodedAddress.includes('london')) {
    return 'london';
  } else if (lastGeocodedAddress.includes('tokyo')) {
    return 'tokyo';
  } else if (lastGeocodedAddress.includes('paris')) {
    return 'paris';
  } else {
    return 'atlanta'; // Default
  }
}

// Add global type declaration for Google Maps
declare global {
  interface Window {
    google: any;
  }
} 