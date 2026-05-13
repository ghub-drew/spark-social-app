const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpezaqvtufrvvczyixwc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZXphcXZ0dWZydnZjenlpeHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDk5MTksImV4cCI6MjA5MzcyNTkxOX0.WzUQH4ZGn33Omv02m0ZtQgdYCXihGnHsOuhJmwGPXXI';

// Anon client — used for frontend Realtime subscriptions only
// RLS policies restrict this key to minimal access (subscribe to own messages)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Service role client — used for all server-side data operations
// Bypasses RLS entirely. Requires SUPABASE_SERVICE_KEY env var.
// Get your key: Supabase Dashboard → Project Settings → API → service_role key
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

module.exports = serviceClient;        // default export: service_role (bypasses RLS)
module.exports.anonClient = supabase;  // named export: anon key (for Realtime only)
