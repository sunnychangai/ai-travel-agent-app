import React, { useState, useEffect } from 'react';
import { PlaceResult, googleMapsService } from '../../services/googleMapsService';
import { PlacesList } from './PlacesList';
import { PlaceDetails } from './PlaceDetails';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Utensils, Landmark, AlertCircle } from 'lucide-react';
import { LocationSearchInput } from './LocationSearchInput';
import { Alert, AlertDescription } from '../ui/alert';

interface PlacesExplorerProps {
  destination?: string;
  onAddToItinerary?: (place: PlaceResult) => void;
}

export const PlacesExplorer: React.FC<PlacesExplorerProps> = ({
  destination = '',
  onAddToItinerary
}) => {
  const [searchQuery, setSearchQuery] = useState(destination);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [restaurants, setRestaurants] = useState<PlaceResult[]>([]);
  const [attractions, setAttractions] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [activeTab, setActiveTab] = useState('restaurants');
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Update searchQuery when destination prop changes
  useEffect(() => {
    if (destination && destination !== searchQuery) {
      console.log("Destination updated in PlacesExplorer:", destination);
      setSearchQuery(destination);
      geocodeDestination(destination);
    }
  }, [destination]);

  // Search for places when location changes
  useEffect(() => {
    if (location) {
      searchPlaces();
    }
  }, [location, activeTab, cuisineFilter]);

  // Geocode the destination to get coordinates
  const geocodeDestination = async (address: string) => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log("Geocoding address:", address);
      const coords = await googleMapsService.geocodeAddress(address);
      console.log("Geocoded coordinates:", coords);
      setLocation(coords);
    } catch (error) {
      console.error('Error geocoding address:', error);
      setError('Could not find coordinates for this location. Please try a different search term.');
      setIsLoading(false);
    }
  };

  // Handle location selection from the LocationSearchInput
  const handleLocationSelected = (coords: { lat: number; lng: number }, address: string) => {
    console.log("Location selected:", address, coords);
    setSearchQuery(address);
    setLocation(coords);
    setError(null);
  };

  // Search for places based on the active tab
  const searchPlaces = async () => {
    if (!location) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'restaurants') {
        console.log("Searching for restaurants near:", location);
        const results = await googleMapsService.searchNearbyRestaurants(
          location,
          1500,
          cuisineFilter || undefined
        );
        console.log("Found restaurants:", results.length);
        setRestaurants(results);
        
        if (results.length === 0) {
          setError(`No restaurants found${cuisineFilter ? ` matching "${cuisineFilter}"` : ''}. Try adjusting your search.`);
        }
      } else if (activeTab === 'attractions') {
        console.log("Searching for attractions near:", location);
        const results = await googleMapsService.searchNearbyAttractions(
          location,
          2000
        );
        console.log("Found attractions:", results.length);
        setAttractions(results);
        
        if (results.length === 0) {
          setError('No attractions found. Try searching for a different location.');
        }
      }
    } catch (error) {
      console.error('Error searching places:', error);
      setError('Error searching for places. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a place
  const handleSelectPlace = (place: PlaceResult) => {
    setSelectedPlace(place);
  };

  // Handle adding a place to the itinerary
  const handleAddToItinerary = (place: PlaceResult) => {
    if (onAddToItinerary) {
      onAddToItinerary(place);
    }
    setSelectedPlace(null);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <LocationSearchInput
          initialValue={searchQuery}
          onLocationSelected={handleLocationSelected}
          placeholder="Enter a city, address, or landmark"
          disabled={isLoading}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="restaurants" className="flex-1">
            <Utensils size={18} className="mr-2" />
            Restaurants
          </TabsTrigger>
          <TabsTrigger value="attractions" className="flex-1">
            <Landmark size={18} className="mr-2" />
            Attractions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restaurants" className="w-full">
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Filter by cuisine (e.g., Italian, Sushi)"
              value={cuisineFilter}
              onChange={(e) => setCuisineFilter(e.target.value)}
              className="w-full"
            />
          </div>
          <PlacesList
            places={restaurants}
            title={`Restaurants ${cuisineFilter ? `- ${cuisineFilter}` : ''}`}
            isLoading={isLoading}
            onSelectPlace={handleSelectPlace}
          />
        </TabsContent>

        <TabsContent value="attractions" className="w-full">
          <PlacesList
            places={attractions}
            title="Attractions & Points of Interest"
            isLoading={isLoading}
            onSelectPlace={handleSelectPlace}
          />
        </TabsContent>
      </Tabs>

      {selectedPlace && (
        <PlaceDetails
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onAddToItinerary={handleAddToItinerary}
        />
      )}
    </div>
  );
}; 