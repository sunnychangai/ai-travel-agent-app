import { format, parse, formatRelative, differenceInDays, formatDistance, parseISO, isValid } from 'date-fns';

/**
 * Formats a date string according to the specified format
 * @param dateString ISO date string or Date object
 * @param formatType Format type ('full', 'short', 'monthDay', 'weekday', etc.)
 * @param fallbackText Text to return if the date is invalid
 * @returns Formatted date string or fallback value if invalid
 */
export const formatDate = (
  dateString: string | Date | undefined | null, 
  formatType: string = 'short',
  fallbackText: string = 'Invalid date'
): string => {
  try {
    // Check for undefined, null or empty string
    if (!dateString) {
      return fallbackText;
    }
    
    let date: Date;
    
    if (dateString instanceof Date) {
      date = dateString;
    } else {
      // First check if dateString is empty or not valid
      if (typeof dateString === 'string' && (!dateString.trim() || dateString === 'Invalid date')) {
        return fallbackText;
      }
      date = parseISO(dateString);
    }
    
    if (!isValid(date)) {
      console.warn(`Invalid date: ${dateString}`);
      return fallbackText;
    }
    
    switch (formatType) {
      case 'full':
        return format(date, 'MMMM d, yyyy');
      case 'short':
        return format(date, 'MM/dd/yyyy');
      case 'monthDay':
        return format(date, 'MMMM d, yyyy');
      case 'weekday':
        return format(date, 'EEEE, MMMM d');
      case 'dayAndDate':
        return format(date, 'EEEE, MM/dd/yyyy');
      case 'MM/DD':
        // Ensure consistent zero-padding for month and day
        return format(date, 'MM/dd');
      default:
        return format(date, 'MM/dd/yyyy');
    }
  } catch (error) {
    console.error(`Error formatting date ${dateString}:`, error);
    return fallbackText;
  }
};

/**
 * Safely parses a date string to a Date object with consistent error handling
 * @param dateString ISO date string, date string in a specified format, or Date object
 * @param dateFormat Optional format string to use for parsing (if not an ISO date)
 * @param fallbackDate Optional fallback date to use if parsing fails
 * @returns A valid Date object or the fallback date (or new Date() if no fallback provided)
 */
export const safeParseDate = (
  dateString: string | Date | undefined | null,
  dateFormat?: string,
  fallbackDate?: Date
): Date => {
  // Provide a default fallback date
  const defaultFallback = fallbackDate || new Date();
  
  // Check for undefined, null or empty string
  if (!dateString) {
    // Return silently without warning for common cases
    return defaultFallback;
  }
  
  // For string dates, check if empty or invalid
  if (typeof dateString === 'string' && (!dateString.trim() || dateString === 'Invalid date')) {
    return defaultFallback;
  }

  try {
    let date: Date;
    // Get current year for defaulting, ensuring we use at least 2025
    const systemYear = new Date().getFullYear();
    const currentYear = systemYear < 2025 ? 2025 : systemYear;
    
    if (dateString instanceof Date) {
      date = dateString;
      // Update year if needed
      if (date.getFullYear() < 2025) {
        date.setFullYear(currentYear);
      }
      return date;
    } else if (dateFormat) {
      // Parse using specified format
      date = parse(dateString, dateFormat, new Date());
      
      // If year is not in the specified format, set it to current year
      if (!dateFormat.includes('y') && isValid(date)) {
        date.setFullYear(currentYear);
      }
    } else {
      // Try different parsing strategies
      
      // Try to parse as ISO date first
      date = parseISO(dateString);
      
      // Check if we got a valid date and if the year is before 2025
      if (isValid(date) && date.getFullYear() < 2025) {
        // Create a new date with the same month and day but with current year
        const month = date.getMonth();
        const day = date.getDate();
        date = new Date(currentYear, month, day);
      }
      
      // If ISO parsing failed, try common formats
      if (!isValid(date)) {
        // Try natural language date format: "Weekday, Month Day, Year"
        // Example: "Thursday, May 1, 2025"
        const naturalLanguageMatch = /([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2})(?:,\s+(\d{4}))?/.exec(dateString);
        if (naturalLanguageMatch) {
          const [_, weekday, month, day, year] = naturalLanguageMatch;
          // Use provided year or default to current year
          const useYear = year && parseInt(year) >= 2025 ? year : currentYear.toString();
          
          // Try to parse with date-fns
          date = parse(
            `${month} ${day} ${useYear}`,
            'MMMM d yyyy',
            new Date()
          );
          
          // If that fails, try with built-in Date parsing
          if (!isValid(date)) {
            date = new Date(`${month} ${day}, ${useYear}`);
          }
        }
        
        // Try MM/DD/YYYY or MM/DD format
        if (!isValid(date) && /^\d{1,2}\/\d{1,2}(?:\/\d{4})?$/.test(dateString)) {
          if (dateString.includes('/')) {
            if (dateString.split('/').length === 3) {
              // MM/DD/YYYY format
              date = parse(dateString, 'MM/dd/yyyy', new Date());
              // Check year and adjust if needed
              if (isValid(date) && date.getFullYear() < 2025) {
                date.setFullYear(currentYear);
              }
            } else {
              // MM/DD format - use current year
              date = parse(`${dateString}/${currentYear}`, 'MM/dd/yyyy', new Date());
            }
          }
        }
        
        // Try YYYY-MM-DD or MM-DD format (common in international contexts)
        if (!isValid(date) && /^(?:\d{4}-)??\d{1,2}-\d{1,2}$/.test(dateString)) {
          if (dateString.split('-').length === 3) {
            // YYYY-MM-DD format
            date = parse(dateString, 'yyyy-MM-dd', new Date());
            // Check year and adjust if needed
            if (isValid(date) && date.getFullYear() < 2025) {
              date.setFullYear(currentYear);
            }
          } else {
            // MM-DD format - use current year
            date = parse(`${currentYear}-${dateString}`, 'yyyy-MM-dd', new Date());
          }
        }
      }
    }
    
    if (!isValid(date)) {
      return defaultFallback;
    }
    
    // Ensure consistent year (at least 2025) for all dates
    if (date.getFullYear() < 2025) {
      date.setFullYear(currentYear);
    }
    
    return date;
  } catch (error) {
    // Just return fallback without logging - there might be many legitimate
    // reasons why a date can't be parsed
    return defaultFallback;
  }
};

/**
 * Adds an ordinal suffix to a day number
 */
export const addOrdinalSuffix = (day: number): string => {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }
  
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}; 