import React, { useEffect, useState, useMemo } from "react";
import { Edit2, Trash2, Star } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import ActivityCard from "./ActivityCard";
import { timeToMinutes, sortActivitiesByTime } from "../../utils/timeUtils";
import useVirtualizedList from "../../hooks/useVirtualizedList";
import { Activity, ItineraryDay } from '../../types';

// Function to determine activity type based on title and description
const determineActivityType = (title: string, description: string): string => {
  const combinedText = `${title} ${description}`.toLowerCase();
  
  // Transportation keywords
  if (
    combinedText.includes('airport') ||
    combinedText.includes('train') ||
    combinedText.includes('bus') ||
    combinedText.includes('taxi') ||
    combinedText.includes('transfer') ||
    combinedText.includes('flight') ||
    combinedText.includes('arrival') ||
    combinedText.includes('departure') ||
    combinedText.includes('transit') ||
    combinedText.includes('transportation')
  ) {
    return 'Transportation';
  }
  
  // Accommodation keywords
  if (
    combinedText.includes('hotel') ||
    combinedText.includes('check-in') ||
    combinedText.includes('check in') ||
    combinedText.includes('check-out') ||
    combinedText.includes('check out') ||
    combinedText.includes('accommodation') ||
    combinedText.includes('stay') ||
    combinedText.includes('lodge') ||
    combinedText.includes('hostel') ||
    combinedText.includes('apartment') ||
    combinedText.includes('airbnb')
  ) {
    return 'Accommodation';
  }
  
  // Food keywords
  if (
    combinedText.includes('lunch') ||
    combinedText.includes('dinner') ||
    combinedText.includes('breakfast') ||
    combinedText.includes('brunch') ||
    combinedText.includes('meal') ||
    combinedText.includes('restaurant') ||
    combinedText.includes('café') ||
    combinedText.includes('cafe') ||
    combinedText.includes('food') ||
    combinedText.includes('eat') ||
    combinedText.includes('dining')
  ) {
    return 'Food';
  }
  
  // Default to Activity
  return 'Activity';
};

// Get background color based on activity type
const getTypeBackground = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'transportation':
      return 'bg-blue-100 text-blue-700 font-semibold border border-blue-300';
    case 'accommodation':
      return 'bg-purple-100 text-purple-700 font-semibold border border-purple-300';
    case 'food':
      return 'bg-orange-100 text-orange-700 font-semibold border border-orange-300';
    case 'activity':
      return 'bg-green-100 text-green-700 font-semibold border border-green-300';
    default:
      return 'bg-slate-100 text-slate-700 font-semibold border border-slate-300';
  }
};

interface ItineraryDayListProps {
  days: Array<{
    date: string;
    dayNumber: number;
    activities: Activity[];
  }>;
  onEditActivity?: (dayNumber: number, activityId: string) => void;
  onDeleteActivity?: (dayNumber: number, activityId: string) => void;
  onEditDay?: (dayNumber: number) => void;
  isReadOnly?: boolean;
}

const ACTIVITY_CARD_HEIGHT = 180; // Approximate height of activity card in pixels
const DAY_HEADER_HEIGHT = 60; // Approximate height of day header in pixels

// Ensure activity has an ID when passing to ActivityCard
const ensureActivityId = (activity: Activity): Activity & { id: string } => {
  return {
    ...activity,
    id: activity.id || `activity-${Date.now()}-${Math.random()}`
  };
};

