/*
  # Automated Backend Processes & Edge Functions

  1. Scheduled Jobs
    - Community lifecycle management
    - Earnings distribution
    - Report resolution
    - Gamification updates
    - Notification delivery
    - Data integrity and cleanup

  2. Functions
    - Automated status transitions
    - Meeting cleanup
    - Recording management
    - Streak calculation
    - Leaderboard updates
    - Notification generation

  3. Triggers
    - Trigger community transitions
    - Trigger earnings distribution
    - Trigger report resolution
    - Trigger badge awards
*/

-- Function to schedule daily community status updates
CREATE OR REPLACE FUNCTION schedule_community_status_updates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This would be called by a cron job in production
  PERFORM update_community_status();
END;
$$;

-- Function to schedule daily streak calculations
CREATE OR REPLACE FUNCTION schedule_streak_calculations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Process all users
  FOR user_record IN
    SELECT DISTINCT user_id FROM community_members
  LOOP
    -- Calculate overall streak
    PERFORM calculate_user_streak(user_record.user_id);
    
    -- Update user statistics
    PERFORM update_user_statistics(user_record.user_id);
  END LOOP;
END;
$$;

-- Function to schedule leaderboard updates
CREATE OR REPLACE FUNCTION schedule_leaderboard_updates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all leaderboard types for all periods
  PERFORM update_leaderboards('earnings', 'all_time');
  PERFORM update_leaderboards('hours', 'all_time');
  PERFORM update_leaderboards('streak', 'all_time');
  PERFORM update_leaderboards('communities_won', 'all_time');
  
  -- Update monthly leaderboards
  PERFORM update_leaderboards('earnings', 'monthly');
  PERFORM update_leaderboards('hours', 'monthly');
  PERFORM update_leaderboards('communities_won', 'monthly');
  
  -- Update weekly leaderboards
  PERFORM update_leaderboards('earnings', 'weekly');
  PERFORM update_leaderboards('hours', 'weekly');
  PERFORM update_leaderboards('communities_won', 'weekly');
END;
$$;

-- Function to schedule meeting cleanup
CREATE OR REPLACE FUNCTION schedule_meeting_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean up inactive meetings
  PERFORM cleanup_inactive_meetings();
  
  -- Clean up old recordings
  PERFORM cleanup_old_recordings();
END;
$$;

-- Function to schedule notification cleanup
CREATE OR REPLACE FUNCTION schedule_notification_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete old read notifications (older than 30 days)
  DELETE FROM chat_notifications
  WHERE is_read = true
    AND created_at < now() - interval '30 days';
END;
$$;

-- Function to generate meeting reminders
CREATE OR REPLACE FUNCTION generate_meeting_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  upcoming_meeting RECORD;
  community_member RECORD;
