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
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [preferencesTimeout, setPreferencesTimeout] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userPreferences, loading: preferencesLoading, refreshPreferences } = useUserPreferences();

  // Detect mobile device for better error handling
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Add aggressive timeout for mobile devices - force app to load after 10 seconds
  useEffect(() => {
    if (isMobile) {
      const forceTimeout = setTimeout(() => {
        console.warn('FORCE TIMEOUT: Mobile app taking too long to load - forcing ready state');
        setForceReady(true);
        setPreferencesTimeout(true);
        setLoadingMessage('Ready!');
        
        // Force show onboarding as fallback
        const onboardingDismissed = localStorage.getItem('onboardingDismissed');
        if (!onboardingDismissed) {
          setShowOnboarding(true);
        }
      }, 10000); // 10 second force timeout

      return () => clearTimeout(forceTimeout);
    }
  }, [isMobile]);

  // Add timeout for preferences loading on mobile
  useEffect(() => {
    let preferencesTimeoutId: NodeJS.Timeout | undefined;

    if (authChecked && preferencesLoading && isMobile && !forceReady) {
      console.log('Setting mobile preferences timeout...');
      preferencesTimeoutId = setTimeout(() => {
        console.warn('Mobile preferences loading timeout reached - proceeding without waiting');
        setPreferencesTimeout(true);
        setLoadingMessage('Almost ready...');
      }, 6000); // 6 second timeout for mobile preferences
    }

    // Clear timeout if preferences finish loading
    if (!preferencesLoading && preferencesTimeoutId) {
      clearTimeout(preferencesTimeoutId);
      setPreferencesTimeout(false);
    }

    return () => {
      if (preferencesTimeoutId) {
        clearTimeout(preferencesTimeoutId);
      }
    };
  }, [authChecked, preferencesLoading, isMobile, forceReady]);

  // Check user authentication only once
  useEffect(() => {
    let authTimeout: NodeJS.Timeout;
    let isComponentMounted = true;

    const checkUserAuth = async () => {
      try {
        console.log("Checking user authentication... (mobile:", isMobile, ")");
        setLoadingMessage(isMobile ? 'Signing in...' : 'Loading...');
        
        // Set timeout for mobile devices to prevent infinite loading
        if (isMobile) {
          authTimeout = setTimeout(() => {
            if (isComponentMounted) {
              console.warn('Mobile auth check timeout - redirecting to auth');
              toast({
                title: "Connection Issue",
                description: "Taking longer than expected. Please try again.",
                variant: "destructive",
              });
              navigate('/auth');
            }
          }, 10000); // 10 second timeout for mobile
        }

        // Add timeout wrapper for mobile auth calls
        const sessionPromise = supabase.auth.getSession();
        let sessionResult;

        if (isMobile) {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Mobile session timeout')), 8000)
          );
          sessionResult = await Promise.race([sessionPromise, timeoutPromise]);
        } else {
          sessionResult = await sessionPromise;
        }

        const { data: sessionData, error: sessionError } = sessionResult;
        
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          throw sessionError;
        }
        
        if (!sessionData.session) {
          console.log("No active session, redirecting to auth");
          if (isComponentMounted) {
            navigate('/auth');
          }
          return;
        }
        
        // Get user details with mobile timeout
        setLoadingMessage(isMobile ? 'Getting your profile...' : 'Loading...');
        
        const userPromise = supabase.auth.getUser();
        let userResult;

        if (isMobile) {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Mobile user timeout')), 5000)
          );
          userResult = await Promise.race([userPromise, timeoutPromise]);
        } else {
          userResult = await userPromise;
        }

        const { data: userData, error: userError } = userResult;
        
        if (userError) {
          console.error("Error getting user:", userError);
          throw userError;
        }
        
        if (!userData.user) {
          console.log("No authenticated user, redirecting to auth");
          if (isComponentMounted) {
            navigate('/auth');
          }
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
        
        if (isComponentMounted) {
          setAuthChecked(true);
          // On mobile, add a small delay to ensure auth state is fully settled
          if (isMobile) {
            setLoadingMessage('Loading your preferences...');
          }
        }

        // Clear timeout if successful
        if (authTimeout) {
          clearTimeout(authTimeout);
        }
      } catch (error: any) {
        console.error('Error checking auth:', error);
        
        if (isComponentMounted) {
          if (isMobile && (error.message === 'Mobile session timeout' || error.message === 'Mobile user timeout')) {
            console.warn('Mobile auth timeout - redirecting to auth page');
            toast({
              title: "Connection Issue",
              description: isIOS 
                ? "Please check your connection and try switching between WiFi and cellular data."
                : "Please check your internet connection and try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Authentication Error",
              description: "Please sign in again.",
              variant: "destructive",
            });
          }
          navigate('/auth');
        }
      }
    };
    
    checkUserAuth();

    return () => {
      isComponentMounted = false;
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
    };
  }, [navigate, toast, isMobile, isIOS]);

  // Determine if we should show onboarding only when preferences are loaded or timeout reached
  useEffect(() => {
    let onboardingTimeout: NodeJS.Timeout;

    // Check if we should proceed with onboarding decision
    const shouldProceed = authChecked && (!preferencesLoading || preferencesTimeout || forceReady);

    if (shouldProceed) {
      const onboardingDismissed = localStorage.getItem('onboardingDismissed');
      
      console.log("Current state:", {
        authChecked,
        preferencesLoading,
        preferencesTimeout,
        forceReady,
        userPreferences: userPreferences || 'none',
        onboardingDismissed,
        isMobile
      });
      
      // Show onboarding if either:
      // 1. User has no preferences and hasn't dismissed onboarding
      // 2. User preferences is null/undefined (new user)
      // 3. On mobile with timeout, show onboarding as fallback
      // 4. Force ready state (emergency fallback)
      const shouldShowOnboarding = !onboardingDismissed && 
        (!userPreferences || Object.keys(userPreferences || {}).length === 0 || 
         (isMobile && (preferencesTimeout || forceReady)));
      
      console.log("Should show onboarding:", shouldShowOnboarding);
      setShowOnboarding(shouldShowOnboarding);
    } else if (authChecked && preferencesLoading && isMobile && !forceReady) {
      // Additional safety timeout for onboarding decision
      onboardingTimeout = setTimeout(() => {
        console.warn('Mobile onboarding decision timeout - proceeding without preferences');
        setShowOnboarding(false);
      }, 8000);
    }

    return () => {
      if (onboardingTimeout) {
        clearTimeout(onboardingTimeout);
      }
    };
  }, [userPreferences, preferencesLoading, authChecked, preferencesTimeout, forceReady, isMobile]);

  const handleOnboardingComplete = useCallback(async () => {
    console.log("Onboarding completed callback triggered");
    localStorage.setItem('onboardingDismissed', 'true');
    setShowOnboarding(false);
    
    // Make sure preferences are refreshed after onboarding completes
    try {
      await refreshPreferences();
      console.log("Preferences refreshed after onboarding completion");
    } catch (error) {
      console.error("Error refreshing preferences after onboarding:", error);
      // Don't block the UI if preferences refresh fails
    }
  }, [refreshPreferences]);

  // Improved loading condition - don't wait indefinitely for preferences on mobile
  const isLoading = !authChecked || (authChecked && preferencesLoading && !preferencesTimeout && !forceReady);

  // Show loading with mobile-specific messages and timeout handling
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg mb-2">{loadingMessage}</div>
          {isMobile && (
            <div className="text-sm text-gray-500">
              This may take a moment on mobile devices...
            </div>
          )}
          {isMobile && preferencesLoading && (
            <div className="text-xs text-gray-400 mt-2">
              Loading your preferences...
            </div>
          )}
          {isMobile && authChecked && (
            <div className="text-xs text-blue-500 mt-1">
              Will proceed automatically in a few seconds...
            </div>
          )}
        </div>
      </div>
    );
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