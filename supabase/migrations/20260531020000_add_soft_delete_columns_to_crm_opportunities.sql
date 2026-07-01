-- Migration: add soft delete columns to crm_opportunities
-- Timestamp: 2026-05-31 02:00:00 (posterior à criação da tabela crm_opportunities)

ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL;
