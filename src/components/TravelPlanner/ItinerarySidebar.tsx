import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
// Type imports
import { Activity, ItineraryDay } from "../../types";

// Hook imports
import { useItinerary } from '../../contexts/ItineraryContext';
import { useNavigate } from 'react-router-dom';
import { useEditableContent } from "../../hooks/useEditableContent";

// Utility imports
import { format, isValid, isToday, parse, parseISO } from 'date-fns';
import { convertTo24Hour, convertToAMPM } from "../../utils/timeUtils";
import { cn } from '../../lib/utils';

// Component imports
import ActivityCard from './ActivityCard';
import ItineraryDayList from './ItineraryDayList';
import ActivityEditModal from "./ActivityEditModal";
import ItineraryActions from "./ItineraryActions";
import DaySelector from './DaySelector';

// UI component imports
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Calendar } from '../ui/calendar';
import { ScrollArea } from "../ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

// Icon imports
import { 
  MoveRight, 
  Calendar as CalendarIcon, 
  Download,
  ListIcon, 
  Edit2, 
  RefreshCw, 
  MoreHorizontal, 
  CalendarDays, 
  Plus, 
  Save, 
  Share, 
  Printer, 
  Wand2,
  ListTodo
} from 'lucide-react';

// Add HMR support
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // Force page refresh when this module is updated
    window.location.reload();
  });
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
  onAddActivity?: (dayNumber: number, activity?: Activity) => void;
  onEditActivity?: (dayNumber: number, activityId: string) => void;
  onDeleteActivity?: (dayNumber: number, activityId: string) => void;
  onUpdateActivity?: (dayNumber: number, activityId: string, updatedActivity: any) => void;
  onSaveItinerary?: () => void;
  onShareItinerary?: () => void;
  onExportItinerary?: () => void;
  onPrintItinerary?: () => void;
  onRefreshItinerary?: () => void;
}

// Add a type definition for the ActivityEditModalActivity
interface ActivityEditModalActivity {
  id: string;
  title: string;
  description: string;
  location: string;
  date: Date;
  startTime: string;
  endTime: string;
  imageUrl: string;
  type?: string;
}

