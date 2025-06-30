-- FINAL FIX: Feedback Database Permissions for Live App
-- This migration completely fixes the feedback submission issue
-- Run this in your Supabase SQL Editor for the live database

-- Step 1: Remove ALL existing conflicting policies on the feedback table
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Allow all feedback submissions" ON feedback;
DROP POLICY IF EXISTS "Allow users to view own feedback" ON feedback;
DROP POLICY IF EXISTS "Allow anonymous feedback viewing" ON feedback;

-- Step 2: Create simple, working policies
-- Policy 1: Allow ANYONE to submit feedback (this is the key fix)
CREATE POLICY "feedback_insert_policy" 
  ON feedback 
  FOR INSERT 
  WITH CHECK (true);

-- Policy 2: Allow authenticated users to view their own feedback
CREATE POLICY "feedback_select_own_policy" 
  ON feedback 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy 3: Allow anonymous users to view anonymous feedback (optional)
CREATE POLICY "feedback_select_anonymous_policy" 
  ON feedback 
  FOR SELECT 
  USING (user_id IS NULL);

-- Step 3: Ensure the feedback table structure is correct
-- This will not break if columns already exist
ALTER TABLE feedback 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS feedback_type TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS content TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Step 4: Ensure RLS is enabled
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Step 5: Add helpful comments
COMMENT ON POLICY "feedback_insert_policy" ON feedback IS 'Allows anyone (authenticated or anonymous) to submit feedback';
COMMENT ON POLICY "feedback_select_own_policy" ON feedback IS 'Allows authenticated users to view their own feedback';
COMMENT ON POLICY "feedback_select_anonymous_policy" ON feedback IS 'Allows viewing of anonymous feedback';

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback (user_id);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);

-- Verification query (optional - shows current policies)
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'feedback'; 