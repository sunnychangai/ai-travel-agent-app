-- Add dream_destinations column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_preferences' 
        AND column_name = 'dream_destinations'
    ) THEN
        ALTER TABLE public.user_preferences ADD COLUMN dream_destinations TEXT;
    END IF;
END $$; 