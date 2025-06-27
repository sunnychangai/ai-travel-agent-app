# Fix Feedback Database Permissions

The feedback submission is failing because the database Row Level Security (RLS) policy is too restrictive. Here's how to fix it:

## Quick Fix - Run in Supabase SQL Editor

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Run this SQL command:**

```sql
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;

-- Create a new policy that allows anyone to insert feedback
CREATE POLICY "Anyone can insert feedback" 
  ON feedback 
  FOR INSERT 
  WITH CHECK (true);
```

4. **Click "Run" to execute**

## What This Does

- **Removes** the old policy that only allowed authenticated users whose user_id matched
- **Creates** a new policy that allows anyone (authenticated or anonymous) to submit feedback
- **Keeps** the existing policy that lets users view their own feedback
- **Maintains** admin access to view all feedback

## Why This Is Safe

- Feedback is a **one-way submission system** (users submit, admins receive)
- No sensitive data is exposed
- Users can still only view their own feedback (if authenticated)
- This is common for beta feedback systems

## Verify It Works

After running the SQL:
1. Go back to your app
2. Try submitting feedback again
3. You should see "Feedback submitted successfully!" instead of the database error

## Alternative: Manual Database Check

If you want to verify the current policies, run this query:

```sql
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'feedback';
```

This will show you all the current policies on the feedback table. 