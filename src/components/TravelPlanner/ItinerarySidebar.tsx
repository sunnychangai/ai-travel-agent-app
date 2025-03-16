import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import ItineraryDayList from "./ItineraryDayList";
import ActivityEditModal from "./ActivityEditModal";
import SuggestionsList from "./SuggestionsList";
import ItineraryActions from "./ItineraryActions";
import { ScrollArea } from "../ui/scroll-area";

interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  time: string;
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

interface ItinerarySidebarProps {
  days?: ItineraryDay[];
  suggestions?: SuggestionItem[];
  onAddActivity?: (dayNumber: number) => void;
  onEditActivity?: (dayNumber: number, activityId: string) => void;
  onDeleteActivity?: (dayNumber: number, activityId: string) => void;
  onAcceptSuggestion?: (suggestion: SuggestionItem) => void;
  onModifySuggestion?: (suggestion: SuggestionItem) => void;
  onRejectSuggestion?: (suggestion: SuggestionItem) => void;
  onSaveItinerary?: () => void;
  onShareItinerary?: () => void;
  onExportItinerary?: () => void;
  onPrintItinerary?: () => void;
  onRefreshItinerary?: () => void;
}

const ItinerarySidebar: React.FC<ItinerarySidebarProps> = ({
  days = [
    {
      date: "2023-06-15",
      dayNumber: 1,
      activities: [
        {
          id: "1",
          title: "Visit Eiffel Tower",
          description:
            "Enjoy the iconic landmark of Paris with breathtaking views of the city.",
          location:
            "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France",
          time: "10:00 AM - 12:00 PM",
          imageUrl:
            "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=600&q=80",
        },
        {
          id: "2",
          title: "Lunch at Le Jules Verne",
          description: "Fine dining experience with panoramic views of Paris.",
          location:
            "Eiffel Tower, 2nd floor, Avenue Gustave Eiffel, 75007 Paris, France",
          time: "12:30 PM - 2:30 PM",
          imageUrl:
            "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=600&q=80",
        },
      ],
    },
    {
      date: "2023-06-16",
      dayNumber: 2,
      activities: [
        {
          id: "3",
          title: "Louvre Museum Tour",
          description:
            "Explore one of the world's largest art museums and see the Mona Lisa.",
          location: "Rue de Rivoli, 75001 Paris, France",
          time: "9:00 AM - 1:00 PM",
          imageUrl:
            "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80",
        },
        {
          id: "4",
          title: "Seine River Cruise",
          description:
            "Relaxing boat tour along the Seine River to see Paris from a different perspective.",
          location:
            "Port de la Conférence, Pont de l'Alma, 75008 Paris, France",
          time: "3:00 PM - 5:00 PM",
          imageUrl:
            "https://images.unsplash.com/photo-1541410965313-d53b3c16ef17?w=600&q=80",
        },
      ],
    },
  ],
  suggestions = [
    {
      id: "1",
      title: "Visit the Eiffel Tower",
      description:
        "Iconic iron lattice tower on the Champ de Mars in Paris, France.",
      imageUrl:
        "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&q=80",
      location: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France",
      duration: "2 hours",
    },
    {
      id: "2",
      title: "Louvre Museum Tour",
      description:
        "World's largest art museum and a historic monument in Paris, France.",
      imageUrl:
        "https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=400&q=80",
      location: "Rue de Rivoli, 75001 Paris, France",
      duration: "3 hours",
    },
    {
      id: "3",
      title: "Seine River Cruise",
      description:
        "Scenic boat tour along the Seine River with views of Paris landmarks.",
      imageUrl:
        "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80",
      location: "Port de la Conférence, 75008 Paris, France",
      duration: "1 hour",
    },
  ],
  onAddActivity = (dayNumber) =>
    console.log(`Add activity to day ${dayNumber}`),
  onEditActivity = (dayNumber, activityId) =>
    console.log(`Edit activity ${activityId} on day ${dayNumber}`),
  onDeleteActivity = (dayNumber, activityId) =>
    console.log(`Delete activity ${activityId} on day ${dayNumber}`),
  onAcceptSuggestion = (suggestion) =>
    console.log(`Accept suggestion: ${suggestion.title}`),
  onModifySuggestion = (suggestion) =>
    console.log(`Modify suggestion: ${suggestion.title}`),
  onRejectSuggestion = (suggestion) =>
    console.log(`Reject suggestion: ${suggestion.title}`),
  onSaveItinerary = () => console.log("Save itinerary"),
  onShareItinerary = () => console.log("Share itinerary"),
  onExportItinerary = () => console.log("Export itinerary"),
  onPrintItinerary = () => console.log("Print itinerary"),
  onRefreshItinerary = () => console.log("Refresh itinerary"),
}) => {
  const [activeTab, setActiveTab] = useState("itinerary");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<any>(null);

  const handleEditActivity = (dayNumber: number, activityId: string) => {
    // Find the activity in the days array
    const day = days.find((d) => d.dayNumber === dayNumber);
    if (day) {
      const activity = day.activities.find((a) => a.id === activityId);
      if (activity) {
        setCurrentActivity({
          id: activity.id,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          date: new Date(), // This would be parsed from the day.date in a real app
          startTime: activity.time.split(" - ")[0],
          endTime: activity.time.split(" - ")[1] || "",
          imageUrl: activity.imageUrl || "",
        });
        setEditModalOpen(true);
      }
    }
    onEditActivity(dayNumber, activityId);
  };

  const handleSaveActivity = (updatedActivity: any) => {
    console.log("Saving updated activity:", updatedActivity);
    setEditModalOpen(false);
    // In a real app, you would update the activity in your state/store here
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full h-full flex flex-col"
      >
        <div className="border-b bg-white px-4">
          <TabsList className="h-14">
            <TabsTrigger value="itinerary" className="flex-1">
              Itinerary
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="flex-1">
              Suggestions
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent
            value="itinerary"
            className="h-full flex flex-col m-0 data-[state=active]:flex-1"
          >
            <div className="flex-1 overflow-hidden">
              <ItineraryDayList
                days={days}
                onAddActivity={onAddActivity}
                onEditActivity={handleEditActivity}
                onDeleteActivity={onDeleteActivity}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="suggestions"
            className="h-full flex flex-col m-0 data-[state=active]:flex-1"
          >
            <ScrollArea className="flex-1">
              <div className="p-4">
                <SuggestionsList
                  suggestions={suggestions}
                  onAccept={onAcceptSuggestion}
                  onModify={onModifySuggestion}
                  onReject={onRejectSuggestion}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </div>

        <ItineraryActions
          onSave={onSaveItinerary}
          onShare={onShareItinerary}
          onExport={onExportItinerary}
          onPrint={onPrintItinerary}
          onRefresh={onRefreshItinerary}
        />
      </Tabs>

      {editModalOpen && currentActivity && (
        <ActivityEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          activity={currentActivity}
          onSave={handleSaveActivity}
        />
      )}
    </div>
  );
};

export default ItinerarySidebar;
