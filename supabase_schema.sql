-- ==============================================================================
-- MPLADS Risk Intelligence System — Supabase Database Schema
-- SIH26102, Team Neural Nova
-- 
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jriawilozamluyieoett/sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Citizen Reports Table (Grievances & Photographic Submissions)
CREATE TABLE IF NOT EXISTS public.citizen_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT UNIQUE NOT NULL,
    work_id TEXT NOT NULL,
    category TEXT,
    description TEXT NOT NULL,
    photo_filename TEXT,
    photo_url TEXT,
    captured_lat DOUBLE PRECISION,
    captured_lng DOUBLE PRECISION,
    captured_timestamp TIMESTAMPTZ,
    status TEXT DEFAULT 'submitted',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AI Cross-Verification Analysis Table (5-Signal Pipeline Results)
CREATE TABLE IF NOT EXISTS public.citizen_report_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,
    work_id TEXT NOT NULL,
    confidence_score INTEGER,
    location_check TEXT,
    visual_check TEXT,
    text_check TEXT,
    duplicate_check TEXT,
    metadata_check TEXT,
    ai_recommendation TEXT,
    ai_reasoning TEXT,
    verified_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Officer Feedback & Risk Score Adjustments (Dynamic Scoring Feedback Loop)
CREATE TABLE IF NOT EXISTS public.officer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id TEXT UNIQUE NOT NULL,
    work_id TEXT NOT NULL,
    verdict TEXT NOT NULL,
    officer_notes TEXT,
    officer_id TEXT NOT NULL,
    new_risk_score NUMERIC(5, 1),
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. Mandatory DISHA Physical Inspection Checklist Table
CREATE TABLE IF NOT EXISTS public.officer_checklists (
    work_id TEXT PRIMARY KEY,
    chk_exists BOOLEAN DEFAULT FALSE,
    chk_specs BOOLEAN DEFAULT FALSE,
    chk_duplicate BOOLEAN DEFAULT FALSE,
    chk_citizen BOOLEAN DEFAULT FALSE,
    chk_plaque BOOLEAN DEFAULT FALSE,
    chk_photo BOOLEAN DEFAULT FALSE,
    officer_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Photographic Chain of Custody (SHA-256 Hashes)
CREATE TABLE IF NOT EXISTS public.photo_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id TEXT NOT NULL,
    work_id TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    source TEXT DEFAULT 'citizen',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Auditor Action Audit Trail
CREATE TABLE IF NOT EXISTS public.audit_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id TEXT NOT NULL,
    action TEXT NOT NULL,
    work_id TEXT,
    meta JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) and grant read/write to service role
ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_report_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_action_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role key full access
CREATE POLICY "Service Role Full Access citizen_reports" ON public.citizen_reports FOR ALL USING (true);
CREATE POLICY "Service Role Full Access citizen_report_verifications" ON public.citizen_report_verifications FOR ALL USING (true);
CREATE POLICY "Service Role Full Access officer_feedback" ON public.officer_feedback FOR ALL USING (true);
CREATE POLICY "Service Role Full Access officer_checklists" ON public.officer_checklists FOR ALL USING (true);
CREATE POLICY "Service Role Full Access photo_hashes" ON public.photo_hashes FOR ALL USING (true);
CREATE POLICY "Service Role Full Access audit_action_logs" ON public.audit_action_logs FOR ALL USING (true);
