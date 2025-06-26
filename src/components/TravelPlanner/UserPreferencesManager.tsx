import React, { useState, useEffect } from 'react';
import { CheckCircle, Save, RotateCcw, X, Trash2, MessageCircle, Map } from 'lucide-react';
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
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
  const [dataToDelete, setDataToDelete] = useState<'chat' | 'itinerary' | 'all' | null>(null);
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const [itineraryCount, setItineraryCount] = useState(0);
  
  // Load storage info on component mount
  useEffect(() => {
    // Get chat message count
    try {
      const stored = localStorage.getItem('chat_messages_session');
      setChatMessageCount(stored ? JSON.parse(stored).length : 0);
    } catch (error) {
      setChatMessageCount(0);
    }
    
    // Get itinerary count
    try {
      const stored = localStorage.getItem('itineraries');
      setItineraryCount(stored ? JSON.parse(stored).length : 0);
    } catch (error) {
      setItineraryCount(0);
    }
  }, []);
  
  // Format timestamp to readable date
  const formatLastUpdated = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Reset preferences to default
  const handleResetPreferences = async () => {
    await clearUserPreferences();
    setResetDialogOpen(false);
  };
  
  // Clear specific data types
  const handleClearData = async () => {
    try {
      switch (dataToDelete) {
        case 'chat':
          localStorage.removeItem('chat_messages_session');
          setChatMessageCount(0);
          break;
        case 'itinerary':
          localStorage.removeItem('itineraries');
          localStorage.removeItem('mostRecentItinerary');
          localStorage.removeItem('itinerary_days_persistent');
          localStorage.removeItem('current_itinerary_id_persistent');
          localStorage.removeItem('current_itinerary_title_persistent');
          setItineraryCount(0);
          break;
        case 'all':
          // Clear all app data
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.startsWith('chat_messages') ||
              key.startsWith('itinerary') ||
              key.startsWith('current_itinerary') ||
              key.startsWith('travelApp') ||
              key === 'mostRecentItinerary'
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          setChatMessageCount(0);
          setItineraryCount(0);
          break;
      }
    } catch (error) {
      console.error('Error clearing data:', error);
    } finally {
      setClearDataDialogOpen(false);
      setDataToDelete(null);
    }
  };
  
  const openClearDataDialog = (type: 'chat' | 'itinerary' | 'all') => {
    setDataToDelete(type);
    setClearDataDialogOpen(true);
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Preferences & Data</h2>
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
          <h2 className="text-2xl font-bold text-slate-800">Preferences & Data</h2>
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Preferences & Data</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Data Management Section */}
      <div className="mb-8 p-4 border rounded-lg bg-slate-50">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Data Management</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white rounded border">
            <div className="flex items-center">
              <MessageCircle className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <p className="font-medium text-slate-700">Chat Messages</p>
                <p className="text-sm text-slate-500">{chatMessageCount} stored messages</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openClearDataDialog('chat')}
              disabled={chatMessageCount === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded border">
            <div className="flex items-center">
              <Map className="h-5 w-5 text-green-500 mr-3" />
              <div>
                <p className="font-medium text-slate-700">Saved Itineraries</p>
                <p className="text-sm text-slate-500">{itineraryCount} stored itineraries</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openClearDataDialog('itinerary')}
              disabled={itineraryCount === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
            <div>
              <p className="font-medium text-red-700">Clear All Data</p>
              <p className="text-sm text-red-600">Remove all stored preferences, messages, and itineraries</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openClearDataDialog('all')}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      </div>
      
      {!preferences ? (
        <div className="text-center py-8">
          <p className="text-slate-600 mb-4">
            You haven't saved any travel preferences yet.
          </p>
          <p className="text-slate-600">
            Preferences will be automatically saved when you create an itinerary.
          </p>
        </div>
      ) : (
        <>
          {/* Travel Preferences Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Your Travel Preferences</h3>
            <div className="text-xs text-slate-500 mb-4">
              Last updated: {formatLastUpdated(preferences.lastUpdated)}
            </div>
            
            {/* Preferences Display Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Travel Style */}
              <div>
                <h3 className="text-md font-medium text-slate-700 mb-2">Travel Style</h3>
                <Badge className="bg-green-100 text-green-700 border border-green-300">
                  {preferences.travelStyle}
                  <CheckCircle className="h-3 w-3 ml-1" />
                </Badge>
              </div>

              {/* Budget */}
              <div>
                <h3 className="text-md font-medium text-slate-700 mb-2">Budget</h3>
                <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-300">
                  {preferences.budget}
                  <CheckCircle className="h-3 w-3 ml-1" />
                </Badge>
              </div>

              {/* Travel Group */}
              <div>
                <h3 className="text-md font-medium text-slate-700 mb-2">Travel Group</h3>
                <Badge className="bg-purple-100 text-purple-700 border border-purple-300">
                  {preferences.travelGroup}
                  <CheckCircle className="h-3 w-3 ml-1" />
                </Badge>
              </div>

              {/* Transport Mode */}
              <div>
                <h3 className="text-md font-medium text-slate-700 mb-2">Transport Mode</h3>
                <Badge className="bg-orange-100 text-orange-700 border border-orange-300">
                  {preferences.transportMode}
                  <CheckCircle className="h-3 w-3 ml-1" />
                </Badge>
              </div>

              {/* Pace */}
              <div>
                <h3 className="text-md font-medium text-slate-700 mb-2">Pace</h3>
                <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-300">
                  {preferences.pace}
                  <CheckCircle className="h-3 w-3 ml-1" />
                </Badge>
              </div>
            </div>

            {/* Interests */}
            <div className="mt-6">
              <h3 className="text-md font-medium text-slate-700 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {preferences.interests.map(interest => (
                  <Badge
                    key={interest.id}
                    className="bg-cyan-100 text-cyan-700 border border-cyan-300"
                  >
                    {interest.label}
                    <CheckCircle className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Dietary Preferences */}
            <div className="mt-6">
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
          
          {/* Preferences Action */}
          <div className="flex justify-start">
            <Button 
              variant="outline" 
              onClick={() => setResetDialogOpen(true)}
              className="text-red-500 border-red-300 hover:bg-red-50"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Preferences
            </Button>
          </div>
        </>
      )}
      
      {/* Close Button */}
      <div className="flex justify-end mt-8">
        <Button onClick={onClose} className="bg-blue-500 hover:bg-blue-600 text-white">
          <Save className="h-4 w-4 mr-2" />
          Done
        </Button>
      </div>
      
      {/* Reset Preferences Confirmation Dialog */}
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
      
      {/* Clear Data Confirmation Dialog */}
      <AlertDialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dataToDelete === 'all' ? 'Clear all data?' : 
               dataToDelete === 'chat' ? 'Clear chat messages?' : 
               'Clear saved itineraries?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dataToDelete === 'all' 
                ? 'This will permanently delete all your chat messages, saved itineraries, and stored data. This action cannot be undone.'
                : dataToDelete === 'chat'
                ? 'This will permanently delete all your chat messages. This action cannot be undone.'
                : 'This will permanently delete all your saved itineraries and current itinerary data. This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearData}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {dataToDelete === 'all' ? 'Clear All Data' : 
               dataToDelete === 'chat' ? 'Clear Messages' : 
               'Clear Itineraries'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserPreferencesManager; 