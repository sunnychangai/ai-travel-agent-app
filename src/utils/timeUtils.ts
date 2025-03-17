/**
 * Converts a time string (in 12-hour format) to minutes for comparison
 * @param timeString Time string in format "HH:MM AM/PM" or "HH:MM AM/PM - HH:MM AM/PM"
 * @returns Total minutes from midnight
 */
export const timeToMinutes = (timeString: string): number => {
  if (!timeString) return 0;
  
  // Extract just the start time if it's a range
  const startTime = timeString.split(" - ")[0];
  
  // Parse hours and minutes
  const [hoursStr, minutesStr] = startTime.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  
  // Convert to total minutes
  return hours * 60 + minutes;
};

/**
 * Sorts an array of activities by their start time
 * @param activities Array of activities with a time property
 * @returns Sorted array
 */
export const sortActivitiesByTime = <T extends { time: string }>(activities: T[]): T[] => {
  return [...activities].sort((a, b) => {
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
export const convertTo24Hour = (timeStr: string): string => {
  if (!timeStr) return '';
  
  // If already in 24-hour format (no AM/PM), return as is
  if (!timeStr.includes('AM') && !timeStr.includes('PM')) {
    return timeStr;
  }
  
  let [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  
  let hoursNum = parseInt(hours, 10);
  
  // Convert 12-hour format to 24-hour format
  if (modifier === 'PM' && hoursNum < 12) {
    hoursNum += 12;
  }
  if (modifier === 'AM' && hoursNum === 12) {
    hoursNum = 0;
  }
  
  // Format hours and minutes properly
  const formattedHours = hoursNum.toString().padStart(2, '0');
  return `${formattedHours}:${minutes}`;
};

/**
 * Converts a time string from 24-hour format to 12-hour format (AM/PM)
 * @param timeStr Time string in "HH:MM" 24-hour format
 * @returns Time string in "HH:MM AM/PM" format
 */
export const convertToAMPM = (timeStr: string): string => {
  if (!timeStr) return '';
  
  // Parse hours and minutes from the time string
  const [hours, minutes] = timeStr.split(':');
  const hoursNum = parseInt(hours, 10);
  
  // Determine if it's AM or PM
  const period = hoursNum >= 12 ? 'PM' : 'AM';
  
  // Convert hours to 12-hour format
  let displayHours = hoursNum % 12;
  if (displayHours === 0) displayHours = 12; // 0 should display as 12
  
  return `${displayHours}:${minutes} ${period}`;
}; 