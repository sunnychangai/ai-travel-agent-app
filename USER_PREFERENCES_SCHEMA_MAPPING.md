# User Preferences Schema Mapping

## Overview

This document defines the unified user preferences schema that supports both the **Onboarding** component and the **EnhancedItineraryCreator** component. The schema is designed to store all preference data from both components while maintaining compatibility.

## Database Schema

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  
  -- Core preference fields
  travel_style TEXT DEFAULT 'cultural',
  interests TEXT[] DEFAULT '{}',
  activities TEXT[] DEFAULT '{}', 
  preferences TEXT[] DEFAULT '{}',
  budget TEXT,
  dream_destinations TEXT,
  
  -- Enhanced preference fields
  travel_group TEXT DEFAULT 'couple',
  transport_mode TEXT DEFAULT 'walking',
  pace TEXT DEFAULT 'moderate',
  dietary_preferences TEXT[] DEFAULT '{}',
  
  -- Unified JSON storage
  preferences_json JSONB DEFAULT NULL,
  
  -- Legacy/compatibility fields
  preferred_accommodation TEXT,
  accessibility_needs TEXT[] DEFAULT '{}',
  preferred_transportation TEXT[] DEFAULT '{}',
  trip_duration INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
```

## Field Mappings

### Travel Style (`travel_style`)

**Onboarding Component Options:**
- `'balanced'` - Balanced Mix ⚖️
- `'luxury'` - Luxury ✨
- `'budget'` - Budget-friendly 💰
- `'adventure'` - Adventure 🧗‍♂️
- `'relaxation'` - Relaxation 🧘‍♀️
- `'cultural'` - Cultural 🏛️

**EnhancedItineraryCreator Options:**
- `'relaxed'` - Relaxed
- `'active'` - Active  
- `'cultural'` - Cultural
- `'luxury'` - Luxury
- `'budget'` - Budget
- `'family'` - Family-friendly

**Storage:** Single TEXT value
**Default:** `'cultural'`

### Activities (`activities`)

**Onboarding Component (Step 3):**
- `'sightseeing'` - Sightseeing
- `'food'` - Food & Dining
- `'relaxation'` - Relaxation & Wellness
- `'shopping'` - Shopping
- `'museums'` - Museums & Culture
- `'adventure'` - Adventure & Outdoors
- `'nightlife'` - Nightlife & Entertainment
- `'local'` - Local Experiences

**Storage:** TEXT[] array of activity IDs
**Usage:** Onboarding only, not currently used by EnhancedItineraryCreator

### Interests (`interests`)

**EnhancedItineraryCreator Options:**
- `'history'` - History
- `'art'` - Art & Museums
- `'food'` - Food & Dining
- `'nature'` - Nature
- `'adventure'` - Adventure
- `'nightlife'` - Nightlife
- `'shopping'` - Shopping
- `'beach'` - Beaches
- `'architecture'` - Architecture
- `'local'` - Local Culture

**Storage:** TEXT[] array of interest IDs
**Usage:** EnhancedItineraryCreator only
**Note:** Similar to activities but with different values and structure

### Preferences (`preferences`)

**Onboarding Component (Step 4):**
- `'popular'` - Popular attractions
- `'hidden'` - Hidden gems
- `'local'` - Local cuisine
- `'international'` - International cuisine
- `'public'` - Public transportation
- `'private'` - Private transportation
- `'guided'` - Guided tours
- `'self'` - Self-guided exploration

**Storage:** TEXT[] array of preference IDs
**Usage:** Onboarding only

### Budget (`budget`)

**Onboarding Component:**
- `'Budget-friendly options'` - $ symbol
- `'Mid-range options'` - $$ symbol
- `'High-end options'` - $$$ symbol
- `'Luxury experiences'` - $$$$ symbol

**EnhancedItineraryCreator:**
- `'budget'` - Budget
- `'mid-range'` - Mid-Range
- `'luxury'` - Luxury

**Storage:** TEXT value
**Migration:** Onboarding descriptions are converted to EnhancedItineraryCreator format in `preferences_json`

### Travel Group (`travel_group`)

**EnhancedItineraryCreator Options:**
- `'solo'` - Solo Traveler
- `'couple'` - Couple
- `'family'` - Family with Kids
- `'friends'` - Group of Friends
- `'business'` - Business Trip

**Storage:** TEXT value
**Default:** `'couple'`
**Usage:** EnhancedItineraryCreator only

### Transport Mode (`transport_mode`)

**EnhancedItineraryCreator Options:**
- `'walking'` - Walking
- `'public'` - Public Transit
- `'taxi'` - Taxi/Rideshare
- `'car'` - Rental Car

**Storage:** TEXT value
**Default:** `'walking'`
**Usage:** EnhancedItineraryCreator only

### Pace (`pace`)

**EnhancedItineraryCreator Options:**
- `'slow'` - Relaxed
- `'moderate'` - Balanced (default)
- `'fast'` - Action-packed

**Storage:** TEXT value
**Default:** `'moderate'`
**Usage:** EnhancedItineraryCreator only

### Dietary Preferences (`dietary_preferences`)

**EnhancedItineraryCreator Options:**
- `'vegetarian'` - Vegetarian
- `'vegan'` - Vegan
- `'glutenFree'` - Gluten-Free
- `'seafood'` - Seafood
- `'halal'` - Halal
- `'kosher'` - Kosher
- `'dairyFree'` - Dairy-Free
- `'local'` - Local Cuisine

**Storage:** TEXT[] array of dietary preference IDs
**Usage:** EnhancedItineraryCreator only

### Dream Destinations (`dream_destinations`)

**Onboarding Component (Step 2):**
Free text input for user's dream destinations (e.g., "Paris, Tokyo")

**Storage:** TEXT value
**Usage:** Onboarding only

## Unified JSON Format (`preferences_json`)

The `preferences_json` field stores a unified representation that both components can use:

```json
{
  "travelStyle": "cultural",
  "budget": "mid-range",
  "lastUpdated": 1703123456789,
  
  "interests": [
    {"id": "history", "label": "History"},
    {"id": "food", "label": "Food & Dining"}
  ],
  
  "activities": ["sightseeing", "food", "museums"],
  "preferences": ["popular", "local", "guided"],
  
  "travelGroup": "couple",
  "transportMode": "walking", 
  "pace": "moderate",
  
  "dietaryPreferences": [
    {"id": "vegetarian", "label": "Vegetarian"},
    {"id": "local", "label": "Local Cuisine"}
  ],
  
  "dreamDestinations": "Paris, Tokyo, New Zealand"
}
```

## Component-Specific Saving

### Onboarding Component

Currently saves to database:
```javascript
{
  user_id: user.id,
  name: preferences.name,
  travel_style: preferences.travelStyle, // Array but only first value used
  budget: preferences.budget, // Description text
  preferences: preferences.preferences, // Array
  // Missing: activities, dreamDestinations
}
```

**Recommended Updates:**
1. Save `activities` array to database
2. Save `dream_destinations` to database  
3. Convert budget from description to ID format
4. Populate `preferences_json` with complete data

### EnhancedItineraryCreator Component

Uses the unified service which converts to this format:
```javascript
{
  travelStyle: "cultural", // Single value
  interests: [{id: "history", label: "History"}], // Object array
  travelGroup: "couple",
  budget: "mid-range", // ID format
  transportMode: "walking",
  dietaryPreferences: [{id: "vegetarian", label: "Vegetarian"}],
  pace: "moderate",
  lastUpdated: 1703123456789
}
```

## Migration Strategy

1. **Database Migration:** Add missing columns with safe defaults
2. **Data Migration:** Convert existing budget descriptions to ID format
3. **Build preferences_json:** Create unified JSON for all existing records
4. **Component Updates:** Update Onboarding to save complete data
5. **Service Updates:** Ensure both services can read/write unified format

## Usage Guidelines

### For New Components

1. **Read from `preferences_json` first** for complete data
2. **Fall back to individual columns** for basic data
3. **Always update both** individual columns and `preferences_json`
4. **Use consistent ID formats** as defined in this document

### For Existing Components

1. **Onboarding:** Update to save `activities` and `dream_destinations`
2. **EnhancedItineraryCreator:** Continue using unified service
3. **Both:** Ensure budget format consistency

## Validation

### Required Validations

- `travel_style` must be one of the defined values
- `pace` must be 'slow', 'moderate', or 'fast'
- `travel_group` must be one of the defined values
- `transport_mode` must be one of the defined values
- All array fields must contain only defined ID values

### Recommended Constraints

```sql
-- Add check constraints for enum-like fields
ALTER TABLE user_preferences 
  ADD CONSTRAINT check_pace 
  CHECK (pace IN ('slow', 'moderate', 'fast'));

ALTER TABLE user_preferences 
  ADD CONSTRAINT check_travel_group 
  CHECK (travel_group IN ('solo', 'couple', 'family', 'friends', 'business'));

ALTER TABLE user_preferences 
  ADD CONSTRAINT check_transport_mode 
  CHECK (transport_mode IN ('walking', 'public', 'taxi', 'car'));
```

---

**Last Updated:** December 2024  
**Status:** Ready for Implementation  
**Next Steps:** Apply migration and update Onboarding component 