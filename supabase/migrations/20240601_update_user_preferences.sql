-- Update user_preferences table to support enhanced preference structure
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS travel_style TEXT DEFAULT 'cultural',
  ADD COLUMN IF NOT EXISTS travel_group TEXT DEFAULT 'couple',
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'walking',
  ADD COLUMN IF NOT EXISTS pace TEXT DEFAULT 'moderate';

-- Convert existing arrays to more structured format
UPDATE public.user_preferences
SET 
  preferences_json = 
    jsonb_build_object(
      'travelStyle', travel_style,
      'interests', (
        SELECT jsonb_agg(jsonb_build_object('id', LOWER(REGEXP_REPLACE(activity, '\s', '')), 'label', activity))
        FROM unnest(activities) AS activity
      ),
      'travelGroup', travel_group,
      'budget', budget,
      'transportMode', transport_mode,
      'dietaryPreferences', (
        SELECT jsonb_agg(jsonb_build_object('id', LOWER(REGEXP_REPLACE(pref, '\s', '')), 'label', pref))
        FROM unnest(preferences) AS pref
      ),
      'pace', pace,
      'lastUpdated', EXTRACT(EPOCH FROM updated_at) * 1000
    )
WHERE preferences_json IS NULL; 