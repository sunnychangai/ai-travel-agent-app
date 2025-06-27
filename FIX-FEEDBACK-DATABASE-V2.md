# Fix Feedback Database Permissions - Updated Solution

The feedback submission is still failing due to complex RLS policies. Here's a complete fix that removes all problematic policies and creates simple ones.

## Complete Fix - Run in Supabase SQL Editor

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Run this SQL command:**

```sql
-- Remove ALL existing policies on feedback table
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;

-- Create simple policies that work for everyone
CREATE POLICY "Allow all feedback submissions" 
  ON feedback 
  FOR INSERT 
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow users to view own feedback" 
  ON feedback 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow anonymous feedback viewing" 
  ON feedback 
  FOR SELECT 
  TO anon
  USING (user_id IS NULL);
```

4. **Click "Run" to execute**

## What This Does

- **Removes** all existing conflicting policies
- **Creates** a simple policy that allows anyone to submit feedback
- **Allows** authenticated users to view their own feedback
- **Allows** anonymous users to view anonymous feedback
- **No complex auth.users table references** that cause permission issues

## Alternative: Disable RLS Completely (If Above Doesn't Work)

If you're still having issues, you can temporarily disable RLS on the feedback table:

```sql
-- Disable RLS entirely for feedback table (temporary solution)
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
```

**Note:** This makes the feedback table completely open, which is fine for a beta feedback system but you might want to re-enable it later with proper policies.

## Verify It Works

After running the SQL:
1. Go back to your app
2. Try submitting feedback again
3. Check the browser console for any remaining errors

## If You Still Get Errors

Check the exact error message in the browser console and let me know. The error might be related to:
- Missing environment variables
- Network connectivity to Supabase
- Different table structure than expected 