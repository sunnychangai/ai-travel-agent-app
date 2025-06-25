import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Edit2, Trash2, Star } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import ActivityCard from "./ActivityCard";
import { timeToMinutes, sortActivitiesByTime } from "../../utils/timeUtils";
import { formatDate } from "../../utils/dateUtils";
import { ensureActivityId, getActivityIdSafely, getActivityTypeStyles, determineActivityType } from "../../utils/activityUtils";
import useVirtualizedList from "../../hooks/useVirtualizedList";
import { Activity, ItineraryDay } from '../../types';
import { format, isValid, parseISO } from 'date-fns';

interface ItineraryDayListProps {
  days: Array<{
    dayNumber: number;
    date: string;
    activities: Activity[];
  }>;
  onEditActivity?: (dayNumber: number, activityId: string) => void;
  onDeleteActivity?: (dayNumber: number, activityId: string) => void;
  onEditDay?: (dayNumber: number) => void;
  isReadOnly?: boolean;
  setCurrentActivity?: (activity: Activity | null) => void;
  setEditModalOpen?: (open: boolean) => void;
}

const ACTIVITY_CARD_HEIGHT = 180; // Approximate height of activity card in pixels
const DAY_HEADER_HEIGHT = 60; // Approximate height of day header in pixels

const ItineraryDayList: React.FC<ItineraryDayListProps> = React.memo(({
  days,
  onEditActivity,
  onDeleteActivity,
  onEditDay,
  isReadOnly = false,
  setCurrentActivity,
  setEditModalOpen
}) => {
  // Memoize the days with activities calculation
  const daysWithActivities = useMemo(() => 
    days.filter(day => day.activities.length > 0),
    [days]
  );

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

    daysWithActivities.forEach((day, dayIndex) => {
      // Add header item
      items.push({
        type: 'header',
        dayNumber: day.dayNumber,
        date: day.date,
        dayIndex
      });

      // Add sorted activities
      sortActivitiesByTime(day.activities).forEach((activity: Activity) => {
        items.push({
          type: 'activity',
          dayNumber: day.dayNumber,
          activity,
          dayIndex
        });
      });
    });

    return items;
  }, [days, daysWithActivities]);

  // Use virtualized list for "all" mode with many items
  const useVirtualization = useMemo(() => 
    flattenedItems && flattenedItems.length > 20,
    [flattenedItems]
  );

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

  // Memoize handler functions
  const handleEditActivity = useCallback((dayNumber: number, id: string) => {
    onEditActivity?.(dayNumber, id);
  }, [onEditActivity]);

  const handleDeleteActivity = useCallback((dayNumber: number, id: string) => {
    onDeleteActivity?.(dayNumber, id);
  }, [onDeleteActivity]);

  const handleEditDay = useCallback((dayNumber: number) => {
    onEditDay?.(dayNumber);
  }, [onEditDay]);

  // Memoize the render function for a header item
  const renderHeader = useCallback((
    dayNumber: number, 
    date: string | undefined, 
    dayIndex: number, 
    style?: React.CSSProperties
  ) => {
    return (
      <div
        key={`day-header-${dayNumber}`}
        className={`flex justify-between items-center mb-4 pr-0 pl-4 ${
          dayIndex > 0 ? "pt-6 mt-6 relative" : "pt-3"
        }`}
        style={style}
      >
        {dayIndex > 0 && (
          <div className="absolute top-[-4px] left-8 right-8 h-px bg-slate-200"></div>
        )}
        <div className="flex flex-col items-start">
          <h2 className="text-lg font-semibold pb-1">
            {dayNumber ? `Day ${dayNumber}: ` : ""}
            {formatDate(date!, 'weekday')}
          </h2>
        </div>
        <Button 
          variant="outline"
          className="h-8 px-3 border border-green-300 shadow-none bg-green-50 hover:bg-green-100 hover:border-green-300 focus:ring-green-500 transition-colors text-green-600 text-sm rounded"
          onClick={() => {
            // First try to use the direct modal approach if props are provided
            if (setCurrentActivity && setEditModalOpen && date) {
              // Get the date for this day
              const defaultDate = isValid(parseISO(date)) ? parseISO(date) : new Date();
              
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
                dayNumber: dayNumber
              });
              
              // Open the modal directly
              setEditModalOpen(true);
            } else if (handleEditDay) {
              // Fall back to the original approach if direct modal props aren't available
              handleEditDay(dayNumber);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1.5 text-green-600"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Item
        </Button>
      </div>
    );
  }, [handleEditDay, setCurrentActivity, setEditModalOpen]);

  // Memoize the render function for an activity item
  const renderActivityCard = useCallback((
    activity: Activity, 
    dayNumber: number, 
    style?: React.CSSProperties
  ) => {
    return (
      <div
        key={getActivityIdSafely(activity.id)}
        className="space-y-4 px-3 pr-0"
        style={style}
      >
        <ActivityCard
          activity={ensureActivityId(activity)}
          onEdit={(id) => handleEditActivity(dayNumber, id)}
          onDelete={(id) => handleDeleteActivity(dayNumber, id)}
          className="mb-4"
        />
      </div>
    );
  }, [handleEditActivity, handleDeleteActivity]);

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
            const style = {
              position: 'absolute' as const,
              top: 0,
              transform: `translateY(${virtualItem.offsetTop}px)`,
              width: '100%'
            };
            
            if (item.type === 'header') {
              // Render day header
              return renderHeader(
                item.dayNumber, 
                item.date, 
                item.dayIndex, 
                style
              );
            } else {
              // Render activity card
              return renderActivityCard(
                item.activity!, 
                item.dayNumber, 
                style
              );
            }
          })}
        </div>
      </div>
    );
  }

  // Use the original non-virtualized rendering for day view or smaller lists
  const dayListContainerClass = useMemo(() => 
    `space-y-8 ${days.length > 1 ? "pb-8 mt-1" : ""}`,
    [days.length]
  );

  return (
    <div className={dayListContainerClass}>
      {daysWithActivities.map((day, index) => {
        const sortedActivities = useMemo(() => 
          sortActivitiesByTime(day.activities),
          [day.activities]
        );

        return (
          <div key={day.dayNumber} className={`${index === 0 && days.length > 1 ? "" : ""}`}>
            {/* Show day header in "all" view mode */}
            {renderHeader(day.dayNumber, day.date, index)}
            
            {/* Sort activities by time before rendering */}
            <div className="space-y-4 px-3 pr-0">
              {sortedActivities.map((activity: Activity, index: number) => (
                <ActivityCard
                  key={getActivityIdSafely(activity.id)}
                  activity={ensureActivityId(activity)}
                  onEdit={(id) => handleEditActivity(day.dayNumber, id)}
                  onDelete={(id) => handleDeleteActivity(day.dayNumber, id)}
                  className="mb-4"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

ItineraryDayList.displayName = 'ItineraryDayList';

export default ItineraryDayList;