-- Create monthly_closings table
CREATE TABLE IF NOT EXISTS public.monthly_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'skipped')),
    surplus_amount NUMERIC NOT NULL DEFAULT 0,
    action_taken TEXT CHECK (action_taken IN ('saved_to_reserve', 'kept_in_account', 'distributed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, month, year)
);

-- Add RLS policies
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly closings"
    ON public.monthly_closings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly closings"
    ON public.monthly_closings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly closings"
    ON public.monthly_closings FOR UPDATE
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.monthly_closings TO authenticated;
GRANT ALL ON public.monthly_closings TO service_role;
