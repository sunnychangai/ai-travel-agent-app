import React from 'react';
import { PlaceResult } from '../../services/googleMapsService';
import { PlaceCard } from './PlaceCard';

interface PlacesListProps {
  places: PlaceResult[];
  title: string;
  isLoading?: boolean;
  onSelectPlace?: (place: PlaceResult) => void;
}

export const PlacesList: React.FC<PlacesListProps> = ({
  places,
  title,
  isLoading = false,
  onSelectPlace
}) => {
  return (
    <div className="w-full">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      
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
      ) : places.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {places.map((place) => (
            <PlaceCard 
              key={place.place_id} 
              place={place} 
              onSelect={onSelectPlace}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No places found. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}; 