// Wrap the component with React.memo for shallow prop comparison
const ItinerarySidebar: React.FC<ItinerarySidebarProps> = React.memo(({
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onUpdateActivity,
  onSaveItinerary,
  onShareItinerary,
  onExportItinerary,
  onPrintItinerary,
  onRefreshItinerary,
}) => {
  // Get itinerary data from context
  const { itineraryDays, addActivity, updateActivity, deleteActivity, saveItinerary, addDay } = useItinerary();
  
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"day" | "list">("day");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const {
    value: itineraryTitle,
    setValue: setItineraryTitle,
    isEditing: isEditingTitle,
    startEditing: handleTitleEdit,
    stopEditing: handleTitleSave,
    handleKeyDown: handleTitleKeyPress,
    inputRef: titleInputRef
  } = useEditableContent<string>("My Itinerary");

  // Format date for display - memoize to avoid recreating on every render
  const formatDate = useCallback((dateString: string, formatType?: string) => {
    try {
      // Parse the date string to a Date object
      const date = parseISO(dateString);
      
      // Validate date
      if (!isValid(date)) {
        console.error("Invalid date:", dateString);
        return "Invalid date";
      }
      
      // Format based on requested format
      if (formatType === 'MM/DD') {
        return format(date, 'MM/dd');
      } else if (formatType === 'full') {
        return format(date, 'EEEE, MMMM d, yyyy');
      } else if (formatType === 'monthDay') {
        return format(date, 'MMMM d');
      }
      
      // Default format
      return format(date, 'EEE, MMM d');
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  }, []);

  // Create an initial day when the component mounts if no days exist
  useEffect(() => {
    if (itineraryDays.length === 0 && typeof addDay === 'function') {
      // Get today's date - for demo purposes, use March 17, 2025
      // IMPORTANT: In production, replace this with: const today = new Date();
      const today = new Date(2025, 2, 17); // Month is 0-indexed, so 2 = March
      
      // Format using date-fns for consistency and correctness
      const formattedDate = format(today, 'yyyy-MM-dd');
      
      // Validate the date before proceeding
      if (!isValid(parseISO(formattedDate))) {
        console.error("Generated invalid date:", formattedDate);
        return;
      }
      
      const newDay = {
        dayNumber: 1,
        date: formattedDate,
        activities: []
      };
      
      console.log("Creating initial day with date:", formattedDate);
      
      // Add the new day to the itinerary context
      addDay(newDay);
      // Always set the selected day to the first day
      setSelectedDay("1");
    } else if (itineraryDays.length > 0 && (selectedDay === "all" || !selectedDay)) {
      // Always ensure a day is selected if days exist
      setSelectedDay(itineraryDays[0].dayNumber.toString());
    }
  }, [itineraryDays, addDay, selectedDay]);
  
  // Using useRef to store already processed IDs to prevent repeated fixes on every render
  const processedActivityIds = useRef(new Set<string>());
  
  // Memoize the getActivitiesWithUniqueIds function to avoid unnecessary recomputation
  const getActivitiesWithUniqueIds = useCallback((activities: Activity[]): Activity[] => {
    // If no activities, return empty array
    if (!activities || activities.length === 0) {
      return [];
    }
    
    // Fast path: check if all activity IDs are already processed
    if (activities.every(a => processedActivityIds.current.has(a.id))) {
      return activities;
    }
    
    // Process in a single pass - more efficient than two separate functions
    const idMap = new Map<string, boolean>();
    const result: Activity[] = [];
    
    for (const activity of activities) {
      // Skip processing if already handled in a previous render
      if (processedActivityIds.current.has(activity.id)) {
        result.push(activity);
        idMap.set(activity.id, true);
        continue;
      }
      
      // If this ID is already seen in this batch, generate a new one
      if (idMap.has(activity.id)) {
        const newId = `${activity.id}-${Math.random().toString(36).substring(2, 7)}`;
        const updatedActivity = { ...activity, id: newId };
        result.push(updatedActivity);
        idMap.set(newId, true);
        processedActivityIds.current.add(newId);
      } else {
        // No duplicate, keep original and mark as processed
        result.push(activity);
        idMap.set(activity.id, true);
        processedActivityIds.current.add(activity.id);
      }
    }
    
    return result;
  }, []); // Empty dependency array since this doesn't depend on any props or state

  // Get the date range for display - memoize based on itineraryDays
  const dateRange = useMemo(() => {
    if (itineraryDays.length === 0) return "No dates selected";
    
    const sortedDays = [...itineraryDays].sort((a, b) => a.dayNumber - b.dayNumber);
    const startDate = new Date(sortedDays[0].date);
    const endDate = new Date(sortedDays[sortedDays.length - 1].date);
    
    return `${formatDate(startDate.toISOString())} - ${formatDate(endDate.toISOString())}`;
  }, [itineraryDays, formatDate]);

  // Get the title for the current day - memoize based on selectedDay and itineraryDays
  const dayTitle = useMemo(() => {
    if (selectedDay === "all") return "All Days";
    
    const dayNumber = parseInt(selectedDay);
    const day = itineraryDays.find((d) => d.dayNumber === dayNumber);
    
    if (!day) return `Day ${selectedDay}`;
    
    return `Day ${day.dayNumber}: ${formatDate(day.date)}`;
  }, [selectedDay, itineraryDays, formatDate]);

  // Handle adding a new activity
  const handleAddActivity = (dayNumber: number) => {
    // Handle case when no days exist in itinerary
    if (itineraryDays.length === 0) {
      // Get today's date - for demo purposes, use March 17, 2025
      // IMPORTANT: In production, replace this with: const today = new Date();
      const today = new Date(2025, 2, 17); // Month is 0-indexed, so 2 = March
      
      // Format using date-fns for consistency and correctness
      const formattedDate = format(today, 'yyyy-MM-dd');
      
      // Validate the date before proceeding
      if (!isValid(parseISO(formattedDate))) {
        console.error("Generated invalid date:", formattedDate);
        return;
      }
      
      const newDay = {
        dayNumber: 1,
        date: formattedDate,
        activities: []
      };
      
      // Add the new day to the itinerary context
      try {
        // If addDay exists in the context, use it
        if (typeof addDay === 'function') {
          addDay(newDay);
        } else {
          console.error("addDay function not available");
          return;
        }
        
        // Use the new day
        dayNumber = 1;
        setSelectedDay("1");
        
        // Continue with activity creation below
      } catch (error) {
        console.error("Error creating new day:", error);
        return;
      }
    } else if (isNaN(dayNumber) || dayNumber <= 0) {
      // Handle "all" view case - default to first day if available
      dayNumber = itineraryDays[0].dayNumber;
    }
    
    // If we get here, either we have days or we just created one
    const day = itineraryDays.find((d) => d.dayNumber === dayNumber);
    
    // If day doesn't exist yet (because we just created it), use dummy data
    // Always validate the date first
    let date: Date;
    if (day) {
      date = parseISO(day.date);
      if (!isValid(date)) {
        console.error("Invalid date in day object:", day.date);
        date = new Date(2025, 2, 17); // Fallback to March 17, 2025
      }
    } else {
      date = new Date(2025, 2, 17); // Default to March 17, 2025
    }
    
    // Default time in 12-hour format
    const defaultDisplayTime = "12:00 PM";
    
    // Convert to 24-hour format for the edit modal
    const editTime = convertTo24Hour(defaultDisplayTime);
    
    // Create an empty activity with default values
    setCurrentActivity({
      id: "", // Empty ID indicates this is a new activity
      title: "",
      description: "",
      location: "",
      time: defaultDisplayTime,
      type: "Activity",
      imageUrl: "",
      // Store the day date for reference
      dayDate: date,
      // Store the time in both display format and edit format
      displayStartTime: defaultDisplayTime,
      displayEndTime: "",
      parsedStartTime: editTime,
      parsedEndTime: ""
    });
    
    // Set the selected day to ensure the activity appears in the right place
    setSelectedDay(dayNumber.toString());
    
    // Open the edit modal
    setEditModalOpen(true);
    
    // Call the onAddActivity prop if provided (for external handlers)
    if (onAddActivity) {
      onAddActivity(dayNumber);
    }
  };

  // Handle editing an activity
  const handleEditActivity = (dayNumber: number, activityId: string) => {
    const day = itineraryDays.find((d) => d.dayNumber === dayNumber);
    if (day) {
      const activity = day.activities.find((a) => a.id === activityId);
      if (activity) {
        // Parse the date from the day
        const date = new Date(day.date);
        
        // Parse the time properly, handling AM/PM format
        let displayStartTime = activity.time;
        let displayEndTime = '';
        
        if (activity.time.includes(' - ')) {
          const timeParts = activity.time.split(' - ');
          displayStartTime = timeParts[0];
          displayEndTime = timeParts[1];
        }
        
        // Convert AM/PM time to 24-hour format for the time input
        const editStartTime = convertTo24Hour(displayStartTime);
        const editEndTime = convertTo24Hour(displayEndTime);
        
        setCurrentActivity({
          ...activity,
          // Ensure the activity has a type, defaulting to "Activity" if not specified
          type: activity.type || "Activity",
          // Store the day date for reference
          dayDate: date,
          // Store the time in both display format and edit format
          displayStartTime,
          displayEndTime,
          parsedStartTime: editStartTime,
          parsedEndTime: editEndTime
        });
        setEditModalOpen(true);
        
        // Call the onEditActivity prop for logging purposes only
        if (onEditActivity) {
          onEditActivity(dayNumber, activityId);
        }
      }
    }
  };

  // Handle saving an activity
  const handleSaveActivity = (updatedActivity: Activity & { startTime?: string; endTime?: string }) => {
    if (currentActivity?.id) {
      // Update existing activity
      const dayNumber = parseInt(selectedDay);
      
      let formattedTime = '';
      if ('startTime' in updatedActivity && typeof updatedActivity.startTime === 'string') {
        const startTimeAMPM = convertToAMPM(updatedActivity.startTime);
        formattedTime = startTimeAMPM;
        
        if (updatedActivity.endTime && typeof updatedActivity.endTime === 'string') {
          const endTimeAMPM = convertToAMPM(updatedActivity.endTime);
          formattedTime += ` - ${endTimeAMPM}`;
        }
      } else if ('time' in updatedActivity) {
        formattedTime = updatedActivity.time;
      }
      
      if (onUpdateActivity) {
        onUpdateActivity(dayNumber, currentActivity.id, {
          ...updatedActivity,
          time: formattedTime
        });
      } else {
        // Default implementation if no prop provided
        updateActivity(dayNumber, currentActivity.id, {
          ...updatedActivity,
          time: formattedTime
        });
      }
    } else {
      // Add new activity
      const dayNumber = parseInt(selectedDay);
      
      let formattedTime = '';
      if ('startTime' in updatedActivity && typeof updatedActivity.startTime === 'string') {
        const startTimeAMPM = convertToAMPM(updatedActivity.startTime);
        formattedTime = startTimeAMPM;
        
        if (updatedActivity.endTime && typeof updatedActivity.endTime === 'string') {
          const endTimeAMPM = convertToAMPM(updatedActivity.endTime);
          formattedTime += ` - ${endTimeAMPM}`;
        }
      } else if ('time' in updatedActivity) {
        formattedTime = updatedActivity.time;
      }
      
      // Generate a unique ID for the new activity
      const newActivityId = `activity-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Create the new activity object
      const newActivity = {
        ...updatedActivity,
        id: newActivityId,
        time: formattedTime
      };
      
      // Add the activity to the itinerary
      if (onAddActivity) {
        // If external handler is provided, call it and let it handle the activity creation
        onAddActivity(dayNumber, newActivity);
      } else {
        // Use the internal addActivity function
        addActivity(dayNumber, newActivity);
      }
    }
    
    // Close the modal after saving
    setEditModalOpen(false);
    setCurrentActivity(null);
  };

  // Handle deleting an activity
  const handleDeleteActivity = (dayNumber: number, activityId: string) => {
    console.log('ItinerarySidebar: handleDeleteActivity called', { dayNumber, activityId });
    
    if (onDeleteActivity) {
      // Use the prop handler if provided
      onDeleteActivity(dayNumber, activityId);
    } else {
      // Use the context deleteActivity function directly
      deleteActivity(dayNumber, activityId);
    }
    
    // Force a component update to ensure UI reflects the deletion
    setSelectedDay(selectedDay); // Re-set the same value to trigger a re-render
  };

  // Handle saving the itinerary
  const handleSaveItinerary = () => {
    if (onSaveItinerary) {
      onSaveItinerary();
    } else {
      // Default implementation if no prop provided
      saveItinerary("My Itinerary");
    }
  };

  // Toggle between day view and list view
  const toggleViewMode = () => {
    setViewMode(viewMode === "day" ? "list" : "day");
  };

  // Helper function to ensure activity has required id
  const ensureActivityId = (activity: Activity): Activity & { id: string } => {
    return {
      ...activity,
      id: activity.id || `activity-${Date.now()}-${Math.random()}`
    };
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Itinerary header */}
      <div className="px-8 pt-5 pb-4 border-b bg-white">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={itineraryTitle}
                onChange={(e) => setItineraryTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyPress}
                className="border-b border-slate-300 focus:border-blue-500 focus:outline-none py-1 px-0 bg-transparent"
                autoFocus
              />
            ) : (
              <button
                onClick={handleTitleEdit}
                className="hover:text-blue-600 transition-colors focus:outline-none"
              >
                {itineraryTitle}
              </button>
            )}
          </h1>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-slate-600">
              <CalendarIcon className="h-5 w-5 mr-2 text-slate-500" />
              <span className="text-sm">
                {itineraryDays.length > 0 
                  ? itineraryDays.length === 1 
                    ? formatDate(itineraryDays[0].date, 'MM/DD')
                    : `${itineraryDays.length} days` 
                  : "0 days"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleViewMode}
              className="h-8 px-3 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:ring-blue-500 transition-colors text-slate-700 text-sm rounded"
            >
              <ListIcon className="h-4 w-4 mr-1.5" />
              {viewMode === "day" ? "List View" : "Day View"}
            </Button>
          </div>
        </div>
      </div>

      {/* Day selector area - Only show in day view */}
      {viewMode === "day" && (
        <div className="px-8 py-4 bg-white flex justify-between items-center border-b">
          <h3 className="text-lg font-medium text-slate-700">Select Day:</h3>
          
          {/* Day selector */}
          <div className="flex items-center">
            <Select
              value={selectedDay}
              onValueChange={setSelectedDay}
            >
              <SelectTrigger className="w-[260px] h-10 border border-slate-200 rounded shadow-sm">
                <SelectValue placeholder="Select a day" />
              </SelectTrigger>
              <SelectContent>
                {itineraryDays.map((day) => (
                  <SelectItem key={day.dayNumber} value={day.dayNumber.toString()}>
                    {formatDate(day.date, 'full')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Day title and Add button - Removed border-b */}
      <div className="px-8 py-4 bg-white flex justify-between items-center">
        <h3 className="text-2xl font-medium text-slate-800">
          {selectedDay !== "all" ? (
            <>
              {`Day ${selectedDay}`}
              {viewMode === "day" && itineraryDays.length > 0 && (
                <>
                  {": "}
                  {formatDate(
                    itineraryDays.find(d => d.dayNumber === parseInt(selectedDay))?.date || '', 
                    'monthDay'
                  )}
                </>
              )}
            </>
          ) : (
            itineraryDays.length === 1 ? 
              formatDate(itineraryDays[0].date, 'monthDay') : 
              "All Days"
          )}
        </h3>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const dayNum = selectedDay !== "all" ? parseInt(selectedDay) : 0;
            handleAddActivity(dayNum);
          }}
          className="h-10 px-4 rounded border-slate-200 shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Activity list */}
      <ScrollArea className="flex-1 p-4 bg-gray-50">
        {viewMode === "day" ? (
          // Day view
          <>
            {selectedDay !== "all" && (
              <div className="space-y-4">
                {itineraryDays
                  .filter((day) => day.dayNumber === parseInt(selectedDay))
                  .map((day) => (
                    <div key={day.dayNumber} className="space-y-4">
                      {day.activities.length === 0 ? (
                        <div>
                          <div className="text-center py-4 text-slate-500 mb-4">
                            No activities planned for this day yet. Add activities using the chat.
                          </div>
                          <div className="bg-white rounded-lg shadow p-4 mb-4 border border-slate-200">
                            <div className="text-sm font-medium text-slate-900 mb-2">Sample Activity</div>
                            <div className="text-xs text-slate-500 mb-2">9:00 AM - 11:00 AM</div>
                            <div className="text-sm mb-2">This is where your activity details will appear.</div>
                            <div className="text-xs text-slate-500">Location: Your destination</div>
                          </div>
                        </div>
                      ) : (
                        getActivitiesWithUniqueIds(day.activities).map((activity) => (
                          <ActivityCard
                            key={activity.id || `activity-${activity.title}-${Math.random()}`}
                            activity={{
                              ...activity,
                              id: activity.id || `activity-${Date.now()}-${Math.random()}`
                            }}
                            onEdit={(id) => handleEditActivity(parseInt(selectedDay), id)}
                            onDelete={(id) => handleDeleteActivity(parseInt(selectedDay), id)}
                          />
                        ))
                      )}
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          // List view
          <ItineraryDayList
            days={itineraryDays.map(day => ({
              activities: day.activities,
              date: day.date,
              dayNumber: day.dayNumber
            }))}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            onEditDay={handleAddActivity}
          />
        )}
      </ScrollArea>

      {/* Activity edit modal */}
      {editModalOpen && currentActivity && (
        <ActivityEditModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setCurrentActivity(null);
          }}
          activity={{
            id: currentActivity.id,
            title: currentActivity.title || '',
            description: currentActivity.description || '',
            location: currentActivity.location || '',
            date: currentActivity.dayDate || new Date(),
            startTime: currentActivity.parsedStartTime || "12:00",
            endTime: currentActivity.parsedEndTime || "",
            imageUrl: currentActivity.imageUrl || '',
            type: currentActivity.type || 'Activity'
          } as ActivityEditModalActivity}
          onSave={handleSaveActivity}
          isNewActivity={!currentActivity.id}
          placeholders={{
            title: "Enter activity title...",
            description: "Describe your activity...",
            location: "Enter location..."
          }}
        />
      )}
    </div>
  );
});

export default ItinerarySidebar;
