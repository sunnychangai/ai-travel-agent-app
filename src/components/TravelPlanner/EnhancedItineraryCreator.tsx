import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Globe, Users, DollarSign, Utensils, Map } from 'lucide-react';
import { useAgentItinerary } from '../../hooks/useAgentItinerary';
import ItineraryProgress from './ItineraryProgress';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import UserPreferencesService from '../../services/userPreferencesService';

interface EnhancedItineraryCreatorProps {
  initialDestination?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  onCreationComplete?: () => void;
}

export interface UserPreferences {
  travelStyle: string;
  interests: Array<{id: string; label: string}>;
  travelGroup: string;
  budget: string;
  transportMode: string;
  dietaryPreferences: Array<{id: string; label: string}>;
  pace: 'slow' | 'moderate' | 'fast';
  lastUpdated: number;
}

const TRAVEL_STYLES = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'active', label: 'Active' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'budget', label: 'Budget' },
  { id: 'family', label: 'Family-friendly' },
];

const INTERESTS = [
  { id: 'history', label: 'History' },
  { id: 'art', label: 'Art & Museums' },
  { id: 'food', label: 'Food & Dining' },
  { id: 'nature', label: 'Nature' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'beach', label: 'Beaches' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'local', label: 'Local Culture' },
];

const DIETARY_PREFERENCES = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'glutenFree', label: 'Gluten-Free' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'dairyFree', label: 'Dairy-Free' },
  { id: 'local', label: 'Local Cuisine' },
];

const TRANSPORTATION_OPTIONS = [
  { value: "walking", label: "Walking" },
  { value: "public", label: "Public Transit" },
  { value: "taxi", label: "Taxi/Rideshare" },
  { value: "car", label: "Rental Car" },
];

