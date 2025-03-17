import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface ActivityEditModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activity?: {
    id: string;
    title: string;
    description: string;
    location: string;
    date: Date;
    startTime: string;
    endTime: string;
    imageUrl: string;
    type?: string;
  };
  onSave?: (activity: any) => void;
  isNewActivity?: boolean;
}

const ActivityEditModal = ({
  open = true,
  onOpenChange,
  activity = {
    id: "1",
    title: "Visit the Eiffel Tower",
    description:
      "Explore the iconic Eiffel Tower and enjoy panoramic views of Paris.",
    location: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France",
    date: new Date(),
    startTime: "10:00",
    endTime: "12:00",
    imageUrl:
      "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800&q=80",
    type: "Activity",
  },
  onSave = () => {},
  isNewActivity = false,
}: ActivityEditModalProps) => {
  const [title, setTitle] = React.useState(activity.title);
  const [description, setDescription] = React.useState(activity.description);
  const [location, setLocation] = React.useState(activity.location);
  const [date, setDate] = React.useState<Date | undefined>(activity.date);
  const [startTime, setStartTime] = React.useState(activity.startTime);
  const [endTime, setEndTime] = React.useState(activity.endTime);
  const [type, setType] = React.useState(activity.type || "Activity");

  const handleSave = () => {
    // Validate required fields
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    // Create the updated activity object
    const updatedActivity = {
      id: activity.id,
      title,
      description,
      location,
      date,
      startTime,
      endTime,
      imageUrl: activity.imageUrl,
      type,
    };

    // Call the onSave callback with the updated activity
    onSave(updatedActivity);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isNewActivity ? "Add Activity" : "Edit Activity"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Transportation">Transportation</SelectItem>
                <SelectItem value="Accommodation">Accommodation</SelectItem>
                <SelectItem value="Activity">Activity</SelectItem>
                <SelectItem value="Food">Food</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">
              Location
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <div className="col-span-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startTime" className="text-right">
              Start Time
            </Label>
            <div className="col-span-3 flex items-center">
              <Clock className="mr-2 h-4 w-4 text-gray-500" />
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endTime" className="text-right">
              End Time
            </Label>
            <div className="col-span-3 flex items-center">
              <Clock className="mr-2 h-4 w-4 text-gray-500" />
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityEditModal;
