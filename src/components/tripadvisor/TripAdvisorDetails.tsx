import React, { useState, useEffect } from 'react';
import { TripAdvisorLocation, TripAdvisorReview, tripAdvisorService } from '../../services/tripAdvisorService';
import { Star, MapPin, Globe, X, ExternalLink, Calendar, User, ThumbsUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

interface TripAdvisorDetailsProps {
  location: TripAdvisorLocation;
  onClose: () => void;
  onAddToItinerary?: (location: TripAdvisorLocation) => void;
}

export const TripAdvisorDetails: React.FC<TripAdvisorDetailsProps> = ({
  location,
  onClose,
  onAddToItinerary
}) => {
  const [details, setDetails] = useState<TripAdvisorLocation | null>(null);
  const [reviews, setReviews] = useState<TripAdvisorReview[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch location details
        const locationDetails = await tripAdvisorService.getLocationDetails(location.location_id);
        setDetails(locationDetails);
        
        // Fetch reviews
        const locationReviews = await tripAdvisorService.getLocationReviews(location.location_id);
        setReviews(locationReviews);
        
        // Fetch photos
        const locationPhotos = await tripAdvisorService.getLocationPhotos(location.location_id);
        setPhotos(locationPhotos);
        
        // Fetch tours and activities
        const locationTours = await tripAdvisorService.searchTours(location.location_id);
        setTours(locationTours);
      } catch (error) {
        console.error('Error fetching TripAdvisor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location.location_id]);

  // Get photo URL or use a placeholder
  const getMainPhotoUrl = () => {
    if (photos && photos.length > 0 && photos[0].images) {
      return photos[0].images.large?.url || photos[0].images.original?.url;
    }
    if (location.photo && location.photo.images) {
      return location.photo.images.large?.url || location.photo.images.original?.url;
    }
    return `https://via.placeholder.com/800x400?text=${encodeURIComponent(location.name)}`;
  };

  // Format address
  const getAddress = () => {
    if (details?.address_obj && details.address_obj.address_string) {
      return details.address_obj.address_string;
    }
    if (location.address_obj && location.address_obj.address_string) {
      return location.address_obj.address_string;
    }
    return 'Address not available';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">{location.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-4 pt-2">
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="tours">Tours & Activities</TabsTrigger>
          </TabsList>
          
          <div className="overflow-y-auto flex-1 p-4">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-64 bg-gray-300 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <>
                <TabsContent value="info" className="mt-0">
                  {/* Main photo */}
                  <div className="mb-6">
                    <div className="h-64 overflow-hidden rounded-lg">
                      <img 
                        src={getMainPhotoUrl()} 
                        alt={location.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Basic info */}
                  <div className="mb-6">
                    <div className="flex items-center text-gray-600 mb-3">
                      <MapPin size={18} className="mr-2" />
                      <span>{getAddress()}</span>
                    </div>

                    {(location.rating || details?.rating) && (
                      <div className="flex items-center mb-3">
                        <Star size={18} className="text-yellow-500 mr-2" />
                        <span className="font-medium">{(details?.rating || location.rating).toFixed(1)}</span>
                        <span className="text-gray-500 ml-2">
                          ({details?.num_reviews || location.num_reviews || 0} reviews)
                        </span>
                      </div>
                    )}

                    {(details?.category || location.category) && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-600 mb-1">Categories:</div>
                        <div>
                          <Badge variant="outline" className="mr-1">
                            {details?.category?.name || location.category?.name}
                          </Badge>
                          {(details?.subcategory || location.subcategory)?.map((sub, index) => (
                            <Badge key={index} variant="outline" className="mr-1">
                              {sub.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(details?.description || location.description) && (
                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-1">Description:</div>
                        <p className="text-gray-700">{details?.description || location.description}</p>
                      </div>
                    )}

                    <div className="mb-3">
                      <a 
                        href={details?.web_url || location.web_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <Globe size={16} className="mr-2" />
                        View on TripAdvisor
                        <ExternalLink size={14} className="ml-1" />
                      </a>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reviews" className="mt-0">
                  <h3 className="text-lg font-bold mb-4">Reviews from TripAdvisor</h3>
                  {reviews.length > 0 ? (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b pb-4 last:border-b-0">
                          <div className="flex justify-between mb-2">
                            <div className="font-medium">{review.title}</div>
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  size={16} 
                                  className={i < review.rating ? "text-yellow-500" : "text-gray-300"} 
                                />
                              ))}
                            </div>
                          </div>
                          
                          <p className="text-gray-700 mb-3">{review.text}</p>
                          
                          <div className="flex items-center text-sm text-gray-500 mb-2">
                            <User size={14} className="mr-1" />
                            <span className="mr-3">{review.user.username}</span>
                            {review.user.user_location && (
                              <span className="mr-3">from {review.user.user_location.name}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar size={14} className="mr-1" />
                            <span className="mr-3">
                              {new Date(review.published_date).toLocaleDateString()}
                            </span>
                            {review.trip_type && (
                              <span className="mr-3">Trip type: {review.trip_type}</span>
                            )}
                            {review.helpful_votes > 0 && (
                              <span className="flex items-center">
                                <ThumbsUp size={14} className="mr-1" />
                                {review.helpful_votes} helpful votes
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No reviews available for this location.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="photos" className="mt-0">
                  <h3 className="text-lg font-bold mb-4">Photos from TripAdvisor</h3>
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {photos.map((photo, index) => (
                        <div key={index} className="overflow-hidden rounded-lg h-48">
                          <img 
                            src={photo.images.large?.url || photo.images.original?.url} 
                            alt={photo.caption || `${location.name} photo ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No photos available for this location.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tours" className="mt-0">
                  <h3 className="text-lg font-bold mb-4">Tours & Activities</h3>
                  {tours.length > 0 ? (
                    <div className="space-y-4">
                      {tours.map((tour, index) => (
                        <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex flex-col md:flex-row gap-4">
                            {tour.photo && (
                              <div className="w-full md:w-1/3 h-40 overflow-hidden rounded-lg">
                                <img 
                                  src={tour.photo.images.large?.url || tour.photo.images.original?.url} 
                                  alt={tour.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-bold text-lg mb-2">{tour.name}</h4>
                              {tour.description && (
                                <p className="text-gray-700 mb-3 line-clamp-2">{tour.description}</p>
                              )}
                              {tour.rating && (
                                <div className="flex items-center mb-2">
                                  <div className="flex">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star 
                                        key={i} 
                                        size={16} 
                                        className={i < tour.rating ? "text-yellow-500" : "text-gray-300"} 
                                      />
                                    ))}
                                  </div>
                                  <span className="text-gray-500 ml-2">
                                    ({tour.num_reviews || 0} reviews)
                                  </span>
                                </div>
                              )}
                              {tour.booking_options && tour.booking_options.length > 0 && (
                                <div className="flex items-center justify-between mt-3">
                                  <div>
                                    {tour.booking_options[0].price && (
                                      <div className="font-bold text-lg">
                                        {tour.booking_options[0].price.amount} {tour.booking_options[0].price.currency}
                                      </div>
                                    )}
                                  </div>
                                  <a 
                                    href={tour.booking_options[0].url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                                  >
                                    Book Now
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No tours or activities available for this location.
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        <div className="p-4 border-t flex justify-end">
          <Button variant="outline" className="mr-2" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={() => onAddToItinerary && onAddToItinerary(location)}
            disabled={loading}
          >
            Add to Itinerary
          </Button>
        </div>
      </div>
    </div>
  );
}; 