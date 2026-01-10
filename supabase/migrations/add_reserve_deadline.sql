-- Migration: Add deadline column to reserves table
-- Run this in Supabase SQL Editor

ALTER TABLE public.reserves 
ADD COLUMN IF NOT EXISTS deadline date;

-- Done!
