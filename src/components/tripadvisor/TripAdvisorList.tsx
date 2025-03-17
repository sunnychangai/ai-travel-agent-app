import React from 'react';
import { TripAdvisorLocation } from '../../services/tripAdvisorService';
import { TripAdvisorCard } from './TripAdvisorCard';

interface TripAdvisorListProps {
  locations: TripAdvisorLocation[];
  title: string;
  isLoading?: boolean;
  onSelectLocation?: (location: TripAdvisorLocation) => void;
}

export const TripAdvisorList: React.FC<TripAdvisorListProps> = ({
  locations,
  title,
  isLoading = false,
  onSelectLocation
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="ml-2 flex items-center">
          <img 
            src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" 
            alt="TripAdvisor" 
            className="h-6"
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg overflow-hidden shadow-md bg-white animate-pulse">
              <div className="h-48 bg-gray-300"></div>
              <div className="p-4">
                <div className="h-6 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : locations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <TripAdvisorCard 
              key={location.location_id} 
              location={location} 
              onSelect={onSelectLocation}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No locations found. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}; 