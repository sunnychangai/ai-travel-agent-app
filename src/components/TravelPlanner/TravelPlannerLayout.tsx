import React, { useState } from "react";
import ChatInterface from "./ChatInterface";
import ItinerarySidebar from "./ItinerarySidebar";
import { cn } from "../../lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hi there! I'm your AI travel assistant. Where would you like to go on your next trip?",
      sender: "ai",
      timestamp: new Date(Date.now() - 60000 * 5),
    },
    {
      id: "2",
      content:
        "I'm planning a trip to Paris for a week in June. Can you help me create an itinerary?",
      sender: "user",
      timestamp: new Date(Date.now() - 60000 * 3),
    },
    {
      id: "3",
      content:
        "Absolutely! Paris in June is beautiful. Let's create a wonderful itinerary for you. How many days will you be staying, and are there any specific attractions you definitely want to visit?",
      sender: "ai",
      timestamp: new Date(Date.now() - 60000),
    },
  ]);

  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([
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
  ]);

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([
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
  ]);

  const handleSendMessage = (message: string) => {
    setIsLoading(true);

    // Simulate AI processing
    setTimeout(() => {
      // Update itinerary based on message content
      if (
        message.toLowerCase().includes("add") &&
        message.toLowerCase().includes("montmartre")
      ) {
        const newActivity: Activity = {
          id: Date.now().toString(),
          title: "Explore Montmartre",
          description:
            "Visit the historic district of Montmartre, known for the Sacré-Cœur Basilica and as an artists' haven.",
          location: "Montmartre, 75018 Paris, France",
          time: "10:00 AM - 2:00 PM",
          imageUrl:
            "https://images.unsplash.com/photo-1550340499-a6c60f8c4441?w=600&q=80",
        };

        // Add to day 3 or create day 3 if it doesn't exist
        const day3Index = itineraryDays.findIndex((day) => day.dayNumber === 3);
        if (day3Index >= 0) {
          const updatedDays = [...itineraryDays];
          updatedDays[day3Index].activities.push(newActivity);
          setItineraryDays(updatedDays);
        } else {
          setItineraryDays([
            ...itineraryDays,
            {
              date: "2023-06-17",
              dayNumber: 3,
              activities: [newActivity],
            },
          ]);
        }

        // Add AI response
        const aiResponse: Message = {
          id: Date.now().toString(),
          content:
            "I've added Montmartre to your itinerary for day 3. It's a beautiful area with stunning views of Paris from the Sacré-Cœur Basilica. Would you like me to suggest some restaurants in that area for lunch?",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        // Generic response for other messages
        const aiResponse: Message = {
          id: Date.now().toString(),
          content:
            "I've processed your request and updated your itinerary. Is there anything specific you'd like to add or modify?",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
      }

      setIsLoading(false);
    }, 1500);
  };

  const handleAddActivity = (dayNumber: number) => {
    console.log(`Adding activity to day ${dayNumber}`);
    // In a real app, this would open a form or modal to add a new activity
  };

  const handleEditActivity = (dayNumber: number, activityId: string) => {
    console.log(`Editing activity ${activityId} on day ${dayNumber}`);
    // In a real app, this would open a form or modal with the activity details
  };

  const handleDeleteActivity = (dayNumber: number, activityId: string) => {
    // Find the day and remove the activity
    const updatedDays = itineraryDays.map((day) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          activities: day.activities.filter(
            (activity) => activity.id !== activityId,
          ),
        };
      }
      return day;
    });

    setItineraryDays(updatedDays);
  };

  const handleAcceptSuggestion = (suggestion: SuggestionItem) => {
    // Convert suggestion to activity and add to the first day
    const newActivity: Activity = {
      id: Date.now().toString(),
      title: suggestion.title,
      description: suggestion.description,
      location: suggestion.location,
      time:
        "10:00 AM - " +
        (suggestion.duration === "1 hour"
          ? "11:00 AM"
          : suggestion.duration === "2 hours"
            ? "12:00 PM"
            : "1:00 PM"),
      imageUrl: suggestion.imageUrl,
    };

    // Add to the first day with available space
    if (itineraryDays.length > 0) {
      const updatedDays = [...itineraryDays];
      updatedDays[0].activities.push(newActivity);
      setItineraryDays(updatedDays);

      // Remove from suggestions
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    }
  };

  return (
    <div className={cn("flex h-full w-full bg-background", className)}>
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={60} minSize={40} className="h-full">
          <ChatInterface
            initialMessages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={40} minSize={30} className="h-full">
          <ItinerarySidebar
            days={itineraryDays}
            suggestions={suggestions}
            onAddActivity={handleAddActivity}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            onAcceptSuggestion={handleAcceptSuggestion}
            onModifySuggestion={(suggestion) =>
              console.log(`Modifying suggestion: ${suggestion.title}`)
            }
            onRejectSuggestion={(suggestion) => {
              setSuggestions((prev) =>
                prev.filter((s) => s.id !== suggestion.id),
              );
            }}
            onSaveItinerary={() => console.log("Saving itinerary")}
            onShareItinerary={() => console.log("Sharing itinerary")}
            onExportItinerary={() => console.log("Exporting itinerary")}
            onPrintItinerary={() => console.log("Printing itinerary")}
            onRefreshItinerary={() => console.log("Refreshing itinerary")}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
