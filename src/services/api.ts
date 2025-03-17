import { createClient } from '@supabase/supabase-js';
import { Activity, ItineraryDay, SuggestionItem } from '../types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Only initialize if environment variables are available
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * API service for handling backend interactions
 */
export const apiService = {
  /**
   * Get travel suggestions based on location and preferences
   */
  async getSuggestions(
    location: string, 
    preferences: string[], 
    duration: number
  ): Promise<SuggestionItem[]> {
    try {
      if (!supabase) {
        console.warn('Supabase client not initialized. Using mock data.');
        return getMockSuggestions(location);
      }

      // In a real app, this would call the Supabase API
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .eq('location', location)
        .limit(10);

      if (error) throw error;
      
      return data as SuggestionItem[];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Fallback to mock data in case of error
      return getMockSuggestions(location);
    }
  },

  /**
   * Save an itinerary to the database
   */
  async saveItinerary(
    userId: string, 
    itineraryName: string, 
    days: ItineraryDay[]
  ): Promise<{ id: string }> {
    try {
      if (!supabase) {
        console.warn('Supabase client not initialized. Using mock response.');
        return { id: 'mock-itinerary-id' };
      }

      // In a real app, this would save to Supabase
      const { data, error } = await supabase
        .from('itineraries')
        .insert({
          user_id: userId,
          name: itineraryName,
          days: days,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      
      return { id: data.id };
    } catch (error) {
      console.error('Error saving itinerary:', error);
      throw error;
    }
  },

  /**
   * Load an itinerary from the database
   */
  async loadItinerary(itineraryId: string): Promise<ItineraryDay[]> {
    try {
      if (!supabase) {
        console.warn('Supabase client not initialized. Using mock data.');
        return getMockItinerary();
      }

      // In a real app, this would load from Supabase
      const { data, error } = await supabase
        .from('itineraries')
        .select('days')
        .eq('id', itineraryId)
        .single();

      if (error) throw error;
      
      return data.days as ItineraryDay[];
    } catch (error) {
      console.error('Error loading itinerary:', error);
      // Fallback to mock data in case of error
      return getMockItinerary();
    }
  }
};

/**
 * Generate mock suggestions for a location
 */
function getMockSuggestions(location: string): SuggestionItem[] {
  // Generate a deterministic but random-looking ID based on the string
  const generateId = (str: string, index: number) => {
    return `${str.replace(/\s+/g, '-').toLowerCase()}-${index}`;
  };

  // Default suggestions for any location
  const suggestions: SuggestionItem[] = [
    {
      id: generateId(location, 1),
      title: `Visit the ${location} Museum of Art`,
      description: `Explore the rich cultural heritage of ${location} through its extensive art collection spanning centuries.`,
      location: `${location} Museum of Art, Downtown ${location}`,
      duration: '2 hours',
      category: 'Culture',
      rating: 4.7,
      imageUrl: 'https://images.unsplash.com/photo-1503632235391-aba5a4cdbf23?w=600&q=80'
    },
    {
      id: generateId(location, 2),
      title: `${location} Historical Walking Tour`,
      description: `Discover the fascinating history of ${location} with a guided walking tour through its most historic neighborhoods.`,
      location: `${location} Visitor Center`,
      duration: '3 hours',
      category: 'Tour',
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=600&q=80'
    },
    {
      id: generateId(location, 3),
      title: `Dinner at ${location} Grill`,
      description: `Enjoy a delicious meal at one of ${location}'s most popular restaurants, featuring local specialties and international cuisine.`,
      location: `${location} Grill, 123 Main St, ${location}`,
      duration: '1.5 hours',
      category: 'Food',
      rating: 4.5,
      price: '$$$',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80'
    },
    {
      id: generateId(location, 4),
      title: `${location} Botanical Gardens`,
      description: `Stroll through the beautiful botanical gardens featuring native plants and exotic species from around the world.`,
      location: `${location} Botanical Gardens, Park District`,
      duration: '2 hours',
      category: 'Nature',
      rating: 4.6,
      imageUrl: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&q=80'
    },
    {
      id: generateId(location, 5),
      title: `Shopping at ${location} Market`,
      description: `Browse local crafts, souvenirs, and specialty foods at the famous ${location} Market.`,
      location: `${location} Market, Central District`,
      duration: '2 hours',
      category: 'Shopping',
      rating: 4.4,
      imageUrl: 'https://images.unsplash.com/photo-1513125370-3460ebe3401b?w=600&q=80'
    }
  ];
  
  return suggestions;
}

/**
 * Generate a mock itinerary for testing
 */
function getMockItinerary(): ItineraryDay[] {
  return [
    {
      date: '2023-06-15',
      dayNumber: 1,
      activities: [
        {
          id: '1',
          title: 'Visit Eiffel Tower',
          description: 'Enjoy the iconic landmark of Paris with breathtaking views of the city.',
          location: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
          time: '10:00 AM - 12:00 PM',
          imageUrl: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=600&q=80',
        },
        {
          id: '2',
          title: 'Lunch at Le Jules Verne',
          description: 'Fine dining experience with panoramic views of Paris.',
          location: 'Eiffel Tower, 2nd floor, Avenue Gustave Eiffel, 75007 Paris, France',
          time: '12:30 PM - 2:30 PM',
          imageUrl: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=600&q=80',
        },
      ],
    },
    {
      date: '2023-06-16',
      dayNumber: 2,
      activities: [
        {
          id: '3',
          title: 'Louvre Museum Tour',
          description: 'Explore one of the world\'s largest art museums and see the Mona Lisa.',
          location: 'Rue de Rivoli, 75001 Paris, France',
          time: '9:00 AM - 1:00 PM',
          imageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80',
        },
        {
          id: '4',
          title: 'Seine River Cruise',
          description: 'Relaxing boat tour along the Seine River to see Paris from a different perspective.',
          location: 'Port de la Conférence, Pont de l\'Alma, 75008 Paris, France',
          time: '3:00 PM - 5:00 PM',
          imageUrl: 'https://images.unsplash.com/photo-1541410965313-d53b3c16ef17?w=600&q=80',
        },
      ],
    },
  ];
} 