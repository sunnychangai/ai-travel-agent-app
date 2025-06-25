import React, { useState, useEffect, useRef } from "react";
import { ChatAgent } from "../chat/ChatAgent";
import ItinerarySidebar from "./ItinerarySidebar";
import { cn } from "../../lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { useItinerary } from "../../contexts/ItineraryContext";
import { Activity, ItineraryDay, SuggestionItem, Message } from "../../types";
import { useToast } from "../../components/ui/use-toast";
import { generateItineraryTitle } from "../../utils/itineraryUtils";
import TravelPlannerErrorBoundary from "./TravelPlannerErrorBoundary";
import { MessageCircle, Calendar } from "lucide-react";

interface TravelPlannerLayoutProps {
  className?: string;
}

export default function TravelPlannerLayout({
  className,
}: TravelPlannerLayoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [hasNewItineraryUpdate, setHasNewItineraryUpdate] = useState(false);
  
  const {
    itineraryDays,
    addActivity,
    updateActivity,
    deleteActivity,
    deleteDay,
    saveItinerary,
    addDay,
    forceRefresh,
  } = useItinerary();
  const { toast } = useToast();
  
  // Use ref to track if we've refreshed for this update
  const hasRefreshedRef = useRef(false);
  // Track previous itinerary length to detect when new content is added
  const previousItineraryLengthRef = useRef(0);
  
  // Check if device is mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  // Log itinerary changes for debugging and handle mobile tab switching
  useEffect(() => {
    console.log("TravelPlannerLayout: Itinerary days changed");
    console.log(`TravelPlannerLayout: Current itinerary days: ${itineraryDays.length}`);
    
    // Check if we have actual activities (not just empty days)
    const totalActivities = itineraryDays.reduce((total, day) => total + day.activities.length, 0);
    const previousTotalActivities = previousItineraryLengthRef.current;
    
    // Only force refresh if we haven't done it yet for this update
    if (itineraryDays.length > 0 && !hasRefreshedRef.current) {
      console.log("TravelPlannerLayout: Found itinerary days, forcing refresh once");
      hasRefreshedRef.current = true;
      
      // Reset the flag after a delay to allow future refreshes
      setTimeout(() => {
        hasRefreshedRef.current = false;
      }, 1000);
    }
    
    // Handle mobile tab switching and notifications when actual content is generated
    if (isMobile && totalActivities > previousTotalActivities && totalActivities > 0) {
      console.log("TravelPlannerLayout: New itinerary content detected, switching to itinerary tab");
      // Switch to itinerary tab when actual itinerary content is generated
      setActiveTab("itinerary");
      setHasNewItineraryUpdate(false); // Clear notification since we're switching
    } else if (totalActivities > previousTotalActivities && totalActivities > 0 && activeTab === "chat") {
      // Show notification indicator if user is still on chat tab
      setHasNewItineraryUpdate(true);
    }
    
    // Update the reference for next comparison
    previousItineraryLengthRef.current = totalActivities;
  }, [itineraryDays, isMobile, activeTab]);

  // Clear notification when user manually switches to itinerary tab
  useEffect(() => {
    if (activeTab === "itinerary") {
      setHasNewItineraryUpdate(false);
    }
  }, [activeTab]);

  const handleDestinationDetected = (destination: string, date: string) => {
    // Add a new day for the detected destination
    addDay({
      dayNumber: itineraryDays.length + 1,
      date,
      activities: []
    });
    
    // Force refresh after adding a day
    setTimeout(() => forceRefresh(), 100);
    
    // Don't automatically switch tabs - let the user continue their conversation
    // Tab switching will happen when actual itinerary content is generated
  };

  const handleAddActivity = (dayNumber: number, activity: any) => {
    addActivity(dayNumber, activity);
  };

  const handleUpdateActivity = (dayNumber: number, activityId: string, updatedActivity: any) => {
    updateActivity(dayNumber, activityId, updatedActivity);
  };

  const handleDeleteActivity = (dayNumber: number, activityId: string) => {
    deleteActivity(dayNumber, activityId);
  };

  const handleSaveItinerary = async (customTitle?: string) => {
    let title = 'My Trip'; // Default fallback
    
    // If a custom title was provided (even if empty), use it as-is
    if (customTitle !== undefined) {
      title = customTitle || 'My Trip'; // Use customTitle or fallback if it's empty
      console.log("Using provided custom title:", title);
    } else {
      // Only generate a title if no custom title parameter was provided at all
      console.log("No custom title provided, generating automatic title");
      
      if (itineraryDays.length > 0) {
        // Find the first activity with a location
        let destinationCity = '';
        let startDate = '';
        let endDate = '';
        
        // Sort days to get start and end dates
        const sortedDays = [...itineraryDays].sort((a, b) => a.dayNumber - b.dayNumber);
        if (sortedDays.length > 0) {
          startDate = sortedDays[0].date;
          endDate = sortedDays[sortedDays.length - 1].date;
        }
        
        for (const day of itineraryDays) {
          for (const activity of day.activities) {
            if (activity.location) {
              // Extract the city from the location (usually formatted as "Attraction, City, Country")
              const locationParts = activity.location.split(',');
              if (locationParts.length > 1) {
                // Use the city (second part) as the destination
                destinationCity = locationParts[1].trim();
                break;
              } else {
                // If only one part exists, use that
                destinationCity = locationParts[0].trim();
                break;
              }
            }
          }
          if (destinationCity) break; // Break if we found a location
        }
        
        // Use the generateItineraryTitle function to create a consistent title
        if (destinationCity) {
          title = generateItineraryTitle(destinationCity, startDate, endDate);
          console.log("Generated automatic title:", title);
        }
      }
    }
    
    try {
      console.log("Saving itinerary with final title:", title);
      const itineraryId = await saveItinerary(title);
      console.log("Itinerary saved with ID:", itineraryId);
      
      if (itineraryId) {
        console.log("Showing toast notification...");
        toast({
          title: "Trip Saved!",
          description: "Your itinerary has been saved successfully.",
          variant: "travel",
        });
        console.log("Toast notification called");
      }
    } catch (error) {
      console.error('Error saving itinerary:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving your itinerary. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Mobile layout with tabs
  if (isMobile) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Tab content area - accounts for fixed bottom tabs */}
          <div className="flex-1 overflow-hidden pb-16">
            <TabsContent value="chat" className="h-full m-0 p-0">
              <ChatAgent 
                onDestinationDetected={(destination) => {
                  // Use 2025 as the year for all new itineraries
                  const today = new Date();
                  const currentYear = today.getFullYear() < 2025 ? 2025 : today.getFullYear();
                  
                  // Create a date in the current year with today's month and day
                  const dateWithCurrentYear = new Date(currentYear, today.getMonth(), today.getDate());
                  const formattedDate = dateWithCurrentYear.toISOString().split('T')[0];
                  
                  handleDestinationDetected(destination, formattedDate);
                }} 
              />
            </TabsContent>
            
            <TabsContent value="itinerary" className="h-full m-0 p-0 bg-gray-100">
              <TravelPlannerErrorBoundary>
                <ItinerarySidebar 
                  onAddActivity={handleAddActivity}
                  onDeleteActivity={handleDeleteActivity}
                  onUpdateActivity={handleUpdateActivity}
                  onSaveItinerary={handleSaveItinerary}
                />
              </TravelPlannerErrorBoundary>
            </TabsContent>
          </div>
          
          {/* Fixed bottom tab navigation */}
          <div className="fixed bottom-0 left-0 right-0 border-t bg-white z-50">
            <TabsList className="grid w-full grid-cols-2 h-16 bg-white rounded-none">
              <TabsTrigger 
                value="chat" 
                className="flex flex-col items-center justify-center gap-1 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="text-xs font-medium">Chat</span>
              </TabsTrigger>
              <TabsTrigger 
                value="itinerary" 
                className="flex flex-col items-center justify-center gap-1 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 relative"
              >
                <Calendar className="h-5 w-5" />
                <span className="text-xs font-medium">Itinerary</span>
                {/* Notification indicator */}
                {hasNewItineraryUpdate && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
    );
  }

  // Desktop layout with resizable panels (unchanged)
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={60} minSize={30} className="h-full">
            <ChatAgent 
              onDestinationDetected={(destination) => {
                // Use 2025 as the year for all new itineraries
                const today = new Date();
                const currentYear = today.getFullYear() < 2025 ? 2025 : today.getFullYear();
                
                // Create a date in the current year with today's month and day
                const dateWithCurrentYear = new Date(currentYear, today.getMonth(), today.getDate());
                const formattedDate = dateWithCurrentYear.toISOString().split('T')[0];
                
                handleDestinationDetected(destination, formattedDate);
              }} 
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Itinerary Panel */}
          <ResizablePanel defaultSize={40} minSize={30} className="h-full bg-gray-100">
            <TravelPlannerErrorBoundary>
              <ItinerarySidebar 
                onAddActivity={handleAddActivity}
                onDeleteActivity={handleDeleteActivity}
                onUpdateActivity={handleUpdateActivity}
                onSaveItinerary={handleSaveItinerary}
              />
            </TravelPlannerErrorBoundary>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
