import React, { useState } from "react";
import { ChatAgent } from "../chat/ChatAgent";
import ItinerarySidebar from "./ItinerarySidebar";
import { cn } from "../../lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { useItinerary } from "../../contexts/ItineraryContext";

interface TravelPlannerLayoutProps {
  className?: string;
}

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  time: string;
  type?: string;
  imageUrl?: string;
}

interface ItineraryDay {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  location: string;
  duration: string;
}

export default function TravelPlannerLayout({
  className,
}: TravelPlannerLayoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    itineraryDays,
    addActivity,
    updateActivity,
    deleteActivity,
    deleteDay,
    saveItinerary,
  } = useItinerary();

  const handleDestinationDetected = (detectedDestination: string) => {
    console.log('Destination detected:', detectedDestination);
  };

  const handleAddActivity = (dayNumber: number, activity?: any) => {
    if (activity) {
      addActivity(dayNumber, activity);
    }
  };

  const handleUpdateActivity = (dayNumber: number, activityId: string, updatedActivity: any) => {
    updateActivity(dayNumber, activityId, updatedActivity);
  };

  const handleDeleteActivity = (dayNumber: number, activityId: string) => {
    deleteActivity(dayNumber, activityId);
  };

  const handleSaveItinerary = () => {
    const destinationName = itineraryDays.length > 0
      ? itineraryDays[0].activities[0]?.location?.split(',')[0] || 'My Trip'
      : 'My Trip';
    saveItinerary(destinationName);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={60} minSize={30} className="h-full">
          <ChatAgent onDestinationDetected={handleDestinationDetected} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Itinerary Panel */}
        <ResizablePanel defaultSize={40} minSize={30} className="h-full bg-gray-100">
          <ItinerarySidebar 
            key={`itinerary-sidebar-${itineraryDays ? 
              JSON.stringify(itineraryDays.map(day => 
                day.activities.map(a => a.id).join('-')
              )) : 'empty'}`} 
            onAddActivity={handleAddActivity}
            onDeleteActivity={handleDeleteActivity}
            onUpdateActivity={handleUpdateActivity}
            onSaveItinerary={handleSaveItinerary}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
