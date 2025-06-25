import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format, set, isValid } from "date-fns";
import { CalendarIcon, Clock, MapPin } from "lucide-react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Activity, ActivityEditModalProps } from "../../types";
import { convertTo24Hour } from "../../utils/timeUtils";

// Helper function to convert 12-hour time to 24-hour time for input fields
const convertTimeForInput = (timeStr: string): string => {
  if (!timeStr) return "";
  
  console.log("Converting time:", timeStr);

  // Try to match patterns like "1:00 PM", "01:00 PM", "1:00PM", etc.
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
  if (match) {
    const [_, hours, minutes, period] = match;
    let hoursNum = parseInt(hours, 10);
    
    // Convert hours to 24-hour format
    if (period.toUpperCase() === 'PM' && hoursNum < 12) {
      hoursNum += 12;
    } else if (period.toUpperCase() === 'AM' && hoursNum === 12) {
      hoursNum = 0;
    }
    
    const result = `${hoursNum.toString().padStart(2, '0')}:${minutes}`;
    console.log(`Converted ${timeStr} to ${result}`);
    return result;
  }
  
  // If the time is already in 24-hour format (HH:MM)
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  console.warn("Could not parse time format:", timeStr);
  return "";
};

const ActivityEditModal: React.FC<ActivityEditModalProps> = React.memo(({
  open,
  onOpenChange,
  activity,
  onSave,
  isNewActivity = false,
  placeholders = {},
}) => {
  // Default time in 24-hour format (13:00 = 1:00 PM)
  const DEFAULT_TIME = "12:00";
  
  // State for form fields
  const [title, setTitle] = useState(activity?.title || "");
  const [description, setDescription] = useState(activity?.description || "");
  const [location, setLocation] = useState(activity?.location || "");
  const [date, setDate] = useState<Date | undefined>(activity?.date);
  const [startTime, setStartTime] = useState(DEFAULT_TIME);
  const [endTime, setEndTime] = useState("");
  const [imageUrl, setImageUrl] = useState(activity?.imageUrl || "");
  const [activityType, setActivityType] = useState(activity?.type || "activity");

  // For debugging: Log activity when it changes
  useEffect(() => {
    if (activity) {
      console.log("[ActivityEditModal] Activity passed to edit modal:", activity);
    }
  }, [activity]);

  // Add debug logging for modal open state
  useEffect(() => {
    console.log("[ActivityEditModal] Modal open state changed:", open);
    console.log("[ActivityEditModal] Is new activity:", isNewActivity);
  }, [open, isNewActivity]);

  // Update state when activity prop changes
  useEffect(() => {
    if (activity) {
      setTitle(activity.title || "");
      setDescription(activity.description || "");
      setLocation(activity.location || "");
      setDate(activity.date);
      
      // Log all time-related fields for debugging
      console.log("Activity time field:", activity.time);
      console.log("Time properties:", {
        time: activity.time,
        startTime: activity.startTime,
        endTime: activity.endTime,
        displayStartTime: activity.displayStartTime,
        displayEndTime: activity.displayEndTime,
      });
      
      // IMPORTANT: First try to use the visible time from the activity card
      if (activity.time) {
        // The activity.time field is what's displayed on the card
        // Example: "2:00 PM" or "2:00 PM - 4:00 PM"
        const timeString = activity.time;
        console.log("Using activity.time:", timeString);
        
        // Check if it's a time range
        if (timeString.includes(" - ")) {
          // Split and convert both times
          const [start, end] = timeString.split(" - ");
          const startIn24hr = convertTimeForInput(start.trim());
          const endIn24hr = convertTimeForInput(end.trim());
          
          console.log(`Setting time range: ${startIn24hr} - ${endIn24hr}`);
          
          if (startIn24hr) {
            setStartTime(startIn24hr);
          }
          
          if (endIn24hr) {
            setEndTime(endIn24hr);
          }
        } else {
          // Single time
          const timeIn24hr = convertTimeForInput(timeString.trim());
          
          console.log(`Setting single time: ${timeIn24hr}`);
          
          if (timeIn24hr) {
            setStartTime(timeIn24hr);
          }
        }
      } else if (activity.startTime) {
        // Direct startTime value (if available)
        setStartTime(activity.startTime);
        if (activity.endTime) {
          setEndTime(activity.endTime);
        }
      }
      
      setImageUrl(activity.imageUrl || "");
      setActivityType(activity.type || "activity");
    }
  }, [activity]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Small delay to ensure animation completes before resetting state
      const timer = setTimeout(() => {
        setTitle("");
        setDescription("");
        setLocation("");
        setDate(undefined);
        setStartTime(DEFAULT_TIME);
        setEndTime("");
        setImageUrl("");
        setActivityType("activity");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Form validation
  const isFormValid = useMemo(() => 
    title.trim() !== "" && (startTime !== "" || (activity?.time && activity.time !== "")),
    [title, startTime, activity?.time]
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (isFormValid) {
      console.log("[ActivityEditModal] Saving activity:", {
        title,
        description,
        location,
        startTime,
        endTime,
        type: activityType,
        date
      });
      
      onSave({
        ...activity,
        title,
        description,
        location,
        startTime,
        endTime,
        imageUrl: activity?.imageUrl || "",
        type: activityType,
        dayDate: date, // Pass the selected date back to parent component
        dayNumber: activity?.dayNumber // Preserve the day number if it exists
      });
    }
  }, [isFormValid, onSave, activity, title, description, location, startTime, endTime, imageUrl, activityType, date]);

  // Memoize handler functions
  const handleCancel = useCallback(() => {
    console.log("[ActivityEditModal] Cancel button clicked");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  }, []);

  const handleLocationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
  }, []);

  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStartTime(e.target.value);
  }, []);

  const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndTime(e.target.value);
  }, []);

  const handleActivityTypeChange = useCallback((value: string) => {
    setActivityType(value);
  }, []);

  const handleDateChange = useCallback((selectedDate: Date | undefined) => {
    setDate(selectedDate);
  }, []);

  // Memoize formatted date string for display
  const formattedDate = useMemo(() => {
    if (!date) {
      return "Pick a date";
    }
    
    try {
      if (!isValid(date)) {
        return "Pick a date";
      }
      return format(date, "EEEE, MM/dd/yyyy");
    } catch (error) {
      return "Pick a date";
    }
  }, [date]);

  // Memoize dialog title
  const dialogTitle = useMemo(() => 
    isNewActivity ? "Add New Item" : "Edit Item",
    [isNewActivity]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Activity type selector */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="activity-type" className="col-span-4 mb-1">
              Type
            </Label>
            <Select value={activityType} onValueChange={handleActivityTypeChange}>
              <SelectTrigger id="activity-type" className="w-full min-w-[200px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="sightseeing">Sightseeing</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="relaxation">Relaxation</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="accommodation">Accommodation</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Title input */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="title" className="col-span-4 mb-1">
              Title
            </Label>
            <Input
              id="title"
              className="col-span-4"
              value={title}
              onChange={handleTitleChange}
              placeholder={placeholders.title || ""}
            />
          </div>
          
          {/* Description textarea */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="description" className="col-span-4 mb-1">
              Description
            </Label>
            <Textarea
              id="description"
              className="col-span-4"
              value={description}
              onChange={handleDescriptionChange}
              placeholder={placeholders.description || ""}
            />
          </div>
          
          {/* Location input */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="location" className="col-span-4 mb-1">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                <span>Location</span>
              </div>
            </Label>
            <Input
              id="location"
              className="col-span-4"
              value={location}
              onChange={handleLocationChange}
              placeholder={placeholders.location || ""}
            />
          </div>
          
          {/* Date selector */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="date" className="col-span-4 mb-1">
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1" />
                <span>Date</span>
              </div>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "col-span-4 justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formattedDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Time selectors */}
          <div className="grid grid-cols-4 gap-2">
            <Label className="col-span-4 mb-1">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>Time</span>
              </div>
            </Label>
            <div className="col-span-2">
              <Label htmlFor="start-time" className="text-xs text-slate-500 mb-1 block">
                Start
              </Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={handleStartTimeChange}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="end-time" className="text-xs text-slate-500 mb-1 block">
                End (optional)
              </Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={handleEndTimeChange}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button 
            variant="secondary" 
            onClick={handleCancel}
            className="mr-2"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isFormValid}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ActivityEditModal.displayName = 'ActivityEditModal';

export default ActivityEditModal;
