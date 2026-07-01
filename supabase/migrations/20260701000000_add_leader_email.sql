-- Add leader_email column to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS leader_email TEXT;
