import React, { useState, useEffect } from "react";
import { format, set } from "date-fns";
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

// Define Activity interface for better type checking
interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  imageUrl?: string;
  time?: string;
  date?: Date;
  startTime?: string;
  endTime?: string;
  type?: string;
  dayDate?: Date; // Add this to pass the selected day date back
}

interface ActivityEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  onSave: (activity: Activity) => void;
  isNewActivity?: boolean;
  placeholders?: {
    title?: string;
    description?: string;
    location?: string;
  };
}

const ActivityEditModal: React.FC<ActivityEditModalProps> = ({
  open,
  onOpenChange,
  activity,
  onSave,
  isNewActivity = false,
  placeholders = {},
}) => {
  // State for form fields
  const [title, setTitle] = useState(activity?.title || "");
  const [description, setDescription] = useState(activity?.description || "");
  const [location, setLocation] = useState(activity?.location || "");
  const [date, setDate] = useState<Date | undefined>(activity?.date);
  const [startTime, setStartTime] = useState(activity?.startTime || "");
  const [endTime, setEndTime] = useState(activity?.endTime || "");
  const [imageUrl, setImageUrl] = useState(activity?.imageUrl || "");
  const [activityType, setActivityType] = useState(activity?.type || "Activity");

  // Update state when activity prop changes
  useEffect(() => {
    if (activity) {
      setTitle(activity.title || "");
      setDescription(activity.description || "");
      setLocation(activity.location || "");
      setDate(activity.date);
      setStartTime(activity.startTime || "");
      setEndTime(activity.endTime || "");
      setImageUrl(activity.imageUrl || "");
      setActivityType(activity.type || "Activity");
    }
  }, [activity]);

  // Form validation
  const isFormValid = () => {
    return (
      title.trim() !== "" && 
      (startTime !== "" || (activity?.time && activity.time !== ""))
    );
  };

  // Handle save
  const handleSave = () => {
    if (isFormValid()) {
      onSave({
        ...activity,
        title,
        description,
        location,
        startTime,
        endTime,
        imageUrl,
        type: activityType,
        dayDate: date // Pass the selected date back to parent component
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isNewActivity ? "Add New Item" : "Edit Item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Activity type selector */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="activity-type" className="col-span-4 mb-1">
              Type
            </Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger id="activity-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Activity">Activity</SelectItem>
                <SelectItem value="Meal">Meal</SelectItem>
                <SelectItem value="Hotel">Hotel</SelectItem>
                <SelectItem value="Flight">Flight</SelectItem>
                <SelectItem value="Transportation">Transportation</SelectItem>
                <SelectItem value="Note">Note</SelectItem>
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
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setDescription(e.target.value)}
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
              onChange={(e) => setLocation(e.target.value)}
              placeholder={placeholders.location || ""}
            />
          </div>
          
          {/* Date & time selectors */}
          <div className="grid grid-cols-4 gap-2">
            <Label className="col-span-4 mb-1">
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1" />
                <span>Date</span>
              </div>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-4 justify-start text-left font-normal h-10",
                    !date && "text-slate-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Time inputs */}
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
                onChange={(e) => setStartTime(e.target.value)}
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
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          
          {/* Image URL input */}
          <div className="grid grid-cols-4 gap-2">
            <Label htmlFor="image-url" className="col-span-4 mb-1">
              Image URL (optional)
            </Label>
            <Input
              id="image-url"
              className="col-span-4"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button 
            variant="secondary" 
            onClick={() => onOpenChange(false)}
            className="mr-2"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isFormValid()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityEditModal;
