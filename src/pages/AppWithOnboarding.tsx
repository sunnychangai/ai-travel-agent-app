import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Home from '@/components/home';
import Onboarding from './Onboarding';
import { supabase } from '@/services/supabase';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useToast } from '@/components/ui/use-toast';
import { useItinerary } from '@/contexts/ItineraryContext';

// Wrapper component to handle loading itineraries from URL
const HomeWithItineraryLoader = () => {
  const location = useLocation();
  const { loadItinerary } = useItinerary();
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadItineraryFromParams = async () => {
      const searchParams = new URLSearchParams(location.search);
      const itineraryId = searchParams.get('load');
      
      if (itineraryId) {
        try {
          setIsLoadingItinerary(true);
          await loadItinerary(itineraryId);
          toast({
            title: "Itinerary loaded",
            description: "Your saved trip has been loaded successfully",
          });
        } catch (error) {
          console.error('Error loading itinerary from URL:', error);
          toast({
            title: "Error",
            description: "Failed to load the itinerary",
            variant: "destructive",
          });
        } finally {
          setIsLoadingItinerary(false);
        }
      }
    };
    
    loadItineraryFromParams();
  }, [location.search, loadItinerary, toast]);

  return (
    <>
      {isLoadingItinerary && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-pulse">Loading your itinerary...</div>
          </div>
        </div>
      )}
      <Home />
    </>
  );
};

export default function AppWithOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userPreferences, refreshPreferences } = useUserPreferences();

  // Authentication check with proper error handling
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      try {
        console.log("Starting authentication check...");
        
        // Check if Supabase is configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          console.warn("Supabase not configured - running in demo mode");
          if (isMounted) {
            toast({
              title: "Demo Mode",
              description: "Running without authentication. Your data will be stored locally.",
            });
            setAuthChecked(true);
          }
          return;
        }
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error("Auth error:", error);
          // Only redirect on specific auth errors, not network issues
          if (error.message.includes('Invalid') || error.message.includes('expired')) {
            navigate('/auth');
          } else {
            toast({
              title: "Authentication Error", 
              description: "Please try signing in again.",
              variant: "destructive",
            });
            navigate('/auth');
          }
          return;
        }
        
        if (!session) {
          console.log("No session found, redirecting to auth");
          navigate('/auth');
          return;
        }
        
        console.log("User authenticated:", session.user.id);
        setAuthChecked(true);
        
      } catch (error) {
        console.error('Authentication check failed:', error);
        // Don't redirect on network errors, let user retry
        if (isMounted) {
          toast({
            title: "Connection Error",
            description: "Failed to check authentication. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, [navigate, toast]);

  // Handle onboarding logic after auth is checked
  useEffect(() => {
    if (!authChecked) return;
    
    // Check if user should see onboarding
    const onboardingDismissed = localStorage.getItem('onboardingDismissed');
    const shouldShowOnboarding = !onboardingDismissed && (!userPreferences || Object.keys(userPreferences || {}).length === 0);
    
    setShowOnboarding(shouldShowOnboarding);
    setIsLoading(false);
    
  }, [authChecked, userPreferences]);

  const handleOnboardingComplete = useCallback(async () => {
    console.log("Onboarding completed");
    localStorage.setItem('onboardingDismissed', 'true');
    setShowOnboarding(false);
    
    try {
      await refreshPreferences();
    } catch (error) {
      console.error("Error refreshing preferences:", error);
    }
  }, [refreshPreferences]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg mb-2">Loading...</div>
          <div className="text-sm text-gray-500">Checking authentication...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding ? (
        <Onboarding 
          onComplete={handleOnboardingComplete} 
          key="onboarding-modal"
        />
      ) : (
        <HomeWithItineraryLoader />
      )}
    </>
  );
} 