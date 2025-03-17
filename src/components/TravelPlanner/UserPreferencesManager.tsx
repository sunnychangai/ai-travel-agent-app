import React, { useState, useEffect } from 'react';
import { CheckCircle, Save, RotateCcw, X } from 'lucide-react';
import { Button } from '../ui/button';
import { UserPreferences } from './EnhancedItineraryCreator';
import UserPreferencesService from '../../services/userPreferencesService';
import { Badge } from '../ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useUserPreferences } from '../../hooks/useUserPreferences';

interface UserPreferencesManagerProps {
  onClose: () => void;
}

const UserPreferencesManager: React.FC<UserPreferencesManagerProps> = ({ onClose }) => {
  const { 
    preferences, 
    isLoading, 
    clearPreferences: clearUserPreferences 
  } = useUserPreferences();
  
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  
  // Format timestamp to readable date
  const formatLastUpdated = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Reset preferences to default
  const handleResetPreferences = async () => {
    await clearUserPreferences();
    setResetDialogOpen(false);
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Your Travel Preferences</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-600">Loading your preferences...</p>
        </div>
      </div>
    );
  }
  
  if (!preferences) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Your Travel Preferences</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="text-center py-8">
          <p className="text-slate-600 mb-4">
            You haven't saved any travel preferences yet.
          </p>
          <p className="text-slate-600">
            Preferences will be automatically saved when you create an itinerary.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Your Travel Preferences</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <p className="text-sm text-slate-500 mb-6">
        Last updated: {formatLastUpdated(preferences.lastUpdated)}
      </p>
      
      <div className="space-y-6">
        {/* Travel Style */}
        <div>
          <h3 className="text-md font-medium text-slate-700 mb-2">Travel Style</h3>
          <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
            {preferences.travelStyle}
          </Badge>
        </div>
        
        {/* Interests */}
        <div>
          <h3 className="text-md font-medium text-slate-700 mb-2">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {preferences.interests.map(interest => (
              <Badge
                key={interest.id}
                className="bg-blue-100 text-blue-700 border border-blue-300"
              >
                {interest.label}
                <CheckCircle className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Travel Group */}
        <div>
          <h3 className="text-md font-medium text-slate-700 mb-2">Travel Group</h3>
          <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
            {preferences.travelGroup === 'solo' ? 'Solo Traveler' :
             preferences.travelGroup === 'couple' ? 'Couple' :
             preferences.travelGroup === 'family' ? 'Family with Kids' :
             preferences.travelGroup === 'friends' ? 'Group of Friends' : 
             preferences.travelGroup}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Budget */}
          <div>
            <h3 className="text-md font-medium text-slate-700 mb-2">Budget</h3>
            <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
              {preferences.budget === 'budget' ? 'Budget-friendly' :
               preferences.budget === 'mid-range' ? 'Mid-Range' :
               preferences.budget === 'luxury' ? 'Luxury' : 
               preferences.budget}
            </Badge>
          </div>
          
          {/* Transportation */}
          <div>
            <h3 className="text-md font-medium text-slate-700 mb-2">Transportation</h3>
            <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
              {preferences.transportMode === 'walking' ? 'Walking' :
               preferences.transportMode === 'public' ? 'Public Transit' :
               preferences.transportMode === 'taxi' ? 'Taxi/Rideshare' :
               preferences.transportMode === 'car' ? 'Rental Car' : 
               preferences.transportMode}
            </Badge>
          </div>
        </div>
        
        {/* Pace */}
        <div>
          <h3 className="text-md font-medium text-slate-700 mb-2">Travel Pace</h3>
          <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
            {preferences.pace === 'slow' ? 'Relaxed' :
             preferences.pace === 'moderate' ? 'Balanced' :
             preferences.pace === 'fast' ? 'Action-packed' : 
             preferences.pace}
          </Badge>
        </div>
        
        {/* Dietary Preferences */}
        <div>
          <h3 className="text-md font-medium text-slate-700 mb-2">Dietary Preferences</h3>
          <div className="flex flex-wrap gap-2">
            {preferences.dietaryPreferences.map(pref => (
              <Badge
                key={pref.id}
                className="bg-blue-100 text-blue-700 border border-blue-300"
              >
                {pref.label}
                <CheckCircle className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={() => setResetDialogOpen(true)}
          className="text-red-500 border-red-300 hover:bg-red-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Preferences
        </Button>
        
        <Button onClick={onClose} className="bg-blue-500 hover:bg-blue-600 text-white">
          <Save className="h-4 w-4 mr-2" />
          Done
        </Button>
      </div>
      
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your preferences?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all your saved travel preferences. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetPreferences}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserPreferencesManager; 