import React, { useState } from 'react';
import { PlaceResult } from '../../services/googleMapsService';
import { googleMapsService } from '../../services/googleMapsService';
import { Star, MapPin, Clock, DollarSign, Image } from 'lucide-react';

interface PlaceCardProps {
  place: PlaceResult;
  onSelect?: (place: PlaceResult) => void;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, onSelect }) => {
  const [imageError, setImageError] = useState(false);

  // Generate price level string
  const getPriceLevel = (level?: number) => {
    if (level === undefined) return 'Price not available';
    return Array(level).fill('$').join('');
  };

  // Get photo URL or use a placeholder
  const getPhotoUrl = () => {
    if (imageError || (!place.photos || place.photos.length === 0)) {
      return `https://source.unsplash.com/random/400x300/?${encodeURIComponent(place.name.split(' ')[0])},landmark`;
    }
    return googleMapsService.getPhotoUrl(place.photos[0].photo_reference);
  };

  // Handle image loading error
  const handleImageError = () => {
    console.log('Image failed to load for:', place.name);
    setImageError(true);
  };

  return (
    <div 
      className="rounded-lg overflow-hidden shadow-md bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={() => onSelect && onSelect(place)}
    >
      <div className="h-48 overflow-hidden bg-gray-100 relative">
        <img 
          src={getPhotoUrl()} 
          alt={place.name} 
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="text-center">
              <Image className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">{place.name}</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1 truncate">{place.name}</h3>
        
        <div className="flex items-center text-sm text-gray-600 mb-2">
          <MapPin size={16} className="mr-1" />
          <span className="truncate">{place.vicinity || place.formatted_address}</span>
        </div>
        
        {place.rating !== undefined && (
          <div className="flex items-center mb-2">
            <div className="flex items-center mr-2">
              <Star size={16} className="text-yellow-500 mr-1" />
              <span className="font-medium">{place.rating.toFixed(1)}</span>
            </div>
            {place.user_ratings_total !== undefined && (
              <span className="text-sm text-gray-500">
                ({place.user_ratings_total} reviews)
              </span>
            )}
          </div>
        )}
        
        {place.opening_hours && (
          <div className="flex items-center text-sm mb-2">
            <Clock size={16} className="mr-1" />
            <span>{place.opening_hours.isOpen ? 'Open now' : 'Closed'}</span>
          </div>
        )}
        
        {place.price_level !== undefined && (
          <div className="flex items-center text-sm">
            <DollarSign size={16} className="mr-1" />
            <span>{getPriceLevel(place.price_level)}</span>
          </div>
        )}
      </div>
    </div>
  );
}; 