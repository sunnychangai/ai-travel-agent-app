// Google Maps API service
import { ApiCache } from '../utils/cacheUtils';
import { fetchWithRetry, ApiError, fetchWithCache, googleMapsCache } from '../utils/apiUtils';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.warn('Google Maps API key missing. Check your .env file.');
}

// Cache implementation using shared ApiCache utility
const mapsCache = new ApiCache<any>('GoogleMaps', 24 * 60 * 60 * 1000); // 24 hours cache

// Helper function to use a proxy for API requests to avoid CORS issues and utilize caching
const fetchWithProxyAndCache = async <T>(url: string, options: RequestInit = {}, cacheKey?: string): Promise<T> => {
  try {
    // Try with cache first
    return await fetchWithCache<T>(
      url,
      options,
      {
        useCache: true,
        cacheKey: cacheKey || url,
        cache: googleMapsCache
      }
    );
  } catch (error) {
    // If it fails due to CORS, try with proxy
    if (error instanceof ApiError && error.isNetworkError) {
      console.warn('Direct API call failed, likely due to CORS. Trying with proxy...');
      const corsProxyUrl = 'https://corsproxy.io/?';
      return await fetchWithCache<T>(
        corsProxyUrl + encodeURIComponent(url),
        options,
        {
          useCache: true,
          cacheKey: cacheKey || url,
          cache: googleMapsCache
        }
      );
    }
    throw error;
  }
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
    open_now?: boolean;
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

export const googleMapsService = {
  /**
   * Search for nearby places based on location and type
   */
  async searchNearbyPlaces(
    location: { lat: number; lng: number },
    type: string,
    radius: number = 1500,
    keyword?: string
  ): Promise<PlaceResult[]> {
    if (!apiKey) {
      console.warn('Using mock places because API key is missing');
      return getMockPlaces(type, keyword);
    }

    try {
      const params = new URLSearchParams({
        location: `${location.lat},${location.lng}`,
        radius: radius.toString(),
        type,
        key: apiKey,
      });

      if (keyword) {
        params.append('keyword', keyword);
      }

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
      const cacheKey = `places_${type}_${location.lat}_${location.lng}_${radius}_${keyword || ''}`;
      
      const response = await fetchWithProxyAndCache<PlacesSearchResponse>(url, {}, cacheKey);

      if (response.status !== 'OK') {
        console.error('Google Places API error:', response.status);
        return getMockPlaces(type, keyword);
      }

      return response.results;
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      return getMockPlaces(type, keyword);
    }
  },

  /**
   * Get details for a specific place
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    if (!apiKey) {
      console.warn('Cannot get place details without API key');
      return null;
    }

    try {
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'name,formatted_address,geometry,rating,photos,opening_hours,price_level,types,website,formatted_phone_number,reviews',
        key: apiKey,
      });

      const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
      const cacheKey = `place_details_${placeId}`;
      
      const response = await fetchWithProxyAndCache<any>(url, {}, cacheKey);

      if (response.status !== 'OK') {
        console.error('Google Place Details API error:', response.status);
        return null;
      }

      return response.result;
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  },

  /**
   * Get a photo URL for a place
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    // If using mock data or no API key, return a placeholder image
    if (!apiKey || photoReference.startsWith('mock-')) {
      return `https://source.unsplash.com/random/400x300/?landmark,${encodeURIComponent(photoReference)}`;
    }
    
    // For real photo references, use the Places API v1
    try {
      // The photoReference should be in the format "places/PLACE_ID/photos/PHOTO_RESOURCE"
      // If it's not in this format (e.g., from older API versions), we need to handle it differently
      if (photoReference.startsWith('places/')) {
        // New Places API v1 format
        return `https://places.googleapis.com/v1/${photoReference}/media?key=${apiKey}&maxWidthPx=${maxWidth}`;
      } else {
        // Legacy format - use the older API with CORS proxy
        const corsProxyUrl = 'https://corsproxy.io/?';
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
        return corsProxyUrl + encodeURIComponent(photoUrl);
      }
    } catch (error) {
      console.error('Error creating photo URL:', error);
      return `https://via.placeholder.com/${maxWidth}x${maxWidth/2}?text=Image+Not+Available`;
    }
  },

  /**
   * Search for restaurants near a location
   */
  async searchNearbyRestaurants(
    location: { lat: number; lng: number },
    radius: number = 1500,
    cuisine?: string
  ): Promise<PlaceResult[]> {
    return this.searchNearbyPlaces(
      location,
      'restaurant',
      radius,
      cuisine
    );
  },

  /**
   * Search for attractions near a location
   */
  async searchNearbyAttractions(
    location: { lat: number; lng: number },
    radius: number = 2000
  ): Promise<PlaceResult[]> {
    return this.searchNearbyPlaces(
      location,
      'tourist_attraction',
      radius
    );
  },

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    try {
      const params = new URLSearchParams({
        address,
        key: apiKey,
      });

      // Use mock data for development if API key is missing or for testing
      if (!apiKey) {
        console.warn('Using mock data for geocoding');
        return getMockCoordinates(address);
      }

      const response = await fetchWithProxyAndCache<any>(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status}`);
      }

      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    } catch (error) {
      console.error('Error geocoding address:', error);
      // Return mock coordinates as fallback
      return getMockCoordinates(address);
    }
  },

  /**
   * Get place predictions for autocomplete
   */
  async getPlacePredictions(input: string, types: string = 'geocode'): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        input,
        types,
        key: apiKey,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Maps API error: ${data.status}`);
      }

      return data.predictions || [];
    } catch (error) {
      console.error('Error getting place predictions:', error);
      return [];
    }
  },

  /**
   * Get place details from place_id
   */
  async getPlaceFromId(placeId: string): Promise<{ lat: number; lng: number }> {
    try {
      const params = new URLSearchParams({
        place_id: placeId,
        key: apiKey,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}&fields=geometry`
      );

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status}`);
      }

      const location = data.result.geometry.location;
      return { lat: location.lat, lng: location.lng };
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
    if (mockCity === 'new york') {
      return [
        {
          place_id: 'mock-nyc-restaurant-1',
          name: 'Katz\'s Delicatessen',
          formatted_address: '205 E Houston St, New York, NY 10002',
          geometry: {
            location: { lat: 40.7223, lng: -73.9874 }
          },
          rating: 4.5,
          user_ratings_total: 230,
          price_level: 2,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'New York, NY',
          photos: [
            {
              photo_reference: 'mock-nyc-restaurant-1',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-nyc-restaurant-2',
          name: 'Lombardi\'s Pizza',
          formatted_address: '32 Spring St, New York, NY 10012',
          geometry: {
            location: { lat: 40.7217, lng: -73.9956 }
          },
          rating: 4.3,
          user_ratings_total: 180,
          price_level: 2,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'New York, NY',
          photos: [
            {
              photo_reference: 'mock-nyc-restaurant-2',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-nyc-restaurant-3',
          name: 'Gramercy Tavern',
          formatted_address: '42 E 20th St, New York, NY 10003',
          geometry: {
            location: { lat: 40.7387, lng: -73.9885 }
          },
          rating: 4.7,
          user_ratings_total: 210,
          price_level: 4,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'New York, NY',
          photos: [
            {
              photo_reference: 'mock-nyc-restaurant-3',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    } else if (mockCity === 'london') {
      return [
        {
          place_id: 'mock-london-restaurant-1',
          name: 'The Ivy',
          formatted_address: '1-5 West St, London WC2H 9NQ',
          geometry: {
            location: { lat: 51.5115, lng: -0.1266 }
          },
          rating: 4.6,
          user_ratings_total: 190,
          price_level: 3,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'London',
          photos: [
            {
              photo_reference: 'mock-london-restaurant-1',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-london-restaurant-2',
          name: 'Dishoom',
          formatted_address: '12 Upper St Martin\'s Lane, London WC2H 9FB',
          geometry: {
            location: { lat: 51.5125, lng: -0.1259 }
          },
          rating: 4.5,
          user_ratings_total: 220,
          price_level: 2,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'London',
          photos: [
            {
              photo_reference: 'mock-london-restaurant-2',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-london-restaurant-3',
          name: 'Gordon Ramsay Restaurant',
          formatted_address: '68 Royal Hospital Rd, London SW3 4HP',
          geometry: {
            location: { lat: 51.4847, lng: -0.1621 }
          },
          rating: 4.8,
          user_ratings_total: 170,
          price_level: 4,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'London',
          photos: [
            {
              photo_reference: 'mock-london-restaurant-3',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    } else if (mockCity === 'tokyo') {
      return [
        {
          place_id: 'mock-tokyo-restaurant-1',
          name: 'Sukiyabashi Jiro',
          formatted_address: '4-2-15 Ginza, Chuo City, Tokyo 104-0061',
          geometry: {
            location: { lat: 35.6698, lng: 139.7628 }
          },
          rating: 4.9,
          user_ratings_total: 150,
          price_level: 4,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Tokyo',
          photos: [
            {
              photo_reference: 'mock-tokyo-restaurant-1',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-tokyo-restaurant-2',
          name: 'Ichiran Ramen',
          formatted_address: '1-22-7 Jinnan, Shibuya City, Tokyo 150-0041',
          geometry: {
            location: { lat: 35.6614, lng: 139.7006 }
          },
          rating: 4.4,
          user_ratings_total: 200,
          price_level: 2,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Tokyo',
          photos: [
            {
              photo_reference: 'mock-tokyo-restaurant-2',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-tokyo-restaurant-3',
          name: 'Gonpachi Nishi-Azabu',
          formatted_address: '1-13-11 Nishiazabu, Minato City, Tokyo 106-0031',
          geometry: {
            location: { lat: 35.6592, lng: 139.7215 }
          },
          rating: 4.3,
          user_ratings_total: 180,
          price_level: 3,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Tokyo',
          photos: [
            {
              photo_reference: 'mock-tokyo-restaurant-3',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    } else {
      // Default to Paris
      return [
        {
          place_id: 'mock-restaurant-1',
          name: 'Le Petit Bistro',
          formatted_address: '123 Champs-Élysées, Paris, France',
          geometry: {
            location: { lat: 48.8566, lng: 2.3522 }
          },
          rating: 4.5,
          user_ratings_total: 120,
          price_level: 3,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Paris, France',
          photos: [
            {
              photo_reference: 'mock-paris-restaurant-1',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-restaurant-2',
          name: 'Café de Paris',
          formatted_address: '45 Rue de Rivoli, Paris, France',
          geometry: {
            location: { lat: 48.8584, lng: 2.3536 }
          },
          rating: 4.2,
          user_ratings_total: 98,
          price_level: 2,
          types: ['cafe', 'restaurant', 'food', 'point_of_interest'],
          vicinity: 'Paris, France',
          photos: [
            {
              photo_reference: 'mock-paris-restaurant-2',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-restaurant-3',
          name: 'La Brasserie Parisienne',
          formatted_address: '78 Avenue des Champs-Élysées, Paris, France',
          geometry: {
            location: { lat: 48.8698, lng: 2.3075 }
          },
          rating: 4.7,
          user_ratings_total: 156,
          price_level: 4,
          types: ['restaurant', 'food', 'point_of_interest'],
          vicinity: 'Paris, France',
          photos: [
            {
              photo_reference: 'mock-paris-restaurant-3',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    }
  } else if (type === 'tourist_attraction') {
    if (mockCity === 'new york') {
      return [
        {
          place_id: 'mock-nyc-attraction-1',
          name: 'Empire State Building',
          formatted_address: '20 W 34th St, New York, NY 10001',
          geometry: {
            location: { lat: 40.7484, lng: -73.9857 }
          },
          rating: 4.7,
          user_ratings_total: 250,
          types: ['tourist_attraction', 'point_of_interest'],
          vicinity: 'New York, NY',
          photos: [
            {
              photo_reference: 'mock-nyc-empire-state',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-nyc-attraction-2',
          name: 'Statue of Liberty',
          formatted_address: 'New York, NY 10004',
          geometry: {
            location: { lat: 40.6892, lng: -74.0445 }
          },
          rating: 4.7,
          user_ratings_total: 230,
          types: ['tourist_attraction', 'point_of_interest'],
          vicinity: 'New York, NY',
          photos: [
            {
              photo_reference: 'mock-nyc-statue-liberty',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-nyc-attraction-3',
          name: 'Central Park',
          formatted_address: 'New York, NY',
          geometry: {
            location: { lat: 40.7812, lng: -73.9665 }
          },
          rating: 4.8,
          user_ratings_total: 270,
          types: ['park', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'New York, NY',
          photos: [
            {
              photo_reference: 'mock-nyc-central-park',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    } else if (mockCity === 'london') {
      return [
        {
          place_id: 'mock-london-attraction-1',
          name: 'Tower of London',
          formatted_address: 'London EC3N 4AB',
          geometry: {
            location: { lat: 51.5081, lng: -0.0759 }
          },
          rating: 4.6,
          user_ratings_total: 210,
          types: ['tourist_attraction', 'point_of_interest'],
          vicinity: 'London',
          photos: [
            {
              photo_reference: 'mock-london-tower',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-london-attraction-2',
          name: 'British Museum',
          formatted_address: 'Great Russell St, London WC1B 3DG',
          geometry: {
            location: { lat: 51.5194, lng: -0.1269 }
          },
          rating: 4.7,
          user_ratings_total: 230,
          types: ['museum', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'London',
          photos: [
            {
              photo_reference: 'mock-london-museum',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-london-attraction-3',
          name: 'Buckingham Palace',
          formatted_address: 'London SW1A 1AA',
          geometry: {
            location: { lat: 51.5014, lng: -0.1419 }
          },
          rating: 4.5,
          user_ratings_total: 190,
          types: ['tourist_attraction', 'point_of_interest'],
          vicinity: 'London',
          photos: [
            {
              photo_reference: 'mock-london-palace',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    } else if (mockCity === 'tokyo') {
      return [
        {
          place_id: 'mock-tokyo-attraction-1',
          name: 'Tokyo Skytree',
          formatted_address: '1-1-2 Oshiage, Sumida City, Tokyo 131-0045',
          geometry: {
            location: { lat: 35.7101, lng: 139.8107 }
          },
          rating: 4.6,
          user_ratings_total: 200,
          types: ['tourist_attraction', 'point_of_interest'],
          vicinity: 'Tokyo',
          photos: [
            {
              photo_reference: 'mock-tokyo-skytree',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-tokyo-attraction-2',
          name: 'Senso-ji Temple',
          formatted_address: '2-3-1 Asakusa, Taito City, Tokyo 111-0032',
          geometry: {
            location: { lat: 35.7147, lng: 139.7966 }
          },
          rating: 4.7,
          user_ratings_total: 190,
          types: ['temple', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'Tokyo',
          photos: [
            {
              photo_reference: 'mock-tokyo-sensoji',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-tokyo-attraction-3',
          name: 'Meiji Shrine',
          formatted_address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557',
          geometry: {
            location: { lat: 35.6763, lng: 139.6993 }
          },
          rating: 4.6,
          user_ratings_total: 180,
          types: ['shrine', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'Tokyo',
          photos: [
            {
              photo_reference: 'mock-tokyo-meiji',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    } else {
      // Default to Paris
      return [
        {
          place_id: 'mock-attraction-1',
          name: 'Eiffel Tower',
          formatted_address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
          geometry: {
            location: { lat: 48.8584, lng: 2.2945 }
          },
          rating: 4.8,
          user_ratings_total: 230,
          types: ['tourist_attraction', 'point_of_interest'],
          vicinity: 'Paris, France',
          photos: [
            {
              photo_reference: 'mock-paris-eiffel-tower',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-attraction-2',
          name: 'Louvre Museum',
          formatted_address: 'Rue de Rivoli, 75001 Paris, France',
          geometry: {
            location: { lat: 48.8606, lng: 2.3376 }
          },
          rating: 4.7,
          user_ratings_total: 210,
          types: ['museum', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'Paris, France',
          photos: [
            {
              photo_reference: 'mock-paris-louvre',
              height: 400,
              width: 600
            }
          ]
        },
        {
          place_id: 'mock-attraction-3',
          name: 'Notre-Dame Cathedral',
          formatted_address: '6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris, France',
          geometry: {
            location: { lat: 48.8530, lng: 2.3499 }
          },
          rating: 4.7,
          user_ratings_total: 180,
          types: ['church', 'tourist_attraction', 'point_of_interest'],
          vicinity: 'Paris, France',
          photos: [
            {
              photo_reference: 'mock-paris-notre-dame',
              height: 400,
              width: 600
            }
          ]
        }
      ];
    }
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
  // In a real app, this would use the actual Google Maps API
  return { lat: 48.8566, lng: 2.3522 }; // Default to Paris
}

// Helper function to determine which city to use for mock data
function getCurrentMockCity(): string {
  if (lastGeocodedAddress.includes('new york')) {
    return 'new york';
  } else if (lastGeocodedAddress.includes('london')) {
    return 'london';
  } else if (lastGeocodedAddress.includes('tokyo')) {
    return 'tokyo';
  } else if (lastGeocodedAddress.includes('paris')) {
    return 'paris';
  } else {
    // Try to extract a city name from the address
    const possibleCities = ['new york', 'london', 'tokyo', 'paris'];
    for (const city of possibleCities) {
      if (lastGeocodedAddress.includes(city)) {
        return city;
      }
    }
    return 'paris'; // Default
  }
} 