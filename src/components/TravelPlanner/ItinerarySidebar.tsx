import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
// Type imports
import { Activity, ItineraryDay } from "../../types";

// Hook imports
import { useItinerary } from '../../contexts/ItineraryContext';
import { useNavigate } from 'react-router-dom';
import { useActivityOperations } from "../../hooks/useActivityOperations";

// Utility imports
import { format, isValid, isToday, parse, parseISO } from 'date-fns';
import { convertTo24Hour, convertToAMPM, formatTimeRange, parseTimeString } from "../../utils/timeUtils";
import { formatDate, addOrdinalSuffix, safeParseDate } from "../../utils/dateUtils";
import { getActivityIdSafely, ensureActivityId } from "../../utils/activityUtils";
import { cn } from '../../lib/utils';
import { generateItineraryTitle } from "../../utils/itineraryUtils";

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
import { useToast } from "../ui/use-toast";

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
  onSaveItinerary?: (title?: string) => void;
  onShareItinerary?: () => void;
  onExportItinerary?: () => void;
  onPrintItinerary?: () => void;
  onRefreshItinerary?: () => void;
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
  const { 
    itineraryDays, 
    saveItinerary, 
    forceRefresh,
    addDay,
    currentItineraryTitle,
    setCurrentItineraryTitle,
    getCurrentItineraryTitle
  } = useItinerary();
  const { toast } = useToast(); // Add toast hook
  
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"day" | "list">("day");
  
  // Log whenever itinerary days change to help with debugging
  useEffect(() => {
    // Use a debounced logging approach to avoid excessive logs
    const itineraryLength = itineraryDays.length;
    console.log(`ItinerarySidebar: itineraryDays updated, length: ${itineraryLength}`);
    
    // Only execute selection logic if needed (days available but none selected)
    if (itineraryLength > 0 && (selectedDay === "all" || !selectedDay)) {
      setSelectedDay(itineraryDays[0].dayNumber.toString());
      setViewMode("day");
    } else if (itineraryLength === 0 && selectedDay !== "all") {
      setSelectedDay("all");
    }
  }, [itineraryDays, selectedDay]);
  
  // Use our custom hook for activity operations
  const {
    editModalOpen,
    setEditModalOpen,
    currentActivity,
    setCurrentActivity,
    handleAddActivity: activityHookAdd,
    handleEditActivity: activityHookEdit,
    handleSaveActivity: activityHookSave,
    handleDeleteActivity: activityHookDelete,
    ensureActivityId
  } = useActivityOperations();
  
  // Title editing state  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // Handle title editing
  const handleTitleEdit = useCallback(() => {
    setIsEditingTitle(true);
    hasUserEditedTitle.current = true;
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, []);
  
  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
  }, []);
  
  const handleTitleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
      hasUserEditedTitle.current = true;
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, []);
  
  // Handle title changes
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentItineraryTitle(e.target.value);
    hasUserEditedTitle.current = true;
  }, [setCurrentItineraryTitle]);
  
  // Reset modal state on component mount
  useEffect(() => {
    // Immediately reset modal state when component mounts
    setEditModalOpen(false);
    setCurrentActivity(null);
    
    // Also provide a cleanup function
    return () => {
      setEditModalOpen(false);
      setCurrentActivity(null);
    };
  }, []); // Empty dependency array to run only on mount and unmount
  
  // UI loading state for save operation
  const [isSaving, setIsSaving] = useState(false);

  // Track if the user has manually edited the title
  const hasUserEditedTitle = useRef(false);

  // Generate and set a title based on destination and dates when the itinerary changes
  useEffect(() => {
    if (itineraryDays.length > 0) {
      // Get destination from activities - try to find the most relevant one
      const activities = itineraryDays.flatMap(day => day.activities);
      
      console.log('Auto-title generation - activities found:', activities.length);
      
      // Only proceed if we have activities to work with
      if (activities.length === 0) {
        console.log('Auto-title generation - skipped: no activities found');
        return;
      }
      
      // First check if there's an activity with "city" or "destination" type
      let destinationActivity = activities.find(activity => 
        activity.type?.toLowerCase().includes('destination') ||
        activity.type?.toLowerCase().includes('city')
      );
      
      // If not, try to find one with "sightseeing" type as those are often landmarks
      if (!destinationActivity) {
        destinationActivity = activities.find(activity => 
          activity.type?.toLowerCase().includes('sightseeing')
        );
      }
      
      // If we still don't have a destination activity, use the first activity with a meaningful location
      if (!destinationActivity) {
        destinationActivity = activities.find(activity => {
          const location = activity.location?.trim();
          return location && 
                 location.length > 0 && 
                 location !== 'Unknown' && 
                 location !== 'TBD' &&
                 !location.toLowerCase().includes('enter location');
        });
      }
      
      // Extract the city name from the location
      let destination = '';
      if (destinationActivity?.location) {
        const location = destinationActivity.location.trim();
        const addressParts = location.split(',');
        
        if (addressParts.length >= 2) {
          // Use the city part (typically the second segment of the address)
          destination = addressParts[1].trim();
        } else if (addressParts.length === 1 && addressParts[0].trim()) {
          // If there's only one part and it's not empty, use it
          destination = addressParts[0].trim();
        }
        
        // Clean up common words that shouldn't be in destination names
        destination = destination.replace(/^\d+\s+/, ''); // Remove leading numbers
        destination = destination.replace(/\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi, '').trim();
        
        // If destination is still too generic or empty, skip auto-generation
        if (!destination || 
            destination.length < 2 || 
            destination.toLowerCase().includes('unknown') ||
            destination.toLowerCase().includes('location') ||
            destination.toLowerCase() === 'tbd') {
          destination = '';
        }
      }
      
      console.log('Auto-title generation - extracted destination:', destination);
      console.log('Auto-title generation - current title:', currentItineraryTitle);
      console.log('Auto-title generation - hasUserEditedTitle:', hasUserEditedTitle.current);
      
      // Only proceed if we found a meaningful destination
      if (!destination) {
        console.log('Auto-title generation - skipped: no meaningful destination found');
        return;
      }
      
      // Only update if the title is still the default and user hasn't manually edited it
      const currentTitle = currentItineraryTitle;
      const isDefaultTitle = currentTitle === "My Itinerary" || !currentTitle.trim();
      
      // Only auto-generate titles for new itineraries if the user hasn't manually edited the title
      if (isDefaultTitle && !hasUserEditedTitle.current) {
        // Get dates from first and last day
        const sortedDays = [...itineraryDays].sort((a, b) => a.dayNumber - b.dayNumber);
        
        if (sortedDays.length > 0) {
          try {
            // Check for valid dates
            const startDate = sortedDays[0]?.date;
            const endDate = sortedDays[sortedDays.length - 1]?.date;
            
            console.log('Auto-title generation - dates:', { startDate, endDate });
            
            if (startDate && endDate) {
              const newTitle = generateItineraryTitle(destination, startDate || '', endDate || '');
              console.log('Auto-title generation - generated title:', newTitle);
              setCurrentItineraryTitle(newTitle);
            } else {
              // Default title with just destination if dates are missing
              const fallbackTitle = `Trip to ${destination}`;
              console.log('Auto-title generation - fallback title (no dates):', fallbackTitle);
              setCurrentItineraryTitle(fallbackTitle);
            }
          } catch (error) {
            // If date processing fails, just use destination
            const errorTitle = `Trip to ${destination}`;
            console.log('Auto-title generation - error title:', errorTitle, error);
            setCurrentItineraryTitle(errorTitle);
          }
        }
      } else {
        console.log('Auto-title generation - skipped because:', {
          isDefaultTitle,
          hasUserEditedTitle: hasUserEditedTitle.current
        });
      }
    }
  }, [itineraryDays, setCurrentItineraryTitle]); // Removed currentItineraryTitle from dependencies

  // Create an initial day when the component mounts if no days exist
  useEffect(() => {
    // Skip this effect if it's been run once
    const initialDayCreated = sessionStorage.getItem('initialDayCreated');
    
    if (itineraryDays.length === 0 && !initialDayCreated) {
      console.log('ItinerarySidebar: Creating initial day');
      
      // Instead of using activityHookAdd which opens the modal,
      // directly create an initial empty day
      const newDay = {
        dayNumber: 1,
        date: format(new Date(2025, 2, 17), 'yyyy-MM-dd'),
        activities: []
      };
      
      if (typeof addDay === 'function') {
        addDay(newDay);
      }
      
      // Mark that we've created the initial day
      sessionStorage.setItem('initialDayCreated', 'true');
    }
  }, [itineraryDays.length, addDay]);

  // Update selected day when the current selected day has no activities
  useEffect(() => {
    // Skip this check if in list view
    if (selectedDay === "list") return;
    
    // Check if the currently selected day exists and has no activities
    const selectedDayObj = itineraryDays.find(day => day.dayNumber === parseInt(selectedDay));

    if (selectedDayObj && selectedDayObj.activities.length === 0) {
      // Find the first day with activities
      const dayWithActivities = itineraryDays.find(day => day.activities.length > 0);
      
      if (dayWithActivities) {
        setSelectedDay(dayWithActivities.dayNumber.toString());
      } else {
        // If no days with activities, set to list view
        setSelectedDay("list");
        setViewMode("list");
      }
    }
  }, [itineraryDays, selectedDay]);
  
  // Using useRef to store already processed IDs to prevent repeated fixes on every render
  const processedActivityIds = useRef(new Set<string>());
  
  // Memoize the getActivitiesWithUniqueIds function to avoid unnecessary recomputation
  const getActivitiesWithUniqueIds = useCallback((activities: Activity[]): Activity[] => {
    // If no activities, return empty array
    if (!activities || activities.length === 0) {
      return [];
    }
    
    // Fast path: check if all activity IDs are already processed
    if (activities.every(a => a.id && processedActivityIds.current.has(a.id))) {
      return activities;
    }
    
    // Process in a single pass - more efficient than two separate functions
    const idMap = new Map<string, boolean>();
    const result: Activity[] = [];
    
    for (const activity of activities) {
      const safeId = getActivityIdSafely(activity.id);
      
      // Skip processing if already handled in a previous render
      if (processedActivityIds.current.has(safeId)) {
        result.push(activity);
        idMap.set(safeId, true);
        continue;
      }
      
      // If this ID is already seen in this batch, generate a new one
      if (idMap.has(safeId)) {
        const newId = getActivityIdSafely(undefined);
        const updatedActivity = { ...activity, id: newId };
        result.push(updatedActivity);
        idMap.set(newId, true);
        processedActivityIds.current.add(newId);
      } else {
        // No duplicate, keep original and mark as processed
        result.push(activity);
        idMap.set(safeId, true);
        processedActivityIds.current.add(safeId);
      }
    }
    
    return result;
  }, []);

  // Get the date range for display - memoize based on itineraryDays
  const dateRange = useMemo(() => {
    if (!itineraryDays || itineraryDays.length === 0) {
      return "No dates selected";
    }
    
    const sortedDays = [...itineraryDays].sort((a, b) => a.dayNumber - b.dayNumber);
    
    // Check if days have valid dates
    if (!sortedDays[0]?.date || !sortedDays[sortedDays.length - 1]?.date) {
      return "No dates selected";
    }
    
    // Use safeParseDate for safe date parsing with consistent error handling
    const startDate = safeParseDate(sortedDays[0].date);
    const endDate = safeParseDate(sortedDays[sortedDays.length - 1].date);
    
    // Debug logging to identify any date parsing issues
    console.log('Date Range Calculation:', {
      startDateStr: sortedDays[0].date,
      parsedStartDate: startDate,
      startMonth: startDate.getMonth() + 1,
      startDay: startDate.getDate(),
      startYear: startDate.getFullYear(),
      endDateStr: sortedDays[sortedDays.length - 1].date,
      parsedEndDate: endDate,
      endMonth: endDate.getMonth() + 1,
      endDay: endDate.getDate(),
      endYear: endDate.getFullYear()
    });
    
    // Only format if both dates are valid
    if (!isValid(startDate) || !isValid(endDate)) {
      return "No dates selected";
    }
    
    // Always include month in both parts of the range for clarity
    return `${formatDate(startDate, 'MM/DD', 'N/A')} - ${formatDate(endDate, 'MM/DD', 'N/A')}`;
  }, [itineraryDays]);

  // Get the title for the current day - memoize based on selectedDay and itineraryDays
  const dayTitle = useMemo(() => {
    if (selectedDay === "all") return "All Days";
    
    const dayNumber = parseInt(selectedDay);
    const day = itineraryDays.find((d) => d.dayNumber === dayNumber);
    
    if (!day) return `Day ${selectedDay}`;
    if (!day.date) return `Day ${dayNumber}`;
    
    const dayDate = safeParseDate(day.date);
    if (!isValid(dayDate)) return `Day ${dayNumber}`;
    
    return `Day ${day.dayNumber}: ${formatDate(dayDate, 'monthDay', '')}`;
  }, [selectedDay, itineraryDays]);

  // Wrapper functions that use the hook functionality but also call the prop callbacks if provided
  const handleAddActivity = useCallback((dayNumber: number, activity?: Activity) => {
    console.log('ItinerarySidebar: handleAddActivity called', { dayNumber });
    
    const createdDayNumber = activityHookAdd(dayNumber);
    setSelectedDay(createdDayNumber?.toString() || dayNumber.toString());
    
    if (onAddActivity) {
      // Use the prop handler if provided
      onAddActivity(dayNumber, activity);
    }
  }, [activityHookAdd, onAddActivity, setSelectedDay]);

  const handleEditActivity = useCallback((dayNumber: number, activityId: string) => {
    console.log('ItinerarySidebar: handleEditActivity called', { dayNumber, activityId });
    
    activityHookEdit(dayNumber, activityId);
    
    if (onEditActivity) {
      // Use the prop handler if provided
      onEditActivity(dayNumber, activityId);
    }
  }, [activityHookEdit, onEditActivity]);

  const handleSaveActivity = useCallback((activity: Activity, selectedDayNumber: number) => {
    console.log('ItinerarySidebar: handleSaveActivity', { activity, selectedDayNumber });
    
    const success = activityHookSave(activity, selectedDayNumber.toString());
    
    if (success && !activity.id && activity.dayDate) {
      const activityDate = format(activity.dayDate, 'yyyy-MM-dd');
      const existingDay = itineraryDays.find(day => day.date === activityDate);
      if (existingDay) {
        setSelectedDay(existingDay.dayNumber.toString());
      }
    }
    
    if (onUpdateActivity && selectedDayNumber && activity.id) {
      // Use the prop handler if provided
      onUpdateActivity(selectedDayNumber, activity.id, activity);
    }
  }, [activityHookSave, onUpdateActivity, itineraryDays, setSelectedDay]);

  const handleDeleteActivity = useCallback((dayNumber: number, activityId: string) => {
    console.log('ItinerarySidebar: handleDeleteActivity called', { dayNumber, activityId });
    
    activityHookDelete(dayNumber, activityId);
    
    if (onDeleteActivity) {
      // Use the prop handler if provided
      onDeleteActivity(dayNumber, activityId);
    }
    
    // Force a component update to ensure UI reflects the deletion
    setSelectedDay(selectedDay); // Re-set the same value to trigger a re-render
  }, [activityHookDelete, onDeleteActivity, selectedDay]);

  // Handle saving the itinerary
  const handleSaveItinerary = useCallback(async () => {
    if (isSaving) return; // Prevent multiple clicks
    
    console.log('ItinerarySidebar: handleSaveItinerary called with title:', currentItineraryTitle);
    console.log('ItinerarySidebar: hasUserEditedTitle:', hasUserEditedTitle.current);
    
    setIsSaving(true);
    try {
      if (onSaveItinerary) {
        console.log('ItinerarySidebar: Calling onSaveItinerary with title:', currentItineraryTitle);
        onSaveItinerary(currentItineraryTitle);
        // Toast will be handled by the parent component
      } else {
        // Default implementation if no prop provided
        console.log('ItinerarySidebar: Using default save with title:', currentItineraryTitle);
        const itineraryId = await saveItinerary(currentItineraryTitle);
        
        // Show toast notification only if save was successful
        if (itineraryId) {
          // Use the toast component from UI library
          toast({
            title: "Trip Saved!",
            description: "Your itinerary has been saved successfully.",
            variant: "travel",
          });
        }
      }
    } catch (error) {
      console.error('Error saving itinerary:', error);
      // Show error toast
      toast({
        title: "Save Failed",
        description: "There was an error saving your itinerary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [onSaveItinerary, saveItinerary, currentItineraryTitle, isSaving, toast]);

  // Now add memoization for all computed values
  
  // Memoize the filtered days for day view
  const filteredDayForDayView = useMemo(() => 
    itineraryDays.filter((day) => day.dayNumber === parseInt(selectedDay)),
    [itineraryDays, selectedDay]
  );

  // Memoize filtered days with activities for list view
  const daysWithActivities = useMemo(() => 
    itineraryDays
      .filter(day => day.activities.length > 0)
      .map(day => ({
        activities: day.activities,
        date: day.date,
        dayNumber: day.dayNumber
      })),
    [itineraryDays]
  );

  // Memoize the current selected day information
  const selectedDayData = useMemo(() => {
    if (selectedDay !== "all") {
      const day = itineraryDays.find(d => d.dayNumber === parseInt(selectedDay));
      return {
        date: day?.date || '',
        formattedDate: formatDate(day?.date || '', 'monthDay')
      };
    }
    return {
      date: '',
      formattedDate: itineraryDays.length === 1 ? 
        formatDate(itineraryDays[0]?.date || '', 'monthDay') : 
        "All Days"
    };
  }, [itineraryDays, selectedDay]);

  // Memoize the itinerary days summary
  const itineraryDaysSummary = useMemo(() => {
    if (itineraryDays.length > 0) {
      return itineraryDays.length === 1 
        ? formatDate(itineraryDays[0].date, 'dayAndDate')
        : dateRange;
    }
    return "No dates selected";
  }, [itineraryDays, dateRange]);

  return (
    <div className="h-full flex flex-col bg-gray-185">
      {/* Itinerary header */}
      <div className="px-8 pt-5 pb-4 border-b bg-white">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={currentItineraryTitle}
                onChange={handleTitleChange}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyPress}
                className="w-full border-b border-slate-300 focus:border-blue-500 focus:outline-none py-1 px-0 bg-transparent"
                autoFocus
              />
            ) : (
              <div 
                className="flex items-center cursor-text" 
                onClick={handleTitleEdit}
              >
                <span>{currentItineraryTitle}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTitleEdit();
                  }}
                  className="ml-4 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </h1>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-slate-400">
              <CalendarIcon className="h-4 w-4 mr-2 text-slate-400" />
              <span className="text-sm">
                {itineraryDaysSummary}
              </span>
            </div>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="flex items-center h-8 px-3 text-xs"
                onClick={handleSaveItinerary}
                disabled={itineraryDays.length === 0 || isSaving}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center h-8 px-3 text-xs"
                onClick={onShareItinerary}
                disabled={!onShareItinerary}
              >
                <Share className="h-3.5 w-3.5 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Day selector area - Always show */}
      <div className="px-8 py-2 bg-white flex justify-between items-center border-b">
        <h3 className="text-base font-medium text-slate-700">Select View:</h3>
        
        {/* Day/List selector */}
        <div className="flex items-center">
          <Select
            value={selectedDay}
            onValueChange={(value) => {
              setSelectedDay(value);
              // Set view mode based on selection
              setViewMode(value === "list" ? "list" : "day");
            }}
          >
            <SelectTrigger className={`w-[180px] h-8 border border-slate-200 rounded shadow-sm pr-1 ${selectedDay === "list" ? "font-bold" : ""}`}>
              <SelectValue placeholder="Select a view" />
            </SelectTrigger>
            <SelectContent>
              {itineraryDays
                .filter(day => day.activities.length > 0)
                .map((day) => (
                  <SelectItem key={day.dayNumber} value={day.dayNumber.toString()}>
                    {formatDate(day.date, 'dayAndDate')}
                  </SelectItem>
                ))}
              <SelectItem value="list" className="font-bold">List View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day title and Add button - Only shown in day view */}
      {viewMode === "day" && (
        <div className="px-8 py-4 bg-gray-185 flex justify-between items-center">
          <h3 className="text-xl font-medium text-slate-700">
            {selectedDayData.formattedDate}
          </h3>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dayNum = selectedDay !== "all" ? parseInt(selectedDay) : 0;
              console.log("[Add Item Button] clicked - dayNum:", dayNum);
              
              // Get the appropriate day
              const day = itineraryDays.find(d => d.dayNumber === dayNum);
              const defaultDate = day ? safeParseDate(day.date) : new Date();
              
              // Set minimal activity data needed for the modal
              setCurrentActivity({
                id: "", // Empty ID indicates a new activity
                title: "",
                description: "",
                location: "",
                time: "12:00 PM",
                type: "Activity",
                imageUrl: "",
                dayDate: defaultDate,
                dayNumber: dayNum
              });
              
              // Open the modal directly
              setEditModalOpen(true);
            }}
            className="h-8 px-3 border border-green-300 shadow-none bg-green-50 hover:bg-green-100 hover:border-green-300 focus:ring-green-500 transition-colors text-green-600 text-sm rounded"
          >
            <Plus className="h-4 w-4 mr-1.5 text-green-600" />
            Add Item
          </Button>
        </div>
      )}

      {/* Activity list */}
      <ScrollArea className="flex-1 pb-4 pl-4 pr-8 bg-gray-185">
        {viewMode === "day" ? (
          // Day view
          <>
            {selectedDay !== "all" && (
              <div className="space-y-4 pl-3">
                {filteredDayForDayView.map((day) => (
                  <div key={day.dayNumber} className="space-y-4">
                    {day.activities.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-slate-500 mb-4 text-lg">No items planned for this day yet.</p>
                        <button 
                          onClick={() => {
                            console.log("[Add your first item] clicked - dayNumber:", day.dayNumber);
                            
                            // Get the date for this day
                            const defaultDate = safeParseDate(day.date);
                            
                            // Set minimal activity data needed for the modal
                            setCurrentActivity({
                              id: "", // Empty ID indicates a new activity
                              title: "",
                              description: "",
                              location: "",
                              time: "12:00 PM",
                              type: "Activity",
                              imageUrl: "",
                              dayDate: defaultDate,
                              dayNumber: day.dayNumber
                            });
                            
                            // Open the modal directly
                            setEditModalOpen(true);
                          }}
                          className="text-slate-800 font-medium hover:text-blue-600 transition-colors"
                        >
                          Add your first item
                        </button>
                      </div>
                    ) : (
                      getActivitiesWithUniqueIds(day.activities).map((activity) => (
                        <ActivityCard
                          key={getActivityIdSafely(activity.id)}
                          activity={ensureActivityId(activity)}
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
            days={daysWithActivities}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            onEditDay={handleAddActivity}
            setCurrentActivity={setCurrentActivity}
            setEditModalOpen={setEditModalOpen}
          />
        )}
      </ScrollArea>

      {/* Activity edit modal */}
      <ActivityEditModal
        open={editModalOpen}
        onOpenChange={(open) => {
          console.log("[ItinerarySidebar] ActivityEditModal onOpenChange:", open);
          setEditModalOpen(open);
          if (!open) setCurrentActivity(null);
        }}
        activity={currentActivity || {
          id: '',
          title: '',
          description: '',
          location: '',
          date: new Date(),
          startTime: "12:00",
          endTime: "",
          imageUrl: '',
          type: 'Activity'
        }}
        onSave={(modalActivity) => {
          const dayNum = selectedDay !== "all" && selectedDay !== "list" 
            ? parseInt(selectedDay) 
            : (currentActivity?.dayNumber || itineraryDays[0]?.dayNumber || 1);
          console.log('[ItinerarySidebar] ActivityEditModal onSave - dayNum:', dayNum, 'activity:', modalActivity);
          handleSaveActivity(modalActivity, dayNum);
        }}
        isNewActivity={!currentActivity?.id}
        placeholders={{
          title: "Enter activity title...",
          description: "Describe your activity...",
          location: "Enter location..."
        }}
      />
    </div>
  );
});

export default ItinerarySidebar;
