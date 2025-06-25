import { Activity } from '../types';

/**
 * Ensures an activity has a valid ID
 * @param activity Activity that may or may not have an ID
 * @returns Activity with guaranteed ID
 */
export const ensureActivityId = (activity: Activity): Activity & { id: string } => {
  return {
    ...activity,
    id: activity.id || `activity-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  };
};

/**
 * Safely gets an activity ID, generating one if needed
 * @param id Optional activity ID
 * @returns Valid activity ID
 */
export const getActivityIdSafely = (id: string | undefined): string => {
  return id || `activity-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};

/**
 * Type styling configurations for activity types
 */
export const typeConfig: Record<string, { bgColor: string, textColor: string, borderColor?: string }> = {
  transportation: {
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300'
  },
  flight: {
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300'
  },
  accommodation: {
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300'
  },
  hotel: {
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300'
  },
  food: {
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300'
  },
  meal: {
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300'
  },
  cultural: {
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-300'
  },
  relaxation: {
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300'
  },
  active: {
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-300'
  },
  activity: {
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300'
  },
  sightseeing: {
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300'
  },
  note: {
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300'
  },
  default: {
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300'
  }
};

/**
 * Get styling based on activity type
 * @param type Activity type string
 * @returns Object with styling classes
 */
export const getActivityTypeStyles = (type: string = "") => {
  // Convert to lowercase for consistent matching
  const lowercaseType = type?.toLowerCase() || 'default';
  
  // Try direct match first (more efficient)
  if (typeConfig[lowercaseType]) {
    return typeConfig[lowercaseType];
  }
  
  // Check for specific type matches with partial text
  if (lowercaseType.includes('flight') || lowercaseType.includes('transportation')) {
    return typeConfig.transportation;
  } else if (lowercaseType.includes('hotel') || lowercaseType.includes('accommodation')) {
    return typeConfig.accommodation;
  } else if (lowercaseType.includes('meal') || lowercaseType.includes('food')) {
    return typeConfig.food;
  } else if (lowercaseType.includes('cultural')) {
    return typeConfig.cultural;
  } else if (lowercaseType.includes('relaxation')) {
    return typeConfig.relaxation;
  } else if (lowercaseType.includes('active')) {
    return typeConfig.active;
  } else if (lowercaseType.includes('activity') || lowercaseType.includes('sightseeing')) {
    return typeConfig.activity;
  } else if (lowercaseType.includes('note')) {
    return typeConfig.note;
  }
  
  return typeConfig.default;
};

/**
 * Determine activity type based on title and description content
 * @param title Activity title
 * @param description Activity description
 * @returns Appropriate activity type string
 */
export const determineActivityType = (title: string, description: string): string => {
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