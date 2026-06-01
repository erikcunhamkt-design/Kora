-- Migration: Add approved_at and rejected_at to quotes table
-- Timestamp: 2026-06-01 01:00:00

ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;
