// TripAdvisor API service - Updated to use unified API cache system
import { unifiedApiCache } from './unifiedApiCacheService';
import { ApiError } from '../utils/apiUtils';

const apiKey = import.meta.env.VITE_TRIPADVISOR_API_KEY;

if (!apiKey) {
  console.warn('TripAdvisor API key missing. Check your .env file.');
}

// Unified API request wrapper for TripAdvisor API
const makeTripadvisorRequest = async <T>(
  endpoint: string,
  options: {
    signal?: AbortSignal;
    cacheKey?: string;
    cacheParams?: Record<string, any>;
    timeout?: number;
    useCorsProxy?: boolean;
  } = {}
): Promise<T> => {
  const { 
    signal, 
    cacheKey, 
    cacheParams, 
    timeout = 10000,
    useCorsProxy = false 
  } = options;

  // Build the URL
  let url = endpoint;
  if (useCorsProxy) {
    const corsProxyUrl = 'https://corsproxy.io/?';
    url = corsProxyUrl + encodeURIComponent(endpoint);
  }

  try {
    // Use unified API cache with TripAdvisor-specific configuration
    return await unifiedApiCache.request<T>('tripadvisor-api', url, {
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
  } catch (error: any) {
    // If direct API call fails due to CORS, try with proxy
    if (!useCorsProxy && error instanceof ApiError && (error.isNetworkError || error.status === 0)) {
      console.warn('Direct TripAdvisor API call failed, trying with CORS proxy...');
      return makeTripadvisorRequest<T>(endpoint, { 
        ...options, 
        useCorsProxy: true 
      });
    }
    throw error;
  }
};

export interface TripAdvisorLocation {
  location_id: string;
  name: string;
  description?: string;
  web_url: string;
  address_obj?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalcode?: string;
    address_string?: string;
  };
  latitude?: number;
  longitude?: number;
  rating?: number;
  num_reviews?: number;
  photo?: {
    images: {
      small: { url: string };
      thumbnail: { url: string };
      original: { url: string };
      large: { url: string };
      medium: { url: string };
    };
    caption?: string;
    id?: string;
  };
  category?: {
    key?: string;
    name?: string;
  };
  subcategory?: Array<{
    key?: string;
    name?: string;
  }>;
  price_level?: string;
  hours?: {
    weekday_text?: string[];
  };
  ranking?: string;
  ranking_position?: number;
}

export interface TripAdvisorReview {
  id: string;
  lang: string;
  location_id: string;
  published_date: string;
  rating: number;
  helpful_votes: number;
  rating_image_url: string;
  url: string;
  trip_type: string;
  travel_date: string;
  text: string;
  title: string;
  user: {
    username: string;
    user_location?: {
      name: string;
    };
    avatar?: {
      small: { url: string };
      large: { url: string };
    };
  };
}

export interface TripAdvisorAttraction extends TripAdvisorLocation {
  booking_options?: {
    url: string;
    price?: {
      amount: number;
      currency: string;
    };
    provider?: string;
  }[];
  offer_group?: {
    lowest_price?: string;
    offer_list?: {
      url: string;
      price?: string;
      provider?: string;
    }[];
  };
}

export interface TripAdvisorSearchResponse {
  data: TripAdvisorLocation[];
  paging?: {
    results?: number;
    total_results?: number;
  };
}

export interface TripAdvisorReviewsResponse {
  data: TripAdvisorReview[];
  paging?: {
    results?: number;
    total_results?: number;
  };
}

export const tripAdvisorService = {
  /**
   * Search for locations by query
   */
  async searchLocations(
    query: string,
    category?: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<TripAdvisorLocation[]> {
    if (!apiKey) {
      console.warn('Using mock data for TripAdvisor locations search');
      return getMockLocations(query, category);
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        searchQuery: query,
        language: 'en',
      });

      if (category) {
        params.append('category', category);
      }

      const url = `https://api.content.tripadvisor.com/api/v1/location/search?${params}`;
      
      const response = await makeTripadvisorRequest<TripAdvisorSearchResponse>(url, {
        signal: options.signal,
        cacheKey: `search_${query}_${category || 'all'}`,
        cacheParams: { query, category }
      });

      if (!response.data) {
        console.error('TripAdvisor API error: No data in response');
        return getMockLocations(query, category);
      }

      return response.data;
    } catch (error) {
      console.error('Error searching TripAdvisor locations:', error);
      return getMockLocations(query, category);
    }
  },

  /**
   * Get location details by ID
   */
  async getLocationDetails(
    locationId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<TripAdvisorLocation> {
    if (!apiKey) {
      console.warn('Using mock data for TripAdvisor location details');
      return getMockLocationDetails(locationId);
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        language: 'en',
        currency: 'USD',
      });

      const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details?${params}`;
      
      const response = await makeTripadvisorRequest<TripAdvisorLocation>(url, {
        signal: options.signal,
        cacheKey: `details_${locationId}`,
        cacheParams: { locationId }
      });

      return response;
    } catch (error) {
      console.error('Error getting TripAdvisor location details:', error);
      return getMockLocationDetails(locationId);
    }
  },

  /**
   * Get reviews for a location
   */
  async getLocationReviews(
    locationId: string, 
    limit: number = 5,
    options: { signal?: AbortSignal } = {}
  ): Promise<TripAdvisorReview[]> {
    if (!apiKey) {
      console.warn('TripAdvisor API key missing. Cannot fetch reviews.');
      return [];
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        language: 'en',
        limit: limit.toString(),
      });

      const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/reviews?${params}`;
      
      const response = await makeTripadvisorRequest<TripAdvisorReviewsResponse>(url, {
        signal: options.signal,
        cacheKey: `reviews_${locationId}_${limit}`,
        cacheParams: { locationId, limit }
      });

      return response.data || [];
    } catch (error) {
      console.error('Error getting TripAdvisor reviews:', error);
      return [];
    }
  },

  /**
   * Get nearby attractions
   */
  async getNearbyAttractions(
    latitude: number,
    longitude: number,
    radius: number = 10,
    limit: number = 10,
    options: { signal?: AbortSignal } = {}
  ): Promise<TripAdvisorAttraction[]> {
    if (!apiKey) {
      console.warn('TripAdvisor API key missing. Cannot fetch nearby attractions.');
      return [];
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        language: 'en',
        latLong: `${latitude},${longitude}`,
        radius: radius.toString(),
        limit: limit.toString(),
        category: 'attractions',
      });

      const url = `https://api.content.tripadvisor.com/api/v1/location/nearby_search?${params}`;
      
      const response = await makeTripadvisorRequest<TripAdvisorSearchResponse>(url, {
        signal: options.signal,
        cacheKey: `nearby_${latitude}_${longitude}_${radius}_${limit}`,
        cacheParams: { latitude, longitude, radius, limit }
      });

      return (response.data as TripAdvisorAttraction[]) || [];
    } catch (error) {
      console.error('Error getting nearby TripAdvisor attractions:', error);
      return [];
    }
  },

  /**
   * Get attraction photos
   */
  async getLocationPhotos(
    locationId: string, 
    limit: number = 5,
    options: { signal?: AbortSignal } = {}
  ): Promise<any[]> {
    if (!apiKey) {
      console.warn('TripAdvisor API key missing. Cannot fetch photos.');
      return [];
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        language: 'en',
        limit: limit.toString(),
      });

      const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/photos?${params}`;
      
      const response = await makeTripadvisorRequest<{ data: any[] }>(url, {
        signal: options.signal,
        cacheKey: `photos_${locationId}_${limit}`,
        cacheParams: { locationId, limit }
      });

      return response.data || [];
    } catch (error) {
      console.error('Error getting TripAdvisor photos:', error);
      return [];
    }
  },

  /**
   * Search for tours and activities
   */
  async searchTours(
    locationId: string,
    limit: number = 10,
    options: { signal?: AbortSignal } = {}
  ): Promise<any[]> {
    if (!apiKey) {
      console.warn('TripAdvisor API key missing. Cannot fetch tours.');
      return [];
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        language: 'en',
        limit: limit.toString(),
      });

      const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/attractions?${params}`;
      
      const response = await makeTripadvisorRequest<{ data: any[] }>(url, {
        signal: options.signal,
        cacheKey: `tours_${locationId}_${limit}`,
        cacheParams: { locationId, limit }
      });

      return response.data || [];
    } catch (error) {
      console.error('Error searching TripAdvisor tours:', error);
      return [];
    }
  }
};

