import React, { useState, useEffect } from 'react';
import { TripAdvisorLocation, tripAdvisorService } from '../../services/tripAdvisorService';
import { TripAdvisorList } from './TripAdvisorList';
import { TripAdvisorDetails } from './TripAdvisorDetails';
import { LocationSearchInput } from '../maps/LocationSearchInput';
import { googleMapsService } from '../../services/googleMapsService';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle } from 'lucide-react';

interface TripAdvisorExplorerProps {
  destination?: string;
  onAddToItinerary?: (location: TripAdvisorLocation) => void;
}

export const TripAdvisorExplorer: React.FC<TripAdvisorExplorerProps> = ({
  destination = '',
  onAddToItinerary
}) => {
  const [searchQuery, setSearchQuery] = useState(destination);
  const [locations, setLocations] = useState<TripAdvisorLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<TripAdvisorLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search for locations when the component mounts or destination changes
  useEffect(() => {
    if (destination && destination !== searchQuery) {
      console.log("Destination updated in TripAdvisorExplorer:", destination);
      setSearchQuery(destination);
      searchLocations(destination);
    }
  }, [destination]);

  // Search for locations
  const searchLocations = async (query: string) => {
    if (!query) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log("Searching TripAdvisor locations for:", query);
      const results = await tripAdvisorService.searchLocations(query, 'attractions');
      console.log("Found TripAdvisor locations:", results.length);
      setLocations(results);
      
      if (results.length === 0) {
        setError(`No attractions found for "${query}". Try a different search term.`);
      }
    } catch (error) {
      console.error('Error searching TripAdvisor locations:', error);
      setError('Error searching for attractions. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle location selection from the LocationSearchInput
  const handleLocationSelected = (coords: { lat: number; lng: number }, address: string) => {
    console.log("Location selected:", address, coords);
    setSearchQuery(address);
    setError(null);
    searchLocations(address);
  };

  // Handle selecting a location
  const handleSelectLocation = (location: TripAdvisorLocation) => {
    setSelectedLocation(location);
  };

  // Handle adding a location to the itinerary
  const handleAddToItinerary = (location: TripAdvisorLocation) => {
    if (onAddToItinerary) {
      onAddToItinerary(location);
    }
    setSelectedLocation(null);
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

      <TripAdvisorList
        locations={locations}
        title="Attractions & Tours"
        isLoading={isLoading}
        onSelectLocation={handleSelectLocation}
      />

      {selectedLocation && (
        <TripAdvisorDetails
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onAddToItinerary={handleAddToItinerary}
        />
      )}
    </div>
  );
}; 