const ItineraryDayList: React.FC<ItineraryDayListProps> = React.memo(({
  days,
  onEditActivity,
  onDeleteActivity,
  onEditDay,
  isReadOnly = false,
}) => {
  // Prepare flattened list for virtualization when in "all" mode
  const flattenedItems = useMemo(() => {
    // Only perform flattening if we have multiple days in "all" mode
    if (days.length <= 1) {
      return null;
    }

    const items: Array<{
      type: 'header' | 'activity';
      dayNumber: number;
      date?: string;
      activity?: Activity;
      dayIndex: number;
    }> = [];

    days.forEach((day, dayIndex) => {
      // Add header item
      items.push({
        type: 'header',
        dayNumber: day.dayNumber,
        date: day.date,
        dayIndex
      });

      // Add sorted activities
      sortActivitiesByTime(day.activities).forEach(activity => {
        items.push({
          type: 'activity',
          dayNumber: day.dayNumber,
          activity,
          dayIndex
        });
      });
    });

    return items;
  }, [days]);

  // Use virtualized list for "all" mode with many items
  const useVirtualization = flattenedItems && flattenedItems.length > 20;

  const {
    virtualItems,
    totalHeight,
    scrollRef,
    handleScroll
  } = useVirtualization
    ? useVirtualizedList(flattenedItems!, {
        itemHeight: ACTIVITY_CARD_HEIGHT,
        overscan: 5
      })
    : { virtualItems: null, totalHeight: 0, scrollRef: null, handleScroll: null };

  // Render using virtualization for "all" view with many items
  if (useVirtualization && virtualItems) {
    return (
      <div
        ref={scrollRef}
        className="overflow-auto h-full"
        style={{ height: '100%' }}
        onScroll={handleScroll as any}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {virtualItems.map(virtualItem => {
            const item = virtualItem.item;
            
            if (item.type === 'header') {
              // Render day header
              return (
                <div
                  key={`day-header-${item.dayNumber}`}
                  className={`flex justify-between items-center mb-4 pr-5 pl-3 ${
                    item.dayIndex > 0 ? "pt-6 mt-6 border-t border-gray-200" : "pt-2"
                  }`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    transform: `translateY(${virtualItem.offsetTop}px)`,
                    width: '100%'
                  }}
                >
                  <h2 className="text-lg font-medium text-slate-700">
                    {new Date(item.date!).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric'
                    })}
                  </h2>
                  <Button 
                    variant="outline"
                    className="h-8 px-3 border border-gray-200 shadow-sm bg-green-50 hover:bg-green-100 hover:border-gray-300 transition-colors text-sm font-medium text-green-700"
                    onClick={() => onEditDay?.(item.dayNumber)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 mr-1.5 text-green-600"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Item
                  </Button>
                </div>
              );
            } else {
              // Render activity card
              const activity = item.activity!;
              return (
                <div
                  key={activity.id || `activity-${activity.title}-${Math.random()}`}
                  className="space-y-4 px-3 pr-5"
                  style={{
                    position: 'absolute',
                    top: 0,
                    transform: `translateY(${virtualItem.offsetTop}px)`,
                    width: '100%'
                  }}
                >
                  <ActivityCard
                    activity={ensureActivityId(activity)}
                    onEdit={(id) => onEditActivity?.(item.dayNumber, id)}
                    onDelete={(id) => onDeleteActivity?.(item.dayNumber, id)}
                  />
                </div>
              );
            }
          })}
        </div>
      </div>
    );
  }

  // Use the original non-virtualized rendering for day view or smaller lists
  return (
    <div className={`space-y-8 ${days.length > 1 ? "pb-8 mt-1" : ""}`}>
      {days.map((day, index) => (
        <div key={day.dayNumber} className={`${index === 0 && days.length > 1 ? "pt-2" : ""}`}>
          {/* Show day header in "all" view mode */}
          {days.length > 1 && (
            <div className="flex justify-between items-center mb-4 pr-5 pl-3">
              <h2 className="text-lg font-medium text-slate-700">
                {new Date(day.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric'
                })}
              </h2>
              <Button 
                variant="outline"
                className="h-8 px-3 border border-gray-200 shadow-sm bg-green-50 hover:bg-green-100 hover:border-gray-300 transition-colors text-sm font-medium text-green-700"
                onClick={() => onEditDay?.(day.dayNumber)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 mr-1.5 text-green-600"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Item
              </Button>
            </div>
          )}
          
          {/* Sort activities by time before rendering */}
          <div className="space-y-4 px-3 pr-5">
            {sortActivitiesByTime(day.activities).map((activity) => (
              <ActivityCard
                key={activity.id || `activity-${activity.title}-${activity.time}`}
                activity={ensureActivityId(activity)}
                onEdit={(id) => onEditActivity?.(day.dayNumber, id)}
                onDelete={(id) => onDeleteActivity?.(day.dayNumber, id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

ItineraryDayList.displayName = 'ItineraryDayList';

export default ItineraryDayList;
