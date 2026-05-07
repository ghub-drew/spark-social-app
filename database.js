const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hpezaqvtufrvvczyixwc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZXphcXZ0dWZydnZjenlpeHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDk5MTksImV4cCI6MjA5MzcyNTkxOX0.WzUQH4ZGn33Omv02m0ZtQgdYCXihGnHsOuhJmwGPXXI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = supabase;