// Mock data functions for development and testing
function getMockLocations(query: string, category?: string): TripAdvisorLocation[] {
  console.log('Using mock TripAdvisor data for', query, category ? `with category ${category}` : '');
  
  // Get the current mock city based on the query
  const mockCity = getCurrentMockCity(query.toLowerCase());
  
  if (mockCity === 'new york') {
    return [
      {
        location_id: 'mock-nyc-attraction-1',
        name: 'Empire State Building',
        description: 'Iconic skyscraper in Midtown Manhattan with observation decks offering panoramic city views.',
        web_url: 'https://www.tripadvisor.com/empire-state-building',
        address_obj: {
          street1: '20 W 34th St',
          city: 'New York',
          state: 'NY',
          country: 'United States',
          postalcode: '10001',
          address_string: '20 W 34th St, New York, NY 10001'
        },
        latitude: 40.7484,
        longitude: -73.9857,
        rating: 4.7,
        num_reviews: 95000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'landmark',
            name: 'Landmarks'
          }
        ]
      },
      {
        location_id: 'mock-nyc-attraction-2',
        name: 'Statue of Liberty',
        description: 'Iconic copper statue on Liberty Island in New York Harbor, a symbol of freedom and democracy.',
        web_url: 'https://www.tripadvisor.com/statue-of-liberty',
        address_obj: {
          city: 'New York',
          state: 'NY',
          country: 'United States',
          postalcode: '10004',
          address_string: 'Liberty Island, New York, NY 10004'
        },
        latitude: 40.6892,
        longitude: -74.0445,
        rating: 4.7,
        num_reviews: 87000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'landmark',
            name: 'Landmarks'
          }
        ]
      },
      {
        location_id: 'mock-nyc-attraction-3',
        name: 'Central Park',
        description: 'Sprawling urban park in Manhattan offering walking paths, lakes, outdoor activities, and cultural attractions.',
        web_url: 'https://www.tripadvisor.com/central-park',
        address_obj: {
          city: 'New York',
          state: 'NY',
          country: 'United States',
          address_string: 'Central Park, New York, NY'
        },
        latitude: 40.7812,
        longitude: -73.9665,
        rating: 4.8,
        num_reviews: 133000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1534804464090-8fa7e82cce5b?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1534804464090-8fa7e82cce5b?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1534804464090-8fa7e82cce5b?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1534804464090-8fa7e82cce5b?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1534804464090-8fa7e82cce5b?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'park',
            name: 'Parks'
          }
        ]
      }
    ];
  } else if (mockCity === 'london') {
    return [
      {
        location_id: 'mock-london-attraction-1',
        name: 'Tower of London',
        description: 'Historic castle on the north bank of the River Thames, a UNESCO World Heritage Site with the Crown Jewels.',
        web_url: 'https://www.tripadvisor.com/tower-of-london',
        address_obj: {
          city: 'London',
          country: 'United Kingdom',
          postalcode: 'EC3N 4AB',
          address_string: 'Tower Hill, London EC3N 4AB, United Kingdom'
        },
        latitude: 51.5081,
        longitude: -0.0759,
        rating: 4.6,
        num_reviews: 65000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1590498418623-fb21bf969a02?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1590498418623-fb21bf969a02?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1590498418623-fb21bf969a02?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1590498418623-fb21bf969a02?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1590498418623-fb21bf969a02?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'castle',
            name: 'Castles'
          }
        ]
      },
      {
        location_id: 'mock-london-attraction-2',
        name: 'British Museum',
        description: 'World-renowned museum of art and antiquities from ancient and living cultures, spanning two million years of human history.',
        web_url: 'https://www.tripadvisor.com/british-museum',
        address_obj: {
          street1: 'Great Russell Street',
          city: 'London',
          country: 'United Kingdom',
          postalcode: 'WC1B 3DG',
          address_string: 'Great Russell St, London WC1B 3DG, United Kingdom'
        },
        latitude: 51.5194,
        longitude: -0.1269,
        rating: 4.7,
        num_reviews: 72000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1574322454798-e525e93a9e63?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1574322454798-e525e93a9e63?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1574322454798-e525e93a9e63?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1574322454798-e525e93a9e63?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1574322454798-e525e93a9e63?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'museum',
            name: 'Museums'
          }
        ]
      },
      {
        location_id: 'mock-london-attraction-3',
        name: 'Buckingham Palace',
        description: 'The London residence and administrative headquarters of the monarch of the United Kingdom.',
        web_url: 'https://www.tripadvisor.com/buckingham-palace',
        address_obj: {
          city: 'London',
          country: 'United Kingdom',
          postalcode: 'SW1A 1AA',
          address_string: 'London SW1A 1AA, United Kingdom'
        },
        latitude: 51.5014,
        longitude: -0.1419,
        rating: 4.5,
        num_reviews: 58000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1566982100165-11b8a0b9f173?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1566982100165-11b8a0b9f173?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1566982100165-11b8a0b9f173?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1566982100165-11b8a0b9f173?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1566982100165-11b8a0b9f173?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'palace',
            name: 'Palaces'
          }
        ]
      }
    ];
  } else if (mockCity === 'tokyo') {
    return [
      {
        location_id: 'mock-tokyo-attraction-1',
        name: 'Tokyo Skytree',
        description: 'Tall broadcasting and observation tower offering panoramic views of Tokyo from its viewing platforms.',
        web_url: 'https://www.tripadvisor.com/tokyo-skytree',
        address_obj: {
          street1: '1-1-2 Oshiage',
          city: 'Tokyo',
          country: 'Japan',
          postalcode: '131-0045',
          address_string: '1-1-2 Oshiage, Sumida City, Tokyo 131-0045, Japan'
        },
        latitude: 35.7101,
        longitude: 139.8107,
        rating: 4.5,
        num_reviews: 13000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'landmark',
            name: 'Landmarks'
          }
        ]
      },
      {
        location_id: 'mock-tokyo-attraction-2',
        name: 'Senso-ji Temple',
        description: 'Ancient Buddhist temple in Asakusa, Tokyo\'s oldest temple and one of its most significant.',
        web_url: 'https://www.tripadvisor.com/sensoji-temple',
        address_obj: {
          street1: '2-3-1 Asakusa',
          city: 'Tokyo',
          country: 'Japan',
          postalcode: '111-0032',
          address_string: '2-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan'
        },
        latitude: 35.7147,
        longitude: 139.7966,
        rating: 4.7,
        num_reviews: 13500,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'temple',
            name: 'Sacred & Religious Sites'
          }
        ]
      },
      {
        location_id: 'mock-tokyo-attraction-3',
        name: 'Meiji Shrine',
        description: 'Shinto shrine dedicated to Emperor Meiji and Empress Shoken, set in a peaceful forest in central Tokyo.',
        web_url: 'https://www.tripadvisor.com/meiji-shrine',
        address_obj: {
          street1: '1-1 Yoyogikamizonocho',
          city: 'Tokyo',
          country: 'Japan',
          postalcode: '151-8557',
          address_string: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557, Japan'
        },
        latitude: 35.6763,
        longitude: 139.6993,
        rating: 4.6,
        num_reviews: 13300,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1583053693270-c6d380d87035?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1583053693270-c6d380d87035?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1583053693270-c6d380d87035?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1583053693270-c6d380d87035?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1583053693270-c6d380d87035?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'shrine',
            name: 'Sacred & Religious Sites'
          }
        ]
      }
    ];
  } else {
    // Default to Paris
    return [
      {
        location_id: 'mock-attraction-1',
        name: 'Eiffel Tower',
        description: 'Iconic iron lattice tower on the Champ de Mars in Paris, France.',
        web_url: 'https://www.tripadvisor.com/eiffel-tower',
        address_obj: {
          street1: 'Champ de Mars',
          city: 'Paris',
          country: 'France',
          postalcode: '75007',
          address_string: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France'
        },
        latitude: 48.8584,
        longitude: 2.2945,
        rating: 4.5,
        num_reviews: 140000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'landmark',
            name: 'Landmarks'
          }
        ]
      },
      {
        location_id: 'mock-attraction-2',
        name: 'Louvre Museum',
        description: 'World\'s largest art museum and a historic monument in Paris, France.',
        web_url: 'https://www.tripadvisor.com/louvre-museum',
        address_obj: {
          street1: 'Rue de Rivoli',
          city: 'Paris',
          country: 'France',
          postalcode: '75001',
          address_string: 'Rue de Rivoli, 75001 Paris, France'
        },
        latitude: 48.8606,
        longitude: 2.3376,
        rating: 4.7,
        num_reviews: 100000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'museum',
            name: 'Museums'
          }
        ]
      },
      {
        location_id: 'mock-attraction-3',
        name: 'Seine River Cruise',
        description: 'Scenic boat tour along the Seine River with views of Paris landmarks.',
        web_url: 'https://www.tripadvisor.com/seine-river-cruise',
        address_obj: {
          street1: 'Port de la Conférence',
          city: 'Paris',
          country: 'France',
          postalcode: '75008',
          address_string: 'Port de la Conférence, 75008 Paris, France'
        },
        latitude: 48.8652,
        longitude: 2.3101,
        rating: 4.6,
        num_reviews: 50000,
        photo: {
          images: {
            small: { url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80' },
            thumbnail: { url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=150&q=80' },
            original: { url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80' },
            large: { url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80' },
            medium: { url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80' }
          }
        },
        category: {
          key: 'attraction',
          name: 'Attraction'
        },
        subcategory: [
          {
            key: 'tour',
            name: 'Tours'
          }
        ]
      }
    ];
  }
}

// Helper function to determine which city to use for mock data
function getCurrentMockCity(query: string): string {
  if (query.includes('new york')) {
    return 'new york';
  } else if (query.includes('london')) {
    return 'london';
  } else if (query.includes('tokyo')) {
    return 'tokyo';
  } else if (query.includes('paris')) {
    return 'paris';
  } else {
    // Try to extract a city name from the query
    const possibleCities = ['new york', 'london', 'tokyo', 'paris'];
    for (const city of possibleCities) {
      if (query.includes(city)) {
        return city;
      }
    }
    return 'paris'; // Default
  }
}

function getMockLocationDetails(locationId: string): TripAdvisorLocation {
  console.log('Using mock TripAdvisor location details for', locationId);
  
  // Return details based on the mock location ID
  const mockLocations = getMockLocations('paris');
  const location = mockLocations.find(loc => loc.location_id === locationId);
  
  if (location) {
    return {
      ...location,
      // Add any additional details that would come from the details endpoint
      hours: {
        weekday_text: [
          'Monday: 9:00 AM - 6:00 PM',
          'Tuesday: 9:00 AM - 6:00 PM',
          'Wednesday: 9:00 AM - 6:00 PM',
          'Thursday: 9:00 AM - 6:00 PM',
          'Friday: 9:00 AM - 6:00 PM',
          'Saturday: 9:00 AM - 6:00 PM',
          'Sunday: 9:00 AM - 6:00 PM'
        ]
      },
      ranking: '#1 of 1,234 things to do in Paris',
      ranking_position: 1
    };
  }
  
  // Default mock location if ID not found
  return mockLocations[0] || {
    location_id: 'mock-default',
    name: 'Default Attraction',
    web_url: 'https://www.tripadvisor.com',
    latitude: 48.8566,
    longitude: 2.3522
  };
} 