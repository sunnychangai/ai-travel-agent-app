import React, { useState, useEffect } from 'react';
import { PlaceResult, googleMapsService } from '../../services/googleMapsService';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Star, MapPin, Clock, DollarSign, Globe, Phone, X, Image } from 'lucide-react';

interface PlaceDetailsProps {
  place: PlaceResult;
  onClose: () => void;
  onAddToItinerary?: (place: PlaceResult) => void;
}

export const PlaceDetails: React.FC<PlaceDetailsProps> = ({
  place,
  onClose,
  onAddToItinerary
}) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const placeDetails = await googleMapsService.getPlaceDetails(place.place_id);
        setDetails(placeDetails);
      } catch (error) {
        console.error('Error fetching place details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [place.place_id]);

  // Generate price level string
  const getPriceLevel = (level?: number) => {
    if (level === undefined) return 'Price not available';
    return Array(level).fill('$').join('');
  };

  // Get photo URLs
  const getPhotoUrls = () => {
    if (details?.photos && details.photos.length > 0) {
      return details.photos.slice(0, 5).map((photo: any) => 
        googleMapsService.getPhotoUrl(photo.photo_reference, 800)
      );
    }
    if (place.photos && place.photos.length > 0) {
      return [googleMapsService.getPhotoUrl(place.photos[0].photo_reference, 800)];
    }
    return [`https://source.unsplash.com/random/800x400/?${encodeURIComponent(place.name.split(' ')[0])},landmark`];
  };

  // Handle image loading error
  const handleImageError = (index: number) => {
    console.log('Image failed to load for:', place.name, 'index:', index);
    setImageErrors(prev => ({
      ...prev,
      [index]: true
    }));
  };

  // Get fallback image URL
  const getFallbackImageUrl = (index: number) => {
    return `https://source.unsplash.com/random/800x400/?${encodeURIComponent(place.name.split(' ')[0])},landmark&sig=${index}`;
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{place.name}</DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <>
            {/* Photo gallery */}
            <div className="mb-6">
              <div className="h-64 overflow-hidden rounded-lg bg-gray-100 relative">
                <img 
                  src={imageErrors[0] ? getFallbackImageUrl(0) : getPhotoUrls()[0]} 
                  alt={place.name} 
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(0)}
                />
                {imageErrors[0] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-50">
                    <div className="text-center">
                      <Image className="h-12 w-12 mx-auto text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
              {getPhotoUrls().length > 1 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {getPhotoUrls().slice(1).map((url: string, index: number) => {
                    const realIndex = index + 1;
                    return (
                      <div key={index} className="h-20 overflow-hidden rounded-lg bg-gray-100 relative">
                        <img 
                          src={imageErrors[realIndex] ? getFallbackImageUrl(realIndex) : url} 
                          alt={`${place.name} ${realIndex}`} 
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(realIndex)}
                        />
                        {imageErrors[realIndex] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-50">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Basic info */}
            <div className="mb-6">
              <div className="flex items-center text-gray-600 mb-2">
                <MapPin size={18} className="mr-2" />
                <span>{details?.formatted_address || place.vicinity || place.formatted_address}</span>
              </div>

              {(place.rating !== undefined || details?.rating) && (
                <div className="flex items-center mb-2">
                  <Star size={18} className="text-yellow-500 mr-2" />
                  <span className="font-medium">{(details?.rating || place.rating).toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">
                    ({details?.user_ratings_total || place.user_ratings_total || 0} reviews)
                  </span>
                </div>
              )}

              {(details?.opening_hours || place.opening_hours) && (
                <div className="flex items-center mb-2">
                  <Clock size={18} className="mr-2" />
                  <span>
                    {details?.opening_hours?.open_now || place.opening_hours?.open_now 
                      ? 'Open now' 
                      : 'Closed'}
                  </span>
                </div>
              )}

              {(details?.price_level !== undefined || place.price_level !== undefined) && (
                <div className="flex items-center mb-2">
                  <DollarSign size={18} className="mr-2" />
                  <span>{getPriceLevel(details?.price_level || place.price_level)}</span>
                </div>
              )}

              {details?.website && (
                <div className="flex items-center mb-2">
                  <Globe size={18} className="mr-2" />
                  <a 
                    href={details.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {details.website}
                  </a>
                </div>
              )}

              {details?.formatted_phone_number && (
                <div className="flex items-center">
                  <Phone size={18} className="mr-2" />
                  <span>{details.formatted_phone_number}</span>
                </div>
              )}
            </div>

            {/* Reviews */}
            {details?.reviews && details.reviews.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3">Reviews</h3>
                <div className="space-y-4">
                  {details.reviews.slice(0, 3).map((review: any, index: number) => (
                    <div key={index} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-center mb-2">
                        <img 
                          src={review.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.author_name)}`} 
                          alt={review.author_name}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                        <div>
                          <div className="font-medium">{review.author_name}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(review.time * 1000).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            size={16} 
                            className={i < review.rating ? "text-yellow-500" : "text-gray-300"} 
                          />
                        ))}
                      </div>
                      <p className="text-sm text-gray-700">{review.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {onAddToItinerary && (
            <Button onClick={() => onAddToItinerary(place)}>
              Add to Itinerary
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 