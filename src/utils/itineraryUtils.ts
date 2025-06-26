import { Activity, ItineraryDay } from '../types';
import { safeParseDate, formatDate } from './dateUtils';
import { v4 as uuidv4 } from 'uuid';
import { useMemo } from 'react';

/**
 * Generate a descriptive title for an itinerary
 * @param destination The destination name
 * @param startDate Start date of the trip
 * @param endDate End date of the trip
 * @returns A formatted title string
 */
export function generateItineraryTitle(
  destination: string, 
  startDate: string | Date | undefined | null, 
  endDate: string | Date | undefined | null
): string {
  try {
    // Clean up the destination name
    let cleanDestination = destination || 'My Trip';
    
    // If it's an address, extract just the city part
    if (cleanDestination.includes(',')) {
      // Try to extract city name - typically the second part in "Street, City, State Zip"
      const parts = cleanDestination.split(',');
      if (parts.length >= 2) {
        // Use the city part (typically the second segment of the address)
        cleanDestination = parts[1].trim();
        
        // Remove any zip/postal codes that might be included
        cleanDestination = cleanDestination.replace(/\d{5,}/, '').trim();
      }
    }
    
    // Format the start and end dates if they exist
    let dateInfo = '';
    if (startDate && endDate) {
      const parsedStartDate = safeParseDate(startDate);
      const parsedEndDate = safeParseDate(endDate);
      const startFormatted = formatDate(parsedStartDate, 'MM/DD', '');
      const endFormatted = formatDate(parsedEndDate, 'MM/DD', '');
      
      if (startFormatted && endFormatted) {
        // Get the number of days
        const daysDiff = Math.round((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        dateInfo = ` (${startFormatted} - ${endFormatted}, ${daysDiff} days)`;
      }
    }
    
    // Build a complete title with dates
    return `Trip to ${cleanDestination}${dateInfo}`;
    
  } catch (error) {
    // Fallback to a simpler title without logging errors
    return `Trip to ${destination || 'My Trip'}`;
  }
}

/**
 * Convert API-formatted itinerary to the format expected by ItineraryContext
 * @param apiItinerary Itinerary data from OpenAI API or other sources
 * @returns Formatted data for ItineraryContext
 */
export function convertItineraryApiToContext(apiItinerary: any): {
  destination: string;
  startDate: string;
  endDate: string;
  days: ItineraryDay[];
  title: string;
} {
  // Safety check and defaults
  if (!apiItinerary) {
    throw new Error('Invalid itinerary data');
  }
  
  const itinerary = apiItinerary.itinerary || [];
  
  // Extract basic properties with defaults
  const destination = apiItinerary.destination || 'Unknown Destination';
  
  // Ensure dates are properly parsed and have the minimum year (2025)
  const startDateParsed = safeParseDate(apiItinerary.startDate || new Date());
  const endDateParsed = safeParseDate(apiItinerary.endDate || new Date());
  
  // Make sure endDate is at least startDate if parsing failed
  if (endDateParsed < startDateParsed) {
    endDateParsed.setTime(startDateParsed.getTime());
    
    // If there's itinerary data, adjust the end date based on number of days
    if (itinerary.length > 1) {
      endDateParsed.setDate(startDateParsed.getDate() + itinerary.length - 1);
    }
  }
  
  // Format dates consistently as ISO strings (YYYY-MM-DD)
  const startDate = startDateParsed.toISOString().split('T')[0];
  const endDate = endDateParsed.toISOString().split('T')[0];
  
  // Debug logging for date conversion
  console.log('Itinerary date conversion:', {
    original: {
      start: apiItinerary.startDate,
      end: apiItinerary.endDate
    },
    parsed: {
      startDate,
      endDate,
      startMonth: startDateParsed.getMonth() + 1,
      startDay: startDateParsed.getDate(),
      startYear: startDateParsed.getFullYear(),
      endMonth: endDateParsed.getMonth() + 1,
      endDay: endDateParsed.getDate(),
      endYear: endDateParsed.getFullYear()
    }
  });
  
  // Generate a title for the itinerary
  const title = apiItinerary.title || generateItineraryTitle(destination, startDate, endDate);
  
  // Convert days and activities to the expected format
  const days: ItineraryDay[] = [];
  
  itinerary.forEach((dayData: any, index: number) => {
    // Extract the day number and date
    const dayNumber = index + 1;
    
    // Use the explicit date field if available, otherwise extract from day string
    let dateStr = '';
    
    if (dayData.date) {
      // Use the explicit date field (our preferred method)
      dateStr = dayData.date;
    } else if (dayData.day && dayData.day.includes(':')) {
      // Legacy support: extract date from the day string
      // Format is usually "Day X: [Weekday], [Month] [Day], [Year]"
      dateStr = dayData.day.split(':')[1]?.trim() || '';
    }
    
    // Calculate the date for this day based on start date + index
    const dayDate = new Date(startDateParsed);
    dayDate.setDate(startDateParsed.getDate() + index);
    
    // If we have a date string from the API, try to parse it first
    const parsedDate = dateStr ? safeParseDate(dateStr) : dayDate;
    
    // Convert to consistent ISO string format
    const date = parsedDate.toISOString().split('T')[0];
    
    // Convert activities to the expected format
    const activities: Activity[] = (dayData.activities || []).map((activityData: any) => {
      // Extract time information and handle numeric values
      let timeStr = activityData.time || '12:00 PM';
      
      // Check if the time is a numeric value (representing minutes)
      if (typeof timeStr === 'number' || (typeof timeStr === 'string' && !isNaN(parseInt(timeStr, 10)) && timeStr === parseInt(timeStr, 10).toString())) {
        // Convert numeric minutes to proper time string
        const minutes = typeof timeStr === 'number' ? timeStr : parseInt(timeStr, 10);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        // Convert to 12-hour format
        let period = hours >= 12 ? 'PM' : 'AM';
        let displayHours = hours % 12;
        if (displayHours === 0) displayHours = 12;
        
        timeStr = `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
        console.log(`Converted numeric time ${activityData.time} to ${timeStr}`);
      }
      
      // Create the activity object
      return {
        id: uuidv4(),  // Generate a unique ID for each activity
        title: activityData.name || 'Untitled Activity',
        description: activityData.description || '',
        location: activityData.address || '',
        time: timeStr,
        type: activityData.type || 'activity',
        dayNumber: dayNumber,
        // Add any additional properties from the API
        ...(activityData.rating && { rating: activityData.rating }),
        ...(activityData.price_level && { price: activityData.price_level }),
      };
    });
    
    // Add the day to the array
    days.push({
      dayNumber,
      date,
      activities,
    });
  });
  
  return {
    destination,
    startDate,
    endDate,
    days,
    title,
  };
}

/**
 * Memoized version of convertItineraryApiToContext for React components
 * @param apiItinerary Itinerary data from API
 * @returns Memoized formatted data for ItineraryContext
 */
export function useConvertItineraryApiToContext(apiItinerary: any) {
  return useMemo(() => {
    return convertItineraryApiToContext(apiItinerary);
  }, [apiItinerary]);
}

/**
 * Convert ItineraryContext data to the format expected by the API
 * @param days ItineraryDay array from context
 * @param destination Destination name
 * @param startDate Start date string
 * @param endDate End date string
 * @returns API-formatted itinerary
 */
export function convertContextToApiItinerary(
  days: ItineraryDay[],
  destination: string = 'Unknown Destination',
  startDate: string = '',
  endDate: string = ''
): any {
  // Create the itinerary array
  const itinerary = days.map(day => {
    // Format the day string
    const dayStr = `Day ${day.dayNumber}: ${day.date}`;
    
    // Convert activities to the API format
    const activities = day.activities.map(activity => {
      return {
        time: activity.time,
        type: activity.type || 'activity',
        name: activity.title,
        address: activity.location,
        description: activity.description,
      };
    });
    
    return {
      day: dayStr,
      activities,
    };
  });
  
  // Use provided dates or extract from the days
  const firstDate = days.length > 0 ? days[0].date : '';
  const lastDate = days.length > 0 ? days[days.length - 1].date : '';
  
  return {
    destination,
    startDate: startDate || firstDate,
    endDate: endDate || lastDate,
    itinerary,
  };
}

/**
 * Memoized version of convertContextToApiItinerary for React components
 */
export function useConvertContextToApiItinerary(
  days: ItineraryDay[],
  destination: string = 'Unknown Destination',
  startDate: string = '',
  endDate: string = ''
) {
  return useMemo(() => {
    return convertContextToApiItinerary(days, destination, startDate, endDate);
  }, [days, destination, startDate, endDate]);
}
