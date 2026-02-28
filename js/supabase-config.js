/* =====================================================
   Supabase Configuration
   =====================================================
   SETUP INSTRUCTIONS:
   1. Go to https://supabase.com and create a free account
   2. Create a new project (choose a region close to you)
   3. Go to Project Settings → API
   4. Copy your Project URL and anon/public key below
   5. Run the SQL schema in /supabase/schema.sql in the
      Supabase SQL Editor to create all required tables
   ===================================================== */

const SUPABASE_URL  = 'https://vwaimgbrxpkberbjlipm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YWltZ2JyeHBrYmVyYmpsaXBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODMyNjYsImV4cCI6MjA4Nzg1OTI2Nn0.O-cecyFcZifVOfTlRvJBbiwEk_7CnsjB9kM8RBbuQ7Q';

// Supabase JS client (loaded via CDN in each HTML file)
// window.supabase is set by the CDN script before this runs
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Storage bucket name (create this in Supabase Storage dashboard)
const REPORTS_BUCKET = 'reports';
