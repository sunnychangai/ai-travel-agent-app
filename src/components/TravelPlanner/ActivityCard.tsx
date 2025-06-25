import React, { useState, useMemo, useCallback } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Edit2, Trash2, MapPin, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../ui/alert-dialog";
import { cn } from "../../lib/utils";
import { Activity } from "../../types";
import { getActivityIdSafely, getActivityTypeStyles } from "../../utils/activityUtils";
import { convertToAMPM } from "../../utils/timeUtils";

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

// Wrap the component with React.memo to prevent unnecessary re-renders
const ActivityCard = React.memo<ActivityCardProps>(({
  activity,
  onEdit = () => {},
  onDelete = () => {},
  className
}) => {
  // Use the utility function for ID generation
  const id = useMemo(() => getActivityIdSafely(activity.id), [activity.id]);
  
  // Memoize derived values
  const rawStartTime = useMemo(() => activity.time?.split(" - ")[0] || "", [activity.time]);
  const startTime = useMemo(() => convertToAMPM(rawStartTime), [rawStartTime]);
  const typeStyles = useMemo(() => getActivityTypeStyles(activity.type), [activity.type]);
  const title = useMemo(() => activity.title, [activity.title]);
  const description = useMemo(() => activity.description, [activity.description]);
  const location = useMemo(() => activity.location, [activity.location]);
  const mapUrl = useMemo(() => 
    location ? `https://maps.google.com/?q=${encodeURIComponent(location)}` : "",
    [location]
  );
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Memoize handler functions to prevent unnecessary re-renders
  const handleEditClick = useCallback(() => {
    onEdit(id);
  }, [onEdit, id]);
  
  const handleDelete = useCallback(() => {
    console.log('Delete button clicked for activity:', id);
    setShowDeleteDialog(true);
  }, [id]);
  
  const confirmDelete = useCallback(() => {
    console.log('Delete confirmed for activity:', id);
    onDelete(id);
    setShowDeleteDialog(false);
  }, [onDelete, id]);
  
  const handleCloseDialog = useCallback((open: boolean) => {
    setShowDeleteDialog(open);
  }, []);
  
  // Memoize computed class names
  const cardClassName = useMemo(() => 
    cn("w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow", className),
    [className]
  );
  
  const typeTagClassName = useMemo(() => 
    cn("text-xs px-2.5 py-1 rounded-xl font-medium", 
      typeStyles.bgColor,
      typeStyles.textColor,
      "border border-slate-200"
    ),
    [typeStyles]
  );
  
  // Memoize the render of activity header
  const renderActivityHeader = useMemo(() => (
    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={typeTagClassName}>
          {activity.type || "Activity"}
        </span>
        
        <span className="text-sm text-slate-500 flex items-center">
          <Clock className="h-3 w-3 mr-[3px] text-slate-400 flex-shrink-0 translate-y-[1px] scale-90" />
          <span className="leading-none">{startTime}</span>
        </span>
      </div>
      
      <div className="flex space-x-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEditClick}
          className="h-8 w-8 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Edit activity"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          aria-label="Delete activity"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ), [typeTagClassName, startTime, handleEditClick, handleDelete, activity.type]);
  
  // Memoize the render of activity content
  const renderActivityContent = useMemo(() => (
    <div className="px-5 pb-4 flex-1 flex flex-col">
      <h3 className="text-xl font-semibold text-slate-900 mb-1 leading-tight">
        {title}
      </h3>
      
      <p className="text-sm text-slate-600 mb-3 line-clamp-2 flex-grow">
        {description}
      </p>
      
      {location && (
        <div className="flex items-start mt-auto">
          <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 mr-1.5 flex-shrink-0" />
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <span className="truncate max-w-[240px]">{location}</span>
          </a>
        </div>
      )}
    </div>
  ), [title, description, location, mapUrl]);
  
  // Memoize the alert dialog component
  const deleteDialog = useMemo(() => (
    <AlertDialog open={showDeleteDialog} onOpenChange={handleCloseDialog}>
      <AlertDialogContent className="max-w-md rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Delete Activity</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            Are you sure you want to delete "<span className="font-medium text-slate-900">{title}</span>"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmDelete} 
            className="bg-red-500 hover:bg-red-600 rounded-full focus:ring-red-500"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ), [showDeleteDialog, handleCloseDialog, title, confirmDelete]);
  
  return (
    <>
      <Card className={cardClassName}>
        <div className="flex flex-col h-full">
          {renderActivityHeader}
          {renderActivityContent}
        </div>
      </Card>
      {deleteDialog}
    </>
  );
});

// Add a displayName for debugging purposes
ActivityCard.displayName = 'ActivityCard';

export default ActivityCard;
