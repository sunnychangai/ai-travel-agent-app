-- Fix user_preferences schema mismatch 
-- This migration ensures the database schema matches what both Onboarding and EnhancedItineraryCreator expect

-- Add missing columns if they don't exist
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS travel_group TEXT DEFAULT 'couple',
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'walking',  
  ADD COLUMN IF NOT EXISTS pace TEXT DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS activities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dream_destinations TEXT;

-- Add the new dietary_preferences column if it doesn't exist  
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}';

-- Migrate data from dietary_restrictions to dietary_preferences if dietary_restrictions exists
DO $$
BEGIN
    -- Check if dietary_restrictions column exists
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_preferences' 
        AND column_name = 'dietary_restrictions'
    ) THEN
        -- Copy data from dietary_restrictions to dietary_preferences
        UPDATE public.user_preferences 
        SET dietary_preferences = dietary_restrictions 
        WHERE dietary_preferences = '{}' AND dietary_restrictions IS NOT NULL;
        
        -- Drop the old column after data migration
        ALTER TABLE public.user_preferences DROP COLUMN dietary_restrictions;
        
        RAISE NOTICE 'Migrated dietary_restrictions to dietary_preferences and dropped old column';
    END IF;
END $$;

-- Update the travel_style column to have a default if it doesn't already
ALTER TABLE public.user_preferences 
  ALTER COLUMN travel_style SET DEFAULT 'cultural';

-- Create or update indexes for performance
CREATE INDEX IF NOT EXISTS user_preferences_travel_style_idx ON public.user_preferences (travel_style);
CREATE INDEX IF NOT EXISTS user_preferences_travel_group_idx ON public.user_preferences (travel_group);

-- Update existing rows to have default values for new columns where NULL
-- Use separate DO blocks to handle columns that may not exist
DO $$
BEGIN
    -- Update travel_group if column exists (EnhancedItineraryCreator values)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'travel_group') THEN
        UPDATE public.user_preferences SET travel_group = 'couple' WHERE travel_group IS NULL;
    END IF;
    
    -- Update transport_mode if column exists (EnhancedItineraryCreator values)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'transport_mode') THEN
        UPDATE public.user_preferences SET transport_mode = 'walking' WHERE transport_mode IS NULL;
    END IF;
    
    -- Update pace if column exists (EnhancedItineraryCreator values: 'slow', 'moderate', 'fast')
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'pace') THEN
        UPDATE public.user_preferences SET pace = 'moderate' WHERE pace IS NULL;
    END IF;
    
    -- Update activities array if column exists (Onboarding step 3 values)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'activities') THEN
        UPDATE public.user_preferences SET activities = '{}' WHERE activities IS NULL;
    END IF;
    
    -- Update travel_style (ensure both components' values are supported)
    -- Onboarding: 'balanced', 'luxury', 'budget', 'adventure', 'relaxation', 'cultural'  
    -- EnhancedItineraryCreator: 'relaxed', 'active', 'cultural', 'luxury', 'budget', 'family'
    UPDATE public.user_preferences SET travel_style = 'cultural' WHERE travel_style IS NULL;
END $$;

-- Convert existing data to the new preferences_json format for better compatibility
-- This creates a unified format that works with both Onboarding and EnhancedItineraryCreator
DO $$
BEGIN
    -- Only update preferences_json if basic required columns exist
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'preferences_json') THEN
        
        UPDATE public.user_preferences
        SET preferences_json = 
          jsonb_build_object(
            -- Core fields that both components use
            'travelStyle', COALESCE(travel_style, 'cultural'),
            'budget', CASE 
              WHEN budget = 'Budget-friendly options' THEN 'budget'
              WHEN budget = 'Mid-range options' THEN 'mid-range' 
              WHEN budget = 'High-end options' THEN 'luxury'
              WHEN budget = 'Luxury experiences' THEN 'luxury'
              ELSE COALESCE(budget, 'mid-range')
            END,
            'lastUpdated', EXTRACT(EPOCH FROM COALESCE(updated_at, NOW())) * 1000,
            
            -- Enhanced fields (may not exist in all records)
            'interests', CASE 
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'interests') 
              THEN COALESCE(
                (SELECT jsonb_agg(jsonb_build_object('id', LOWER(REGEXP_REPLACE(interest, '\s', '', 'g')), 'label', interest))
                 FROM unnest(interests) AS interest), 
                '[]'::jsonb
              )
              ELSE '[]'::jsonb
            END,
            
            'activities', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'activities')
              THEN COALESCE(
                (SELECT jsonb_agg(activity) FROM unnest(activities) AS activity),
                '[]'::jsonb
              )
              ELSE '[]'::jsonb  
            END,
            
            'preferences', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'preferences')
              THEN COALESCE(
                (SELECT jsonb_agg(pref) FROM unnest(preferences) AS pref),
                '[]'::jsonb
              )
              ELSE '[]'::jsonb
            END,
            
            'travelGroup', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'travel_group')
              THEN COALESCE(travel_group, 'couple')
              ELSE 'couple'
            END,
            
            'transportMode', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'transport_mode')
              THEN COALESCE(transport_mode, 'walking')
              ELSE 'walking'
            END,
            
            'pace', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'pace')
              THEN COALESCE(pace, 'moderate')
              ELSE 'moderate'
            END,
            
            'dietaryPreferences', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'dietary_preferences')
              THEN COALESCE(
                (SELECT jsonb_agg(jsonb_build_object('id', LOWER(REGEXP_REPLACE(pref, '\s', '', 'g')), 'label', pref))
                 FROM unnest(dietary_preferences) AS pref),
                '[]'::jsonb
              )
              ELSE '[]'::jsonb
            END,
            
            'dreamDestinations', CASE
              WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'dream_destinations')
              THEN COALESCE(dream_destinations, '')
              ELSE ''
            END
          )
        WHERE preferences_json IS NULL;
        
        RAISE NOTICE 'Updated preferences_json for existing records with unified format';
    ELSE
        RAISE NOTICE 'Skipping preferences_json update - preferences_json column does not exist yet';
    END IF;
END $$; 