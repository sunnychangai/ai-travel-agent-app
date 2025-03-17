-- Create extension for full text search and trigram matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create user preferences table for storing detailed user preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  travel_style TEXT,
  interests TEXT[] DEFAULT '{}',
  budget TEXT,
  preferred_accommodation TEXT,
  dietary_restrictions TEXT[] DEFAULT '{}',
  accessibility_needs TEXT[] DEFAULT '{}',
  preferred_transportation TEXT[] DEFAULT '{}',
  trip_duration INTEGER,
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

-- Admin policies (replace admin@example.com with your actual admin email)
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
CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_destination_idx ON saved_searches (destination);

-- Sample data for suggestions (keep existing data)
INSERT INTO suggestions (title, description, location, image_url, duration, category, rating, price_level)
VALUES 
  ('Visit the Eiffel Tower', 'Iconic iron lattice tower on the Champ de Mars in Paris, France.', 'Paris, France', 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&q=80', '2 hours', 'Sightseeing', 4.7, '$$'),
  ('Louvre Museum Tour', 'World''s largest art museum and a historic monument in Paris, France.', 'Paris, France', 'https://images.unsplash.com/photo-1565099824688-e8c8a1b09978?w=400&q=80', '3 hours', 'Museum', 4.8, '$$'),
  ('Seine River Cruise', 'Scenic boat tour along the Seine River with views of Paris landmarks.', 'Paris, France', 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80', '1 hour', 'Tour', 4.5, '$$'),
  ('Visit Colosseum', 'Ancient Roman amphitheater in the center of Rome.', 'Rome, Italy', 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80', '2 hours', 'Historic Site', 4.8, '$$'),
  ('Tour the Vatican Museums', 'World-renowned Roman Catholic art museums located within Vatican City.', 'Rome, Italy', 'https://images.unsplash.com/photo-1559554498-a15efa4d136b?w=400&q=80', '3 hours', 'Museum', 4.9, '$$'),
  ('Walk the Freedom Trail', 'A 2.5-mile-long path through downtown Boston that passes 16 locations significant to the history of the United States.', 'Boston, USA', 'https://images.unsplash.com/photo-1569260196907-aeee84556244?w=400&q=80', '3 hours', 'Walking Tour', 4.6, 'Free')
ON CONFLICT DO NOTHING;

-- Sample data for destinations
INSERT INTO destinations (name, country, description, image_url, timezone, popular_seasons)
VALUES
  ('Paris', 'France', 'The City of Light is known for its stunning architecture, art museums, historical monuments, and culinary scene.', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80', 'Europe/Paris', '{Spring,Summer,Fall}'),
  ('Rome', 'Italy', 'The Eternal City is a treasure trove of ancient history, with stunning architecture and artistic masterpieces at every turn.', 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80', 'Europe/Rome', '{Spring,Fall}'),
  ('Tokyo', 'Japan', 'A city where ultra-modern and traditional blend, from neon-lit skyscrapers to historic temples.', 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80', 'Asia/Tokyo', '{Spring,Fall}'),
  ('New York City', 'USA', 'The Big Apple is a global center for art, fashion, food, and theater with iconic sites at every turn.', 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80', 'America/New_York', '{Spring,Fall}'),
  ('Barcelona', 'Spain', 'Known for its art and architecture, Barcelona is home to the unfinished Sagrada Família church and other modernist landmarks.', 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&q=80', 'Europe/Madrid', '{Spring,Summer,Fall}')
ON CONFLICT DO NOTHING; 