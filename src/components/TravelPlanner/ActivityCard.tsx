import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Edit, Trash2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityCardProps {
  id?: string;
  title?: string;
  description?: string;
  image?: string;
  address?: string;
  date?: string;
  time?: string;
  duration?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ActivityCard = ({
  id = "activity-1",
  title = "Visit the Eiffel Tower",
  description = "Enjoy panoramic views of Paris from the iconic Eiffel Tower. Consider going during sunset for a magical experience.",
  image = "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&q=80",
  address = "7 Champ de Mars, 75007 Paris, France",
  date = "June 15, 2023",
  time = "10:00 AM",
  duration = "2 hours",
  onEdit = () => {},
  onDelete = () => {},
}: ActivityCardProps) => {
  return (
    <Card className="w-full max-w-[580px] overflow-hidden bg-white border shadow-sm">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-1/3 h-[180px] md:h-auto">
          <img src={image} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="md:w-2/3 flex flex-col">
          <CardHeader className="pb-2 pt-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">{title}</h3>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(id)}
                  className="h-8 w-8 text-gray-500 hover:text-blue-600"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(id)}
                  className="h-8 w-8 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-0">
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {description}
            </p>
            <div className="flex items-center text-xs text-gray-500 mb-1">
              <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              <span className="truncate">{address}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <div className="flex items-center text-xs text-gray-500">
                <Calendar className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                <span>{date}</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <Clock className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                <span>{time}</span>
              </div>
              {duration && (
                <div className="flex items-center text-xs text-gray-500">
                  <span className="font-medium">Duration:</span>
                  <span className="ml-1">{duration}</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="pt-0 pb-4">
            <div className="flex justify-end w-full">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => onEdit(id)}
              >
                View Details
              </Button>
            </div>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
};

export default ActivityCard;
