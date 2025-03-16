import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

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

interface ActivityCardProps {
  title: string;
  description: string;
  location: string;
  time: string;
  imageUrl?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Inline ActivityCard component since there seems to be an issue with importing it
const ActivityCard: React.FC<ActivityCardProps> = ({
  title = "Activity Title",
  description = "Activity description goes here",
  location = "Activity location",
  time = "9:00 AM - 11:00 AM",
  imageUrl = "https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=600&q=80",
  onEdit = () => console.log("Edit activity"),
  onDelete = () => console.log("Delete activity"),
}) => {
  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="flex flex-col md:flex-row">
        {imageUrl && (
          <div className="w-full md:w-1/3 h-32 md:h-auto">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4 flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-gray-600 mt-1">{time}</p>
              <p className="text-sm text-gray-500 mt-1">{location}</p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="text-gray-500 hover:text-blue-600"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-gray-500 hover:text-red-600"
              >
                Delete
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-700 mt-2">{description}</p>
        </div>
      </div>
    </div>
  );
};

interface ItineraryDayListProps {
  days: ItineraryDay[];
  onAddActivity?: (dayNumber: number) => void;
  onEditActivity?: (dayNumber: number, activityId: string) => void;
  onDeleteActivity?: (dayNumber: number, activityId: string) => void;
}

const ItineraryDayList: React.FC<ItineraryDayListProps> = ({
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
  onAddActivity = (dayNumber) =>
    console.log(`Add activity to day ${dayNumber}`),
  onEditActivity = (dayNumber, activityId) =>
    console.log(`Edit activity ${activityId} on day ${dayNumber}`),
  onDeleteActivity = (dayNumber, activityId) =>
    console.log(`Delete activity ${activityId} on day ${dayNumber}`),
}) => {
  const [openDays, setOpenDays] = useState<number[]>(
    days.map((day) => day.dayNumber),
  );

  const toggleDay = (dayNumber: number) => {
    setOpenDays((prev) =>
      prev.includes(dayNumber)
        ? prev.filter((d) => d !== dayNumber)
        : [...prev, dayNumber],
    );
  };

  const isDayOpen = (dayNumber: number) => openDays.includes(dayNumber);

  return (
    <ScrollArea className="h-full w-full bg-white">
      <div className="p-4 space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Your Itinerary</h2>

        {days.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No itinerary days added yet.</p>
            <p>Start chatting with the AI to build your trip!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <Collapsible
                key={day.dayNumber}
                open={isDayOpen(day.dayNumber)}
                onOpenChange={() => toggleDay(day.dayNumber)}
                className="border rounded-lg overflow-hidden bg-gray-50"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Day {day.dayNumber}
                      </h3>
                      <p className="text-sm text-gray-600">{day.date}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {day.activities.length} activities
                      </span>
                      {isDayOpen(day.dayNumber) ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="p-4 space-y-4">
                    {day.activities.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        title={activity.title}
                        description={activity.description}
                        location={activity.location}
                        time={activity.time}
                        imageUrl={activity.imageUrl}
                        onEdit={() =>
                          onEditActivity(day.dayNumber, activity.id)
                        }
                        onDelete={() =>
                          onDeleteActivity(day.dayNumber, activity.id)
                        }
                      />
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 border-dashed border-gray-300 text-gray-500 hover:text-gray-700"
                      onClick={() => onAddActivity(day.dayNumber)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Activity
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default ItineraryDayList;
