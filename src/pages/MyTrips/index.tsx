import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Trash2, Calendar, MapPin, ArrowRight, PlusCircle, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/dateUtils';
import { useItinerary } from '../../contexts/ItineraryContext';
import TravelPlannerErrorBoundary from '../../components/TravelPlanner/TravelPlannerErrorBoundary';

// Define the saved itinerary structure
interface SavedItinerary {
  id: string;
  title: string;
  destination?: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  days: Array<{
    dayNumber: number;
    date: string;
    activities: Array<{
      id: string;
      title: string;
      description: string;
      location: string;
      time: string;
      type?: string;
    }>
  }>;
}

const MyTripsPageContent: React.FC = () => {
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getUserItineraries, deleteItinerary } = useItinerary();

  useEffect(() => {
    loadSavedItineraries();
  }, []);

  const loadSavedItineraries = async () => {
    setIsLoading(true);
    try {
      const itineraries = await getUserItineraries();
      setSavedItineraries(itineraries);
    } catch (error) {
      console.error('Error loading saved itineraries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItinerary = async (id: string) => {
    try {
      await deleteItinerary(id);
      // Reload the itineraries to reflect the deletion
      await loadSavedItineraries();
    } catch (error) {
      console.error('Error deleting itinerary:', error);
    }
  };

  const navigateToItinerary = (id: string) => {
    navigate(`/app?load=${id}`);
  };

  // Calculate some stats for the itinerary card
  const getItineraryStats = (itinerary: SavedItinerary) => {
    const totalActivities = itinerary.days.reduce(
      (total, day) => total + day.activities.length, 0
    );
    
    const destinations = new Set<string>();
    itinerary.days.forEach(day => {
      day.activities.forEach(activity => {
        if (activity.location) {
          // Try to extract city from the location
          const parts = activity.location.split(',');
          if (parts.length > 1) {
            destinations.add(parts[1].trim());
          } else {
            destinations.add(activity.location);
          }
        }
      });
    });
    
    return {
      totalActivities,
      uniqueDestinations: Array.from(destinations),
    };
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link 
              to="/app" 
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center mb-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Planner
            </Link>
            <h1 className="text-3xl font-bold">My Trips</h1>
            <p className="text-slate-500">View and manage your saved itineraries</p>
          </div>
          <Button 
            onClick={() => navigate('/app')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Create New Trip
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-pulse">Loading saved trips...</div>
        </div>
      ) : savedItineraries.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <h2 className="text-xl font-medium mb-2">No saved trips yet</h2>
          <p className="text-slate-500 mb-6">When you save an itinerary, it will appear here</p>
          <Button onClick={() => navigate('/app')}>
            Create Your First Itinerary
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedItineraries.map((itinerary) => {
            const stats = getItineraryStats(itinerary);
            const dateRangeText = `${formatDate(itinerary.startDate, 'MM/DD')} - ${formatDate(itinerary.endDate, 'MM/DD')}`;
            const daysCount = itinerary.days.length;
            
            return (
              <Card 
                key={itinerary.id} 
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-1 text-xl">{itinerary.title}</CardTitle>
                  <CardDescription className="flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                    {dateRangeText} ({daysCount} days)
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-4">
                  {stats.uniqueDestinations.length > 0 && (
                    <div className="flex items-start mb-3">
                      <MapPin className="h-4 w-4 mr-1.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-600 line-clamp-2">
                        {stats.uniqueDestinations.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm text-slate-500">
                    {stats.totalActivities} activities planned
                  </div>
                  
                  <div className="text-xs text-slate-400 mt-1">
                    Saved on {format(new Date(itinerary.createdAt), 'MMM d, yyyy')}
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0 flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => handleDeleteItinerary(itinerary.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => navigateToItinerary(itinerary.id)}
                  >
                    View
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Wrap with providers for proper context
const MyTripsPage: React.FC = () => {
  return (
    <TravelPlannerErrorBoundary>
      <MyTripsPageContent />
    </TravelPlannerErrorBoundary>
  );
};

export default MyTripsPage; 