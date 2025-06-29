/*
  # Disable All Row Level Security

  This migration disables RLS on all tables to ensure the application works properly
  without authentication barriers during development and testing.
*/

-- Disable RLS on all existing tables
ALTER TABLE communities DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE earnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_rewards DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies on communities table
DROP POLICY IF EXISTS "Anyone can view communities" ON communities;
DROP POLICY IF EXISTS "Authenticated users can create communities" ON communities;
DROP POLICY IF EXISTS "Creators can update their communities" ON communities;

-- Drop all existing RLS policies on community_members table
DROP POLICY IF EXISTS "Anyone can view community members" ON community_members;
DROP POLICY IF EXISTS "Authenticated users can join communities" ON community_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON community_members;

-- Drop all existing RLS policies on earnings table
DROP POLICY IF EXISTS "Users can view their own earnings" ON earnings;
DROP POLICY IF EXISTS "System can insert earnings" ON earnings;

-- Drop all existing RLS policies on meeting_sessions table
DROP POLICY IF EXISTS "Anyone can view meeting sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Community members can manage meetings" ON meeting_sessions;

-- Drop all existing RLS policies on meeting_attendance table
DROP POLICY IF EXISTS "Users can view meeting attendance" ON meeting_attendance;
DROP POLICY IF EXISTS "Users can manage their attendance" ON meeting_attendance;

-- Drop all existing RLS policies on member_progress table
DROP POLICY IF EXISTS "Users can view their progress" ON member_progress;
DROP POLICY IF EXISTS "Users can update their progress" ON member_progress;

-- Drop all existing RLS policies on community_analytics table
DROP POLICY IF EXISTS "Anyone can view community analytics" ON community_analytics;
DROP POLICY IF EXISTS "System can manage analytics" ON community_analytics;

-- Drop all existing RLS policies on community_rewards table
DROP POLICY IF EXISTS "Anyone can view community rewards" ON community_rewards;
DROP POLICY IF EXISTS "System can manage rewards" ON community_rewards;

-- Ensure all tables have RLS disabled
ALTER TABLE communities DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE earnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_rewards DISABLE ROW LEVEL SECURITY;