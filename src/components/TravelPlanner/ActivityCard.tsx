import React, { useState, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Edit2, Trash2, MapPin, Clock, ExternalLink } from "lucide-react";
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

interface Activity {
  id?: string;
  title: string;
  description: string;
  location: string;
  time: string;
  type?: string;
  imageUrl?: string;
}

interface ActivityCardProps {
  activity: Activity & { id: string };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

// Type styling configurations with improved visual design
const typeConfig: Record<string, { bgColor: string, textColor: string, icon?: React.ReactNode }> = {
  transportation: {
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  accommodation: {
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
  food: {
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  activity: {
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  sightseeing: {
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
  },
  default: {
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  }
};

// Get styling based on activity type
const getTypeStyles = (type: string = "") => {
  const key = type?.toLowerCase() || 'default';
  return typeConfig[key] || typeConfig.default;
};

// Wrap the component with React.memo to prevent unnecessary re-renders
const ActivityCard = React.memo<ActivityCardProps>(({
  activity,
  onEdit = () => {},
  onDelete = () => {},
  className
}) => {
  // Memoize derived values
  const startTime = useMemo(() => activity.time.split(" - ")[0], [activity.time]);
  const typeStyles = useMemo(() => getTypeStyles(activity.type), [activity.type]);
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const handleDelete = () => {
    console.log('Delete button clicked for activity:', activity.id);
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = () => {
    console.log('Delete confirmed for activity:', activity.id);
    onDelete(activity.id);
    setShowDeleteDialog(false);
  };
  
  return (
    <>
      <Card className={cn(
        "w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow", 
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Card header with activity time and actions */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium",
                typeStyles.bgColor,
                typeStyles.textColor,
                "border border-slate-200"
              )}>
                {activity.type || "Activity"}
              </span>
              
              <span className="text-sm text-slate-500 flex items-center">
                <Clock className="h-3 w-3 mr-1 text-slate-400" />
                <span>{startTime}</span>
              </span>
            </div>
            
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(activity.id)}
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
          
          {/* Activity details */}
          <div className="px-5 pb-4 flex-1 flex flex-col">
            <h3 className="text-xl font-semibold text-slate-900 mb-1 leading-tight">
              {activity.title}
            </h3>
            
            <p className="text-sm text-slate-600 mb-3 line-clamp-2 flex-grow">
              {activity.description}
            </p>
            
            {activity.location && (
              <div className="flex items-start mt-auto">
                <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 mr-1.5 flex-shrink-0" />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(activity.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center group"
                >
                  <span className="truncate max-w-[240px]">{activity.location}</span>
                  <ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Activity</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete "<span className="font-medium text-slate-900">{activity.title}</span>"? This action cannot be undone.
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
    </>
  );
});

// Add a displayName for debugging purposes
ActivityCard.displayName = 'ActivityCard';

export default ActivityCard;
