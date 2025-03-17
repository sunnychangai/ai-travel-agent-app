import React, { useState } from 'react';
import { TripAdvisorLocation } from '../../services/tripAdvisorService';
import { Star, MapPin, Globe, ExternalLink, Image } from 'lucide-react';
import { Badge } from '../ui/badge';

interface TripAdvisorCardProps {
  location: TripAdvisorLocation;
  onSelect?: (location: TripAdvisorLocation) => void;
}

export const TripAdvisorCard: React.FC<TripAdvisorCardProps> = ({ 
  location, 
  onSelect 
}) => {
  const [imageError, setImageError] = useState(false);

  // Get photo URL or use a placeholder
  const getPhotoUrl = () => {
    if (imageError || !location.photo || !location.photo.images) {
      return `https://source.unsplash.com/random/400x300/?${encodeURIComponent(location.name.split(' ')[0])},landmark`;
    }
    return location.photo.images.large?.url || 
           location.photo.images.medium?.url || 
           location.photo.images.original?.url;
  };

  // Handle image loading error
  const handleImageError = () => {
    console.log('Image failed to load for:', location.name);
    setImageError(true);
  };

  // Format address
  const getAddress = () => {
    if (location.address_obj && location.address_obj.address_string) {
      return location.address_obj.address_string;
    }
    return 'Address not available';
  };

  return (
    <div 
      className="rounded-lg overflow-hidden shadow-md bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={() => onSelect && onSelect(location)}
    >
      <div className="h-48 overflow-hidden bg-gray-100 relative">
        <img 
          src={getPhotoUrl()} 
          alt={location.name} 
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="text-center">
              <Image className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">{location.name}</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg truncate">{location.name}</h3>
          {location.rating && (
            <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm">
              <Star size={16} className="mr-1 text-green-600" />
              <span>{location.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center text-sm text-gray-600 mb-2">
          <MapPin size={16} className="mr-1 flex-shrink-0" />
          <span className="truncate">{getAddress()}</span>
        </div>
        
        {location.category && (
          <div className="mb-3">
            <Badge variant="outline" className="mr-1">
              {location.category.name}
            </Badge>
            {location.subcategory && location.subcategory.slice(0, 2).map((sub, index) => (
              <Badge key={index} variant="outline" className="mr-1">
                {sub.name}
              </Badge>
            ))}
          </div>
        )}
        
        {location.description && (
          <p className="text-sm text-gray-700 mb-3 line-clamp-2">{location.description}</p>
        )}
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-gray-500">
            {location.num_reviews && `${location.num_reviews} reviews`}
          </div>
          <a 
            href={location.web_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe size={14} className="mr-1" />
            TripAdvisor
            <ExternalLink size={12} className="ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
}; 