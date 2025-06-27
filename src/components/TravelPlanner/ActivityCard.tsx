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

// OPTIMIZED: Simpler component without excessive memoization
const ActivityCard = React.memo<ActivityCardProps>(({
  activity,
  onEdit = () => {},
  onDelete = () => {},
  className
}) => {
  // OPTIMIZED: Simple function calls don't need memoization
  const id = getActivityIdSafely(activity.id);
  
  // OPTIMIZED: Only memoize expensive time calculations
  const startTime = useMemo(() => {
    if (!activity.time) return "";
    const rawStartTime = activity.time.split(" - ")[0];
    return convertToAMPM(rawStartTime);
  }, [activity.time]);
  
  // OPTIMIZED: Direct property access and function calls - no memoization needed
  const typeStyles = getActivityTypeStyles(activity.type);
  const { title, description, location } = activity;
  const mapUrl = location ? `https://maps.google.com/?q=${encodeURIComponent(location)}` : "";
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // OPTIMIZED: Simple event handlers don't need useCallback unless they cause performance issues
  const handleEditClick = () => onEdit(id);
  const handleDelete = () => {
    console.log('Delete button clicked for activity:', id);
    setShowDeleteDialog(true);
  };
  const confirmDelete = () => {
    console.log('Delete confirmed for activity:', id);
    onDelete(id);
    setShowDeleteDialog(false);
  };
  const handleCloseDialog = (open: boolean) => setShowDeleteDialog(open);
  
  // OPTIMIZED: Simple string concatenation doesn't need memoization
  const cardClassName = cn(
    "w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow", 
    className
  );
  
  const typeTagClassName = cn(
    "text-xs px-2.5 py-1 rounded-xl font-medium", 
    typeStyles.bgColor,
    typeStyles.textColor,
    "border border-slate-200"
  );
  
  // OPTIMIZED: Remove unnecessary memoization - React is efficient at re-rendering JSX
  const renderActivityHeader = (
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
  );
  
  const renderActivityContent = (
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
  );
  
  const deleteDialog = (
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
  );
  
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
