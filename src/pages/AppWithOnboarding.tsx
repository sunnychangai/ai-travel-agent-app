import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Home from '@/components/home';
import Onboarding from './Onboarding';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useToast } from '@/components/ui/use-toast';
import { ItineraryProvider, useItinerary } from '@/contexts/ItineraryContext';

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

// New component that wraps HomeWithItineraryLoader with the ItineraryProvider
const ItineraryApp = () => {
  return (
    <ItineraryProvider>
      <HomeWithItineraryLoader />
    </ItineraryProvider>
  );
};

export default function AppWithOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userPreferences, loading: preferencesLoading, refreshPreferences } = useUserPreferences();

  // Check user authentication only once
  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        console.log("Checking user authentication...");
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          throw sessionError;
        }
        
        if (!sessionData.session) {
          console.log("No active session, redirecting to auth");
          navigate('/auth');
          return;
        }
        
        // Get user details
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("Error getting user:", userError);
          throw userError;
        }
        
        if (!userData.user) {
          console.log("No authenticated user, redirecting to auth");
          navigate('/auth');
          return;
        }
        
        console.log("User authenticated:", userData.user.id);
        
        // For new users, clear any existing onboarding dismissed flag
        const signUpTime = new Date(userData.user.created_at);
        const now = new Date();
        const isNewUser = (now.getTime() - signUpTime.getTime()) < 5 * 60 * 1000; // Within 5 minutes
        
        if (isNewUser) {
          console.log("New user detected, clearing onboarding dismissed flag");
          localStorage.removeItem('onboardingDismissed');
        }
        
        setAuthChecked(true);
      } catch (error) {
        console.error('Error checking auth:', error);
        toast({
          title: "Authentication Error",
          description: "Please sign in again.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };
    
    checkUserAuth();
  }, [navigate, toast]);

  // Determine if we should show onboarding only when preferences are loaded
  useEffect(() => {
    if (authChecked && !preferencesLoading) {
      const onboardingDismissed = localStorage.getItem('onboardingDismissed');
      
      console.log("Current state:", {
        authChecked,
        preferencesLoading,
        userPreferences: userPreferences || 'none',
        onboardingDismissed
      });
      
      // Show onboarding if either:
      // 1. User has no preferences and hasn't dismissed onboarding
      // 2. User preferences is null/undefined (new user)
      const shouldShowOnboarding = !onboardingDismissed && 
        (!userPreferences || Object.keys(userPreferences || {}).length === 0);
      
      console.log("Should show onboarding:", shouldShowOnboarding);
      setShowOnboarding(shouldShowOnboarding);
    }
  }, [userPreferences, preferencesLoading, authChecked]);

  const handleOnboardingComplete = useCallback(async () => {
    console.log("Onboarding completed callback triggered");
    localStorage.setItem('onboardingDismissed', 'true');
    setShowOnboarding(false);
    
    // Make sure preferences are refreshed after onboarding completes
    await refreshPreferences();
    console.log("Preferences refreshed after onboarding completion");
  }, [refreshPreferences]);

  // Show loading only during initial auth check or when preferences are loading
  if (!authChecked || (authChecked && preferencesLoading)) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-lg">Loading...</div>
    </div>;
  }

  return (
    <>
      {showOnboarding ? (
        <ItineraryProvider>
          <Onboarding 
            onComplete={handleOnboardingComplete} 
            key="onboarding-modal"
          />
        </ItineraryProvider>
      ) : (
        <ItineraryApp />
      )}
    </>
  );
} 