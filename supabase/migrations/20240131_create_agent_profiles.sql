-- Create agent_profiles table
CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    bank_details JSONB,
    id_card_url TEXT,
    guarantors JSONB,
    status TEXT DEFAULT 'pending'::text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own agent profile"
    ON public.agent_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow users to view their own profile
CREATE POLICY "Users can view their own agent profile"
    ON public.agent_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Allow admins to view all agent profiles (assuming admin role exists)
-- This might need adjustment based on specific admin implementation, but for now RLS is strict.
