-- Clean schema setup for Supabase - handles existing tables gracefully
-- This version will work even if some tables/policies already exist

-- Create extension for full text search and trigram matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;

DROP POLICY IF EXISTS "Users can view their own itineraries" ON itineraries;
DROP POLICY IF EXISTS "Users can insert their own itineraries" ON itineraries;
DROP POLICY IF EXISTS "Users can update their own itineraries" ON itineraries;
DROP POLICY IF EXISTS "Users can delete their own itineraries" ON itineraries;

DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;

DROP POLICY IF EXISTS "Users can view their own searches" ON saved_searches;
DROP POLICY IF EXISTS "Users can insert their own searches" ON saved_searches;
DROP POLICY IF EXISTS "Users can delete their own searches" ON saved_searches;

DROP POLICY IF EXISTS "Anyone can view suggestions" ON suggestions;
DROP POLICY IF EXISTS "Anyone can view destinations" ON destinations;

DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;

DROP POLICY IF EXISTS "Admins can manage all data" ON suggestions;
DROP POLICY IF EXISTS "Admins can manage all destinations" ON destinations;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;

-- Create user preferences table for storing detailed user preferences
-- Supports both Onboarding and EnhancedItineraryCreator components
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  -- Core preference fields
  travel_style TEXT DEFAULT 'cultural', -- Onboarding: 'balanced','luxury','budget','adventure','relaxation','cultural' | EnhancedItineraryCreator: 'relaxed','active','cultural','luxury','budget','family'
  interests TEXT[] DEFAULT '{}', -- EnhancedItineraryCreator interests as strings
  activities TEXT[] DEFAULT '{}', -- Onboarding step 3: 'sightseeing','food','relaxation','shopping','museums','adventure','nightlife','local'
  preferences TEXT[] DEFAULT '{}', -- Onboarding step 4: 'popular','hidden','local','international','public','private','guided','self'
  budget TEXT, -- Onboarding: description text | EnhancedItineraryCreator: 'budget','mid-range','luxury'
  dream_destinations TEXT, -- Onboarding step 2 free text field
  -- Enhanced preference fields (primarily for EnhancedItineraryCreator)
  travel_group TEXT DEFAULT 'couple', -- 'solo','couple','family','friends','business'
  transport_mode TEXT DEFAULT 'walking', -- 'walking','public','taxi','car'
  pace TEXT DEFAULT 'moderate', -- 'slow','moderate','fast'
  dietary_preferences TEXT[] DEFAULT '{}', -- Array of dietary restriction strings
  -- Legacy/compatibility fields
  preferred_accommodation TEXT,
  accessibility_needs TEXT[] DEFAULT '{}',
  preferred_transportation TEXT[] DEFAULT '{}',
  trip_duration INTEGER,
  -- Unified JSON storage for complex structures
  preferences_json JSONB DEFAULT NULL, -- Unified format with {id,label} objects
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create itineraries table
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create activities table for individual activities (optional for normalized storage)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  type TEXT,
  image_url TEXT,
  price_range TEXT,
  external_id TEXT,
  external_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create suggestions table for storing travel suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  duration TEXT,
  category TEXT,
  rating NUMERIC(3,1),
  price_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create a destinations table for commonly searched places
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  description TEXT,
  image_url TEXT,
  timezone TEXT,
  popular_seasons TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a saved_searches table to remember user's previous searches
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  query TEXT NOT NULL,
  destination TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a feedback table for user feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  feedback_type TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for user_preferences (users can only access their own)
CREATE POLICY "Users can view their own preferences" 
  ON user_preferences 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
  ON user_preferences 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
  ON user_preferences 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" 
  ON user_preferences 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policies for itineraries (users can only access their own)
CREATE POLICY "Users can view their own itineraries" 
  ON itineraries 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own itineraries" 
  ON itineraries 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries" 
  ON itineraries 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itineraries" 
  ON itineraries 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policies for activities (users can only access their own via itinerary relationship)
CREATE POLICY "Users can view their own activities" 
  ON activities 
  FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT user_id FROM itineraries WHERE id = itinerary_id
    )
  );

CREATE POLICY "Users can insert their own activities" 
  ON activities 
  FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM itineraries WHERE id = itinerary_id
    )
  );

CREATE POLICY "Users can update their own activities" 
  ON activities 
  FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT user_id FROM itineraries WHERE id = itinerary_id
    )
  );

CREATE POLICY "Users can delete their own activities" 
  ON activities 
  FOR DELETE 
  USING (
    auth.uid() IN (
      SELECT user_id FROM itineraries WHERE id = itinerary_id
    )
  );

-- Create policies for saved_searches (users can only access their own)
CREATE POLICY "Users can view their own searches" 
  ON saved_searches 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own searches" 
  ON saved_searches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own searches" 
  ON saved_searches 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policies for suggestions (public read, admin write)
CREATE POLICY "Anyone can view suggestions" 
  ON suggestions 
  FOR SELECT 
  USING (true);

-- Create policies for destinations (public read)
CREATE POLICY "Anyone can view destinations" 
  ON destinations 
  FOR SELECT 
  USING (true);

-- Create policies for feedback (users can submit and view their own)
CREATE POLICY "Users can view their own feedback" 
  ON feedback 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert feedback" 
  ON feedback 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admin policies (replace with your actual admin email if needed)
CREATE POLICY "Admins can manage all data" 
  ON suggestions 
  FOR ALL 
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'admin@example.com'));

CREATE POLICY "Admins can manage all destinations" 
  ON destinations 
  FOR ALL 
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'admin@example.com'));

CREATE POLICY "Admins can view all feedback" 
  ON feedback 
  FOR SELECT 
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'admin@example.com'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS itineraries_user_id_idx ON itineraries (user_id);
CREATE INDEX IF NOT EXISTS activities_itinerary_id_idx ON activities (itinerary_id);
CREATE INDEX IF NOT EXISTS activities_day_number_idx ON activities (itinerary_id, day_number);
CREATE INDEX IF NOT EXISTS suggestions_location_idx ON suggestions USING gin (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences (user_id);
CREATE INDEX IF NOT EXISTS user_preferences_travel_style_idx ON user_preferences (travel_style);
CREATE INDEX IF NOT EXISTS user_preferences_travel_group_idx ON user_preferences (travel_group);
CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_destination_idx ON saved_searches (destination);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_itineraries_updated_at ON itineraries;
CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON itineraries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_activities_updated_at ON activities;
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 