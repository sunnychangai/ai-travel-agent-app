-- Fix feedback table RLS policy to allow both authenticated and anonymous feedback submissions
-- This migration updates the feedback table policies to be more permissive for submissions

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;

-- Create a new policy that allows anyone to insert feedback
-- This is safe for feedback since it's a one-way submission system
CREATE POLICY "Anyone can insert feedback" 
  ON feedback 
  FOR INSERT 
  WITH CHECK (true);

-- Keep the existing view policy for authenticated users to see their own feedback
-- This policy already exists: "Users can view their own feedback"

-- Also ensure admins can view all feedback (this policy should already exist)
-- "Admins can view all feedback" policy should already be in place

-- Add a comment to document this change
COMMENT ON POLICY "Anyone can insert feedback" ON feedback IS 'Allows both authenticated and anonymous users to submit feedback for beta testing purposes'; 