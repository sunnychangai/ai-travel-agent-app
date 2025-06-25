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
  
  // Check if device is mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  // Log itinerary changes for debugging
  useEffect(() => {
    console.log("TravelPlannerLayout: Itinerary days changed");
    console.log(`TravelPlannerLayout: Current itinerary days: ${itineraryDays.length}`);
    
    // Only force refresh if we haven't done it yet for this update
    if (itineraryDays.length > 0 && !hasRefreshedRef.current) {
      console.log("TravelPlannerLayout: Found itinerary days, forcing refresh once");
      hasRefreshedRef.current = true;
      
      // Reset the flag after a delay to allow future refreshes
      setTimeout(() => {
        hasRefreshedRef.current = false;
      }, 1000);
    }
  }, [itineraryDays]);

  const handleDestinationDetected = (destination: string, date: string) => {
    // Add a new day for the detected destination
    addDay({
      dayNumber: itineraryDays.length + 1,
      date,
      activities: []
    });
    
    // Force refresh after adding a day
    setTimeout(() => forceRefresh(), 100);
    
    // Switch to itinerary tab on mobile when destination is detected
    if (isMobile) {
      setActiveTab("itinerary");
    }
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
          <div className="flex-1 overflow-hidden">
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
          
          {/* Bottom tab navigation */}
          <div className="border-t bg-white">
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
                className="flex flex-col items-center justify-center gap-1 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600"
              >
                <Calendar className="h-5 w-5" />
                <span className="text-xs font-medium">Itinerary</span>
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
