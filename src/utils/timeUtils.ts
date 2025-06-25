import { memoizedSort, calculationCache } from './memoizationUtils';

/**
 * Converts a time string (in 12-hour format) to minutes for comparison
 * @param timeString Time string in format "HH:MM AM/PM" or "HH:MM AM/PM - HH:MM AM/PM"
 * @returns Total minutes from midnight
 */
export const timeToMinutes = calculationCache.memoize((timeString: string): number => {
  if (!timeString) return 0;
  
  // Extract just the start time if it's a range
  const startTime = timeString.split(" - ")[0];
  
  // Parse hours and minutes
  const [hoursStr, minutesStr] = startTime.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  
  // Convert to total minutes
  return hours * 60 + minutes;
});

/**
 * Sorts an array of activities by their start time
 * @param activities Array of activities with a time property
 * @returns Sorted array
 */
export const sortActivitiesByTime = <T extends { time: string }>(activities: T[]): T[] => {
  // Quick return for small arrays
  if (!activities || activities.length <= 1) {
    return [...activities];
  }
  
  return memoizedSort(activities, (a, b) => {
    const timeA = timeToMinutes(a.time);
    const timeB = timeToMinutes(b.time);
    return timeA - timeB;
  });
};

/**
 * Converts a time string from 12-hour format (AM/PM) to 24-hour format
 * @param timeStr Time string in "HH:MM AM/PM" format
 * @returns Time string in "HH:MM" 24-hour format
 */
export const convertTo24Hour = calculationCache.memoize((timeStr: string): string => {
  if (!timeStr) return '';
  
  // If already in 24-hour format (no AM/PM), return as is
  if (!timeStr.includes('AM') && !timeStr.includes('PM')) {
    return timeStr;
  }
  
  let [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  
  let hoursNum = parseInt(hours, 10);
  
  // Convert to 24 hour format
  if (hoursNum === 12) {
    hoursNum = modifier === 'AM' ? 0 : 12;
  } else if (modifier === 'PM') {
    hoursNum += 12;
  }
  
  return `${hoursNum.toString().padStart(2, '0')}:${minutes}`;
});

/**
 * Converts a time string from 24-hour format to 12-hour format (with AM/PM)
 * @param timeStr Time string in "HH:MM" 24-hour format
 * @returns Time string in "HH:MM AM/PM" format
 */
export const convertToAMPM = calculationCache.memoize((timeStr: string): string => {
  if (!timeStr) return '';
  
  // If already in 12-hour format (has AM/PM), return as is
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    return timeStr;
  }
  
  let [hours, minutes] = timeStr.split(':');
  let hoursNum = parseInt(hours, 10);
  let period = hoursNum >= 12 ? 'PM' : 'AM';
  
  if (hoursNum === 0) {
    hoursNum = 12;
  } else if (hoursNum > 12) {
    hoursNum -= 12;
  }
  
  return `${hoursNum}:${minutes} ${period}`;
});

/**
 * Formats start and end times into a readable time range
 * @param startTime Start time in any format
 * @param endTime Optional end time in any format
 * @returns Formatted time range string
 */
export const formatTimeRange = calculationCache.memoize((startTime: string, endTime?: string): string => {
  if (!startTime) return '';
  
  // If no end time, just format the start time
  if (!endTime) {
    // If start time is already in AM/PM format
    if (startTime.includes('AM') || startTime.includes('PM')) {
      return startTime;
    }
    // Convert to AM/PM format
    return convertToAMPM(startTime);
  }
  
  // Format both start and end time in AM/PM format
  const formattedStart = startTime.includes('AM') || startTime.includes('PM') 
    ? startTime 
    : convertToAMPM(startTime);
    
  const formattedEnd = endTime.includes('AM') || endTime.includes('PM') 
    ? endTime 
    : convertToAMPM(endTime);
  
  return `${formattedStart} - ${formattedEnd}`;
});

/**
 * Parses a time string and returns various formatted versions
 * @param timeString Time string in any format
 * @returns Object with different formats of the time
 */
export const parseTimeString = calculationCache.memoize((timeString: string): any => {
  if (!timeString) return { 
    original: '',
    hour24: '',
    hour12: '',
    minutes: 0
  };
  
  // Handle time ranges (e.g. "9:00 AM - 11:00 AM")
  if (timeString.includes(' - ')) {
    const [startTime, endTime] = timeString.split(' - ');
    const parsedStart: any = parseTimeString(startTime);
    const parsedEnd: any = parseTimeString(endTime);
    
    return {
      original: timeString,
      startTime: parsedStart.hour12,
      endTime: parsedEnd.hour12,
      hour24Start: parsedStart.hour24,
      hour24End: parsedEnd.hour24,
      hour12Start: parsedStart.hour12,
      hour12End: parsedEnd.hour12,
      minutesStart: parsedStart.minutes,
      minutesEnd: parsedEnd.minutes
    };
  }
  
  // If time string is in 12-hour format (has AM/PM)
  const is12Hour = timeString.includes('AM') || timeString.includes('PM');
  
  const hour24 = is12Hour ? convertTo24Hour(timeString) : timeString;
  const hour12 = is12Hour ? timeString : convertToAMPM(timeString);
  const minutes = timeToMinutes(is12Hour ? timeString : convertToAMPM(timeString));
  
  return {
    original: timeString,
    hour24,
    hour12,
    minutes
  };
}); 