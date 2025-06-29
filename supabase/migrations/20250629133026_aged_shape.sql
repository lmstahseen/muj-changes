-- Disable RLS on all tables
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS community_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS earnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meeting_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meeting_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS community_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS member_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS community_rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meeting_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meeting_recordings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meeting_chat DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meeting_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_presence DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS typing_indicators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS report_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS report_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS member_penalties DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS moderation_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_streaks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transaction_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_payout_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS badges DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_badges DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leaderboards DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies on profiles table
DO $$
BEGIN
  -- Drop "Users can view their own profile" policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
  ) THEN
    DROP POLICY "Users can view their own profile" ON profiles;
  END IF;

  -- Drop "Users can update their own profile" policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    DROP POLICY "Users can update their own profile" ON profiles;
  END IF;

  -- Drop "Users can insert their own profile" policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile'
  ) THEN
    DROP POLICY "Users can insert their own profile" ON profiles;
  END IF;

  -- Drop "Allow profile creation during signup" policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Allow profile creation during signup'
  ) THEN
    DROP POLICY "Allow profile creation during signup" ON profiles;
  END IF;
END
$$;