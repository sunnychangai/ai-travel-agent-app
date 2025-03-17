/**
 * Application constants
 */

// Environment constants
export const ENV = {
  DEVELOPMENT: import.meta.env.MODE === 'development',
  PRODUCTION: import.meta.env.MODE === 'production',
  TEST: import.meta.env.MODE === 'test',
};

// API endpoints
export const API = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  TIMEOUT: 30000, // 30 seconds
};

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'travel_planner_auth_token',
  USER_DATA: 'travel_planner_user_data',
  CURRENT_ITINERARY: 'travel_planner_current_itinerary',
  THEME: 'travel_planner_theme',
};

// Default values
export const DEFAULTS = {
  LOCATION: 'Paris',
  DURATION_DAYS: 7,
  ACTIVITY_DURATION: '2 hours',
  ACTIVITY_IMAGE: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600&q=80',
};

// Error messages
export const ERRORS = {
  NETWORK: 'Network error. Please check your connection and try again.',
  SERVER: 'Server error. Please try again later.',
  AUTHENTICATION: 'Authentication error. Please log in again.',
  UNKNOWN: 'An unknown error occurred. Please try again.',
};

// Success messages
export const SUCCESS = {
  ITINERARY_SAVED: 'Itinerary saved successfully!',
  ACTIVITY_ADDED: 'Activity added to your itinerary!',
  ACTIVITY_UPDATED: 'Activity updated successfully!',
  ACTIVITY_DELETED: 'Activity removed from your itinerary.',
};

// Feature flags
export const FEATURES = {
  ENABLE_SHARING: true,
  ENABLE_EXPORT: true,
  ENABLE_PRINT: true,
  ENABLE_AI_SUGGESTIONS: true,
}; 