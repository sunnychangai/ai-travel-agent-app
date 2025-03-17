# User Preferences System

This document describes the enhanced user preferences system in the Travel Itinerary application.

## Overview

The user preferences system allows users to save their travel preferences, which are then used to enhance the AI-generated itineraries. Preferences are stored in both local storage (for immediate access and offline support) and Supabase (for cross-device access and persistence).

## Data Structure

User preferences are stored in a structured format that contains both IDs (for state management) and human-readable labels (for AI prompts):

```typescript
interface UserPreferences {
  travelStyle: string;
  interests: Array<{id: string; label: string}>;
  travelGroup: string;
  budget: string;
  transportMode: string;
  dietaryPreferences: Array<{id: string; label: string}>;
  pace: 'slow' | 'moderate' | 'fast';
  lastUpdated: number;
}
```

## Storage Mechanism

The system uses a dual-storage approach:

1. **Local Storage**: Provides immediate access and offline capabilities
   - Key: `travelApp.userPreferences`
   - Format: JSON-serialized `UserPreferences` object

2. **Supabase**: Provides cross-device access and persistence 
   - Table: `user_preferences`
   - Linked to user accounts via `user_id`
   - Contains both structured columns and a full JSON representation for forward compatibility

## Components

1. **UserPreferencesService**: Core service for managing preferences
   - Handles saving, loading, updating, and clearing preferences
   - Maintains sync between local storage and Supabase
   - Provides both async and sync access methods

2. **useUserPreferences**: React hook for component integration
   - Provides React state management for preferences
   - Handles loading states and errors
   - Simplifies component integration

3. **EnhancedItineraryCreator**: UI for capturing preferences
   - Form-based interface for setting preferences
   - Automatically saves as users make selections
   - Used during itinerary creation

4. **UserPreferencesManager**: UI for viewing and managing preferences
   - Displays saved preferences
   - Allows clearing preferences
   - Shows human-readable versions of preferences

## Usage

### Using the Service Directly

```typescript
import UserPreferencesService from '../services/userPreferencesService';

// Load preferences (async)
const preferences = await UserPreferencesService.loadPreferences();

// Save preferences (async)
await UserPreferencesService.savePreferences(newPreferences);

// Get preferences synchronously (local storage only)
const syncPrefs = UserPreferencesService.getPreferencesSync();
```

### Using the React Hook

```typescript
import { useUserPreferences } from '../hooks/useUserPreferences';

function MyComponent() {
  const { 
    preferences, 
    isLoading, 
    error, 
    savePreferences, 
    updatePreferences,
    clearPreferences 
  } = useUserPreferences();
  
  // Use preferences in your component
  if (isLoading) return <div>Loading...</div>;
  if (!preferences) return <div>No preferences set</div>;
  
  return (
    <div>
      <h1>Your Preferences</h1>
      <p>Travel Style: {preferences.travelStyle}</p>
      {/* ... */}
      <button onClick={() => updatePreferences({ travelStyle: 'luxury' })}>
        Upgrade to Luxury
      </button>
    </div>
  );
}
```

## Migrations

When updating the preference structure:

1. Update the `UserPreferences` interface
2. Update the conversion functions in `UserPreferencesService`
3. Create a Supabase migration if the database structure needs updating
4. Test backward compatibility with older saved preferences

## Security

- User preferences are only accessible to the authenticated user
- Row-level security ensures users can only access their own preferences
- The system gracefully handles unauthenticated users by falling back to local storage 