-- ═══════════════════════════════════════════════════════════════════
-- Enable Row-Level Security on all tables
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Enable RLS on all tables ──────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ── 2. Drop any existing policies (clean slate) ──────────────────
DROP POLICY IF EXISTS "anon_read_users" ON users;
DROP POLICY IF EXISTS "anon_read_messages" ON messages;
DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
DROP POLICY IF EXISTS "service_role_all_users" ON users;
DROP POLICY IF EXISTS "service_role_all_messages" ON messages;

-- ── 3. Anon key policies (for frontend Realtime subscriptions) ───
-- The anon key can only subscribe to INSERT events on messages
-- This is needed for browser notification subscriptions in global.js

CREATE POLICY "anon_select_messages_for_realtime" ON messages
  FOR SELECT
  TO anon
  USING (true);  -- Realtime subscriptions need to SELECT to receive INSERT events
                 -- The API server (service_role) handles all actual data access

-- ── 4. Service role policies (full access) ───────────────────────
-- The service_role key (used by api/index.js & server.js) bypasses RLS
-- by default, so these are mostly documentation. But explicit policies
-- are cleaner.

CREATE POLICY "service_role_all_users" ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_messages" ON messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_contacts" ON contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- Verify: these queries should return the policies you just created
-- ═══════════════════════════════════════════════════════════════════
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
