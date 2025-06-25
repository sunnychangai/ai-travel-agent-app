import React from 'react';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { ItineraryDay } from '../../types';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/dateUtils';

interface DaySelectorProps {
  days: { dayNumber: number; date: string }[];
  selectedDay: string;
  onSelectDay: (day: string) => void;
  className?: string;
}

const DaySelector: React.FC<DaySelectorProps> = ({
  days,
  selectedDay,
  onSelectDay,
  className
}) => {
  const currentDayNumber = parseInt(selectedDay, 10);
  
  const handlePrevDay = () => {
    if (currentDayNumber > 1) {
      onSelectDay((currentDayNumber - 1).toString());
    }
  };
  
  const handleNextDay = () => {
    if (currentDayNumber < days.length) {
      onSelectDay((currentDayNumber + 1).toString());
    }
  };
  
  const currentDay = days.find(day => day.dayNumber === currentDayNumber);
  const isPrevDisabled = currentDayNumber <= 1;
  const isNextDisabled = currentDayNumber >= days.length;
  
  if (days.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <span className="text-sm text-slate-500">No days in itinerary</span>
      </div>
    );
  }
  
  return (
    <div className={cn("flex items-center", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevDay}
        disabled={isPrevDisabled}
        className={cn(
          "h-8 w-8 rounded-full transition-colors", 
          isPrevDisabled 
            ? "opacity-40" 
            : "hover:bg-blue-100 hover:text-blue-700 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        )}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      
      <div className="flex-1 mx-2">
        <div className="relative group">
          <button 
            onClick={() => {/* Could open day selector dropdown here */}}
            className="w-full text-left bg-white border border-slate-200 rounded-md py-2 px-3 shadow-sm hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center">
              <div className="flex flex-col">
                <span className="text-xs text-blue-600 font-semibold">
                  DAY {currentDay?.dayNumber}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {currentDay ? formatDate(currentDay.date, 'dayAndDate') : 'Select day'}
                </span>
              </div>
              <div className="ml-auto">
                <CalendarDays className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
          </button>
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextDay}
        disabled={isNextDisabled}
        className={cn(
          "h-8 w-8 rounded-full transition-colors", 
          isNextDisabled 
            ? "opacity-40" 
            : "hover:bg-blue-100 hover:text-blue-700 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        )}
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default DaySelector; 