const TRAVEL_GROUP_OPTIONS = [
  { value: "solo", label: "Solo Traveler" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family with Kids" },
  { value: "friends", label: "Group of Friends" },
  { value: "business", label: "Business Trip" },
];

const BUDGET_OPTIONS = [
  { value: "budget", label: "Budget" },
  { value: "mid-range", label: "Mid-Range" },
  { value: "luxury", label: "Luxury" },
];

const EnhancedItineraryCreator: React.FC<EnhancedItineraryCreatorProps> = ({
  initialDestination = '',
  initialStartDate = '',
  initialEndDate = '',
  onCreationComplete,
}) => {
  // Form state
  const [destination, setDestination] = useState(initialDestination);
  
  // Use 2025 as the base year for all new itineraries
  const getCurrentDateWithYear = () => {
    const today = new Date();
    const useYear = today.getFullYear() < 2025 ? 2025 : today.getFullYear();
    return new Date(useYear, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  };
  
  // Get end date 7 days from the start date using same year logic
  const getEndDateWithYear = () => {
    const today = new Date();
    const useYear = today.getFullYear() < 2025 ? 2025 : today.getFullYear();
    const futureDate = new Date(useYear, today.getMonth(), today.getDate() + 7);
    return futureDate.toISOString().split('T')[0];
  };
  
  const [startDate, setStartDate] = useState(initialStartDate || getCurrentDateWithYear());
  const [endDate, setEndDate] = useState(initialEndDate || getEndDateWithYear());
  const [travelStyle, setTravelStyle] = useState('cultural');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['history', 'food']);
  const [travelGroup, setTravelGroup] = useState('couple');
  const [budget, setBudget] = useState('mid-range');
  const [transportMode, setTransportMode] = useState('walking');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(['local']);
  const [pace, setPace] = useState<'slow' | 'moderate' | 'fast'>('moderate');
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  
  // Get itinerary creation functions from hook
  const {
    createEnhancedItinerary,
    cancelItineraryCreation,
    itineraryCreationStatus,
    itineraryCreationProgress,
    itineraryCreationStep,
  } = useAgentItinerary();
  
  // Load saved preferences on component mount
  useEffect(() => {
    const loadSavedPreferences = async () => {
      const savedPreferences = await UserPreferencesService.loadPreferences();
      if (savedPreferences) {
        updateFormStateFromPreferences(savedPreferences);
        setHasLoadedPreferences(true);
      }
    };
    
    // Load sync first for immediate UI response
    const syncPrefs = UserPreferencesService.getPreferencesSync();
    if (syncPrefs) {
      updateFormStateFromPreferences(syncPrefs);
      setHasLoadedPreferences(true);
    }
    
    // Then load from server
    loadSavedPreferences();
  }, []);
  
  // Helper function to update form state from preferences object
  const updateFormStateFromPreferences = (prefs: UserPreferences) => {
    setTravelStyle(prefs.travelStyle);
    setSelectedInterests(prefs.interests.map(i => i.id));
    setTravelGroup(prefs.travelGroup);
    setBudget(prefs.budget);
    setTransportMode(prefs.transportMode);
    setDietaryPreferences(prefs.dietaryPreferences.map(p => p.id));
    setPace(prefs.pace);
  };
  
  // Save preferences whenever they change (but not on initial load)
  useEffect(() => {
    if (hasLoadedPreferences) {
      const preferencesToSave: UserPreferences = {
        travelStyle,
        interests: selectedInterests.map(id => {
          const interest = INTERESTS.find(i => i.id === id);
          return { id, label: interest?.label || id };
        }),
        travelGroup,
        budget,
        transportMode,
        dietaryPreferences: dietaryPreferences.map(id => {
          const pref = DIETARY_PREFERENCES.find(p => p.id === id);
          return { id, label: pref?.label || id };
        }),
        pace,
        lastUpdated: Date.now(),
      };
      
      // Save in background - don't await
      UserPreferencesService.savePreferences(preferencesToSave);
    } else if (selectedInterests.length > 0) {
      // We've finished initial state setup, mark as loaded
      setHasLoadedPreferences(true);
    }
  }, [
    hasLoadedPreferences,
    travelStyle,
    selectedInterests,
    travelGroup,
    budget,
    transportMode,
    dietaryPreferences,
    pace
  ]);
  
  // Toggle handlers for selection options
  const toggleInterest = (interestId: string) => {
    if (selectedInterests.includes(interestId)) {
      setSelectedInterests(selectedInterests.filter(id => id !== interestId));
    } else {
      // Limit to 5 interests
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interestId]);
      }
    }
  };
  
  const toggleDietaryPreference = (preferenceId: string) => {
    if (dietaryPreferences.includes(preferenceId)) {
      setDietaryPreferences(dietaryPreferences.filter(id => id !== preferenceId));
    } else {
      setDietaryPreferences([...dietaryPreferences, preferenceId]);
    }
  };
  
  // Create preferences object for submission
  const createPreferencesObject = (): UserPreferences => ({
    travelStyle,
    interests: selectedInterests.map(id => {
      const interest = INTERESTS.find(i => i.id === id);
      return { id, label: interest?.label || id };
    }),
    travelGroup,
    budget,
    transportMode,
    dietaryPreferences: dietaryPreferences.map(id => {
      const pref = DIETARY_PREFERENCES.find(p => p.id === id);
      return { id, label: pref?.label || id };
    }),
    pace,
    lastUpdated: Date.now(),
  });
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!destination) {
      alert('Please enter a destination');
      return;
    }
    
    // Create full preferences object with both IDs and labels
    const userPreferences = createPreferencesObject();
    
    // Save the preferences to storage - don't await to avoid blocking UI
    UserPreferencesService.savePreferences(userPreferences);
    
    // Create the itinerary using the structured preferences
    const result = await createEnhancedItinerary(
      destination,
      startDate,
      endDate,
      userPreferences.interests,
      {
        travelStyle: userPreferences.travelStyle,
        travelGroup: userPreferences.travelGroup,
        budget: userPreferences.budget,
        transportMode: userPreferences.transportMode,
        dietaryPreferences: userPreferences.dietaryPreferences,
        pace: userPreferences.pace,
      }
    );
    
    if (result.success && onCreationComplete) {
      onCreationComplete();
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Create Your Perfect Itinerary</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Destination and Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                type="text"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="Where to?"
                className="pl-10"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="pl-10"
                min={startDate}
                required
              />
            </div>
          </div>
        </div>
        
        {/* Travel Style */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Travel Style</label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {TRAVEL_STYLES.map(style => (
              <div
                key={style.id}
                onClick={() => setTravelStyle(style.id)}
                className={`rounded-md py-2 px-3 cursor-pointer text-center text-sm transition-colors ${
                  travelStyle === style.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {style.label}
              </div>
            ))}
          </div>
        </div>
        
        {/* Interests */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Interests (Choose up to 5)
          </label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => (
              <Badge
                key={interest.id}
                variant={selectedInterests.includes(interest.id) ? 'default' : 'outline'}
                className={`cursor-pointer ${
                  selectedInterests.includes(interest.id)
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => toggleInterest(interest.id)}
              >
                {interest.label}
                {selectedInterests.includes(interest.id) && (
                  <CheckCircle className="h-3 w-3 ml-1" />
                )}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Travel Group and Budget */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Who's Traveling?</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Select value={travelGroup} onValueChange={setTravelGroup}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Select travel group" />
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_GROUP_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Budget Level</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Select value={budget} onValueChange={setBudget}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Transportation and Pace */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Primary Transportation</label>
            <div className="relative">
              <Map className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Select transportation" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORTATION_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Travel Pace</label>
            <div className="pt-6">
              <div className="flex justify-between mb-2 text-xs text-slate-500">
                <span>Relaxed</span>
                <span>Balanced</span>
                <span>Action-packed</span>
              </div>
              <Slider
                defaultValue={[1]}
                value={[pace === 'slow' ? 0 : pace === 'moderate' ? 1 : 2]}
                max={2}
                step={1}
                onValueChange={values => {
                  const paceMap: Array<'slow' | 'moderate' | 'fast'> = ['slow', 'moderate', 'fast'];
                  setPace(paceMap[values[0]]);
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Dietary Preferences */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Dietary Preferences</label>
          <div className="relative">
            <Utensils className="absolute left-3 top-5 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <div className="pl-10 flex flex-wrap gap-2">
              {DIETARY_PREFERENCES.map(pref => (
                <Badge
                  key={pref.id}
                  variant={dietaryPreferences.includes(pref.id) ? 'default' : 'outline'}
                  className={`cursor-pointer ${
                    dietaryPreferences.includes(pref.id)
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  onClick={() => toggleDietaryPreference(pref.id)}
                >
                  {pref.label}
                  {dietaryPreferences.includes(pref.id) && (
                    <CheckCircle className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            disabled={itineraryCreationStatus === 'loading' || itineraryCreationStatus === 'starting'}
          >
            Create My Personalized Itinerary
          </Button>
          <p className="text-xs text-slate-500 text-center mt-2">
            This will use AI to create an itinerary based on your preferences
          </p>
        </div>
      </form>
      
      {/* Progress Modal */}
      <ItineraryProgress
        status={itineraryCreationStatus as 'idle' | 'loading' | 'success' | 'error'}
        progress={itineraryCreationProgress}
        step={itineraryCreationStep}
        onCancel={cancelItineraryCreation}
      />
    </div>
  );
};

export default EnhancedItineraryCreator; 