BEGIN
  -- Find meetings scheduled in the next 24 hours
  FOR upcoming_meeting IN
    SELECT 
      ms.id,
      ms.community_id,
      ms.session_date,
      ms.start_time,
      c.title as community_title
    FROM meeting_sessions ms
    JOIN communities c ON ms.community_id = c.id
    WHERE ms.status = 'scheduled'
      AND ms.start_time BETWEEN now() AND now() + interval '24 hours'
  LOOP
    -- Create notifications for all community members
    FOR community_member IN
      SELECT user_id
      FROM community_members
      WHERE community_id = upcoming_meeting.community_id
        AND is_disqualified = false
    LOOP
      -- Create notification
      INSERT INTO chat_notifications (
        user_id,
        community_id,
        notification_type,
        title,
        content,
        is_read
      )
      VALUES (
        community_member.user_id,
        upcoming_meeting.community_id,
        'meeting_reminder',
        'Upcoming Meeting Reminder',
        'You have a meeting for "' || upcoming_meeting.community_title || '" scheduled on ' || 
        to_char(upcoming_meeting.start_time, 'YYYY-MM-DD HH24:MI'),
        false
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Function to generate community start reminders
CREATE OR REPLACE FUNCTION generate_community_start_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  upcoming_community RECORD;
  community_member RECORD;
BEGIN
  -- Find communities starting in the next 24 hours
  FOR upcoming_community IN
    SELECT 
      c.id,
      c.title,
      c.start_date
    FROM communities c
    WHERE c.status = 'waiting'
      AND c.start_date = CURRENT_DATE + 1
  LOOP
    -- Create notifications for all community members
    FOR community_member IN
      SELECT user_id
      FROM community_members
      WHERE community_id = upcoming_community.id
    LOOP
      -- Create notification
      INSERT INTO chat_notifications (
        user_id,
        community_id,
        notification_type,
        title,
        content,
        is_read
      )
      VALUES (
        community_member.user_id,
        upcoming_community.id,
        'community_update',
        'Community Starting Tomorrow',
        'The community "' || upcoming_community.title || '" will start tomorrow. Get ready to begin working on your goals!',
        false
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Function to generate streak warning notifications
CREATE OR REPLACE FUNCTION generate_streak_warnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find users with active streaks who haven't logged activity today
  FOR user_record IN
    SELECT 
      us.user_id,
      us.current_streak
    FROM user_streaks us
    WHERE us.current_streak >= 3 -- Only warn for meaningful streaks
      AND us.community_id IS NULL -- Overall streaks
      AND us.last_active_date < CURRENT_DATE
      AND us.last_active_date >= CURRENT_DATE - interval '1 day' -- Only those who were active yesterday
  LOOP
    -- Create streak warning notification
    INSERT INTO chat_notifications (
      user_id,
      community_id,
      notification_type,
      title,
      content,
      is_read
    )
    VALUES (
      user_record.user_id,
      NULL,
      'community_update',
      'Streak at Risk!',
      'Your ' || user_record.current_streak || '-day streak is at risk! Log activity today to maintain it.',
      false
    );
  END LOOP;
END;
$$;

-- Function to check for abandoned communities
CREATE OR REPLACE FUNCTION check_abandoned_communities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_record RECORD;
BEGIN
  -- Find active communities with no recent activity (no meetings in last 7 days)
  FOR community_record IN
    SELECT 
      c.id,
      c.title,
      c.creator_id
    FROM communities c
    WHERE c.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM meeting_sessions ms
        WHERE ms.community_id = c.id
          AND ms.start_time > now() - interval '7 days'
      )
  LOOP
    -- Notify creator
    INSERT INTO chat_notifications (
      user_id,
      community_id,
      notification_type,
      title,
      content,
      is_read
    )
    VALUES (
      community_record.creator_id,
      community_record.id,
      'community_update',
      'Community Inactivity Warning',
      'Your community "' || community_record.title || '" has had no meetings in the past 7 days. Consider scheduling a meeting to keep momentum going!',
      false
    );
  END LOOP;
END;
$$;

-- Function to process community end and distribute earnings
CREATE OR REPLACE FUNCTION trigger_community_end_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- If community status changed to 'ended', trigger distribution
  IF OLD.status != 'ended' AND NEW.status = 'ended' THEN
    -- Calculate distribution
    PERFORM calculate_community_distribution(NEW.id);
    
    -- Distribute earnings
    PERFORM distribute_community_earnings(NEW.id);
    
    -- Notify members
    PERFORM notify_distribution_complete(NEW.id, NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for community end processing
DROP TRIGGER IF EXISTS community_end_distribution ON communities;
CREATE TRIGGER community_end_distribution
  AFTER UPDATE OF status ON communities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_community_end_processing();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION schedule_community_status_updates TO service_role;
GRANT EXECUTE ON FUNCTION schedule_streak_calculations TO service_role;
GRANT EXECUTE ON FUNCTION schedule_leaderboard_updates TO service_role;
GRANT EXECUTE ON FUNCTION schedule_meeting_cleanup TO service_role;
GRANT EXECUTE ON FUNCTION schedule_notification_cleanup TO service_role;
GRANT EXECUTE ON FUNCTION generate_meeting_reminders TO service_role;
GRANT EXECUTE ON FUNCTION generate_community_start_reminders TO service_role;
GRANT EXECUTE ON FUNCTION generate_streak_warnings TO service_role;
GRANT EXECUTE ON FUNCTION check_abandoned_communities TO service_role;