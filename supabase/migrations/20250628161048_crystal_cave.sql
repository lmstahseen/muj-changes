/*
  # Gamification System & User Progress Tracking

  1. New Tables
    - `user_streaks` - Track user activity streaks
    - `user_badges` - Store awarded badges
    - `badges` - Define available badges
    - `user_statistics` - Store comprehensive user statistics
    - `leaderboards` - Store calculated leaderboard rankings

  2. Functions
    - `calculate_user_streak()` - Calculate and update user streaks
    - `award_badges()` - Check and award badges based on achievements
    - `update_leaderboards()` - Calculate and update global leaderboards
    - `get_user_statistics()` - Get comprehensive user statistics

  3. Triggers
    - Automatically update streaks when progress is logged
    - Automatically check for badge awards when statistics change
*/

-- Create user_streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_active_date date,
  streak_start_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, community_id)
);

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('achievement', 'consistency', 'participation', 'community')),
  rarity text NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  criteria jsonb NOT NULL,
  icon_name text,
  created_at timestamptz DEFAULT now()
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  UNIQUE(user_id, badge_id)
);

-- Create user_statistics table
CREATE TABLE IF NOT EXISTS user_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_hours_logged numeric(10,2) DEFAULT 0,
  communities_joined integer DEFAULT 0,
  communities_won integer DEFAULT 0,
  communities_lost integer DEFAULT 0,
  total_earnings integer DEFAULT 0, -- in cents
  total_losses integer DEFAULT 0, -- in cents
  longest_streak integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  meetings_attended integer DEFAULT 0,
  goals_completed integer DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0,
  platform_tenure_days integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type text NOT NULL CHECK (leaderboard_type IN ('earnings', 'hours', 'streak', 'communities_won')),
  period text NOT NULL CHECK (period IN ('all_time', 'monthly', 'weekly')),
  year integer,
  month integer,
  week integer,
  rankings jsonb NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(leaderboard_type, period, year, month, week)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_type_period ON leaderboards(leaderboard_type, period);

-- Function to calculate user streak
CREATE OR REPLACE FUNCTION calculate_user_streak(
  p_user_id uuid,
  p_community_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today date := CURRENT_DATE;
  yesterday date := today - interval '1 day';
  last_active date;
  current_streak integer := 0;
  longest_streak integer := 0;
  streak_start date;
  has_activity boolean;
BEGIN
  -- Get user's streak record
  SELECT 
    us.current_streak, 
    us.longest_streak, 
    us.last_active_date,
    us.streak_start_date
  INTO 
    current_streak, 
    longest_streak, 
    last_active, 
    streak_start
  FROM user_streaks us
  WHERE us.user_id = p_user_id
    AND (p_community_id IS NULL OR us.community_id = p_community_id);
  
  -- Check if user has activity today
  SELECT EXISTS (
    SELECT 1 
    FROM member_progress mp
    WHERE mp.user_id = p_user_id
      AND mp.date = today
      AND (p_community_id IS NULL OR mp.community_id = p_community_id)
  ) INTO has_activity;
  
  -- If no existing streak record, create one
  IF current_streak IS NULL THEN
    current_streak := CASE WHEN has_activity THEN 1 ELSE 0 END;
    longest_streak := current_streak;
    last_active := CASE WHEN has_activity THEN today ELSE NULL END;
    streak_start := CASE WHEN has_activity THEN today ELSE NULL END;
  ELSE
    -- Update streak based on activity
    IF has_activity THEN
      -- If active today, check if continuing streak
      IF last_active = yesterday THEN
        -- Continuing streak
        current_streak := current_streak + 1;
        last_active := today;
      ELSIF last_active < yesterday THEN
        -- Streak broken, start new streak
        current_streak := 1;
        streak_start := today;
        last_active := today;
      ELSIF last_active = today THEN
        -- Already counted today, no change
        NULL;
      END IF;
    ELSE
      -- No activity today, check if streak is broken
      IF last_active < yesterday THEN
        -- Streak already broken
        current_streak := 0;
        streak_start := NULL;
      END IF;
    END IF;
    
    -- Update longest streak if needed
    IF current_streak > longest_streak THEN
      longest_streak := current_streak;
    END IF;
  END IF;
  
  -- Update or insert streak record
  INSERT INTO user_streaks (
    user_id,
    community_id,
    current_streak,
    longest_streak,
    last_active_date,
    streak_start_date,
    updated_at
  )
  VALUES (
    p_user_id,
    p_community_id,
    current_streak,
    longest_streak,
    last_active,
    streak_start,
    now()
  )
  ON CONFLICT (user_id, COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    last_active_date = EXCLUDED.last_active_date,
    streak_start_date = EXCLUDED.streak_start_date,
    updated_at = now();
  
  -- Update user statistics with streak info
  UPDATE user_statistics
  SET 
    current_streak = current_streak,
    longest_streak = longest_streak,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN current_streak;
END;
$$;

-- Function to update user statistics
CREATE OR REPLACE FUNCTION update_user_statistics(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_hours numeric(10,2);
  v_communities_joined integer;
  v_communities_won integer;
  v_communities_lost integer;
  v_total_earnings integer;
  v_total_losses integer;
  v_meetings_attended integer;
  v_goals_completed integer;
  v_success_rate numeric(5,2);
  v_platform_tenure_days integer;
  v_longest_streak integer;
  v_current_streak integer;
BEGIN
  -- Calculate total hours logged
  SELECT COALESCE(SUM(mp.hours_logged), 0)
  INTO v_total_hours
  FROM member_progress mp
  WHERE mp.user_id = p_user_id;
  
  -- Add meeting hours
  SELECT v_total_hours + COALESCE(SUM(ma.duration_seconds) / 3600.0, 0)
  INTO v_total_hours
  FROM meeting_attendance ma
  WHERE ma.user_id = p_user_id;
  
  -- Calculate community statistics
  SELECT 
    COUNT(DISTINCT cm.community_id),
    COUNT(DISTINCT CASE WHEN e.type = 'reward' THEN cm.community_id END),
    COUNT(DISTINCT CASE WHEN cm.is_disqualified OR (c.status = 'ended' AND NOT EXISTS (
      SELECT 1 FROM earnings e2 WHERE e2.user_id = cm.user_id AND e2.community_id = cm.community_id AND e2.type = 'reward'
    )) THEN cm.community_id END)
  INTO 
    v_communities_joined,
    v_communities_won,
    v_communities_lost
  FROM community_members cm
  LEFT JOIN communities c ON cm.community_id = c.id
  LEFT JOIN earnings e ON e.user_id = cm.user_id AND e.community_id = cm.community_id AND e.type = 'reward'
  WHERE cm.user_id = p_user_id;
  
  -- Calculate earnings and losses
  SELECT 
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
  INTO 
    v_total_earnings,
    v_total_losses
  FROM earnings
  WHERE user_id = p_user_id;
  
  -- Calculate meetings attended
  SELECT COUNT(DISTINCT meeting_session_id)
  INTO v_meetings_attended
  FROM meeting_attendance
  WHERE user_id = p_user_id;
  
  -- Calculate goals completed
  SELECT COALESCE(SUM(goals_completed), 0)
  INTO v_goals_completed
  FROM member_progress
  WHERE user_id = p_user_id;
  
  -- Calculate success rate
  IF v_communities_joined > 0 THEN
    v_success_rate := (v_communities_won::numeric / v_communities_joined) * 100;
  ELSE
    v_success_rate := 0;
  END IF;
  
  -- Calculate platform tenure
  SELECT EXTRACT(DAY FROM (now() - MIN(joined_at)))::integer
  INTO v_platform_tenure_days
  FROM community_members
  WHERE user_id = p_user_id;
  
  -- Get streak information
  SELECT longest_streak, current_streak
  INTO v_longest_streak, v_current_streak
  FROM user_streaks
  WHERE user_id = p_user_id AND community_id IS NULL;
  
  -- Insert or update user statistics
  INSERT INTO user_statistics (
    user_id,
    total_hours_logged,
    communities_joined,
    communities_won,
    communities_lost,
    total_earnings,
    total_losses,
    longest_streak,
    current_streak,
    meetings_attended,
    goals_completed,
    success_rate,
    platform_tenure_days,
    last_updated
  )
  VALUES (
    p_user_id,
    v_total_hours,
    v_communities_joined,
    v_communities_won,
    v_communities_lost,
    v_total_earnings,
    v_total_losses,
    COALESCE(v_longest_streak, 0),
    COALESCE(v_current_streak, 0),
    v_meetings_attended,
    v_goals_completed,
    v_success_rate,
    COALESCE(v_platform_tenure_days, 0),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_hours_logged = EXCLUDED.total_hours_logged,
    communities_joined = EXCLUDED.communities_joined,
    communities_won = EXCLUDED.communities_won,
    communities_lost = EXCLUDED.communities_lost,
    total_earnings = EXCLUDED.total_earnings,
    total_losses = EXCLUDED.total_losses,
    longest_streak = EXCLUDED.longest_streak,
    current_streak = EXCLUDED.current_streak,
    meetings_attended = EXCLUDED.meetings_attended,
    goals_completed = EXCLUDED.goals_completed,
    success_rate = EXCLUDED.success_rate,
    platform_tenure_days = EXCLUDED.platform_tenure_days,
    last_updated = EXCLUDED.last_updated,
    updated_at = now();
    
  -- Check for badge awards after statistics update
  PERFORM award_badges(p_user_id);
END;
$$;

-- Function to award badges
CREATE OR REPLACE FUNCTION award_badges(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  badge_record record;
  user_stats record;
  criteria_met boolean;
BEGIN
  -- Get user statistics
  SELECT * INTO user_stats
  FROM user_statistics
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN; -- No statistics found
  END IF;
  
  -- Check each badge
  FOR badge_record IN
    SELECT * FROM badges
    WHERE id NOT IN (
      SELECT badge_id FROM user_badges WHERE user_id = p_user_id
    )
  LOOP
    criteria_met := false;
    
    -- Check badge criteria
    CASE badge_record.category
      WHEN 'achievement' THEN
        -- Achievement badges (goals completed, communities won)
        IF badge_record.name = 'First Goal' AND user_stats.communities_won >= 1 THEN
          criteria_met := true;
        ELSIF badge_record.name = '5 Communities Conquered' AND user_stats.communities_won >= 5 THEN
          criteria_met := true;
        ELSIF badge_record.name = 'Goal Master' AND user_stats.communities_won >= 10 THEN
          criteria_met := true;
        END IF;
        
      WHEN 'consistency' THEN
        -- Consistency badges (streaks)
        IF badge_record.name = '7-Day Streak' AND user_stats.longest_streak >= 7 THEN
          criteria_met := true;
        ELSIF badge_record.name = '30-Day Streak' AND user_stats.longest_streak >= 30 THEN
          criteria_met := true;
        ELSIF badge_record.name = 'Streak Master' AND user_stats.longest_streak >= 90 THEN
          criteria_met := true;
        END IF;
        
      WHEN 'participation' THEN
        -- Participation badges (hours logged, meetings attended)
        IF badge_record.name = '10 Hours Logged' AND user_stats.total_hours_logged >= 10 THEN
          criteria_met := true;
        ELSIF badge_record.name = '100 Hours Logged' AND user_stats.total_hours_logged >= 100 THEN
          criteria_met := true;
        ELSIF badge_record.name = 'Meeting Master' AND user_stats.meetings_attended >= 50 THEN
          criteria_met := true;
        END IF;
        
      WHEN 'community' THEN
        -- Community badges (ROI, success rate)
        IF badge_record.name = 'High Achiever' AND user_stats.success_rate >= 90 THEN
          criteria_met := true;
        ELSIF badge_record.name = 'Big Winner' AND user_stats.total_earnings >= 100000 THEN -- $1000
          criteria_met := true;
        END IF;
    END CASE;
    
    -- Award badge if criteria met
    IF criteria_met THEN
      INSERT INTO user_badges (
        user_id,
        badge_id,
        awarded_at,
        metadata
      )
      VALUES (
        p_user_id,
        badge_record.id,
        now(),
        jsonb_build_object(
          'stats_at_award', jsonb_build_object(
            'total_hours_logged', user_stats.total_hours_logged,
            'communities_won', user_stats.communities_won,
            'longest_streak', user_stats.longest_streak,
            'success_rate', user_stats.success_rate
          )
        )
      );
      
      -- Create notification for badge award
      INSERT INTO chat_notifications (
        user_id,
        community_id,
        notification_type,
        title,
        content,
        is_read
      )
      VALUES (
        p_user_id,
        NULL,
        'community_update',
        'New Badge Earned!',
        'Congratulations! You''ve earned the "' || badge_record.name || '" badge: ' || badge_record.description,
        false
      );
    END IF;
  END LOOP;
END;
$$;

-- Function to update leaderboards
CREATE OR REPLACE FUNCTION update_leaderboards(
  p_leaderboard_type text,
  p_period text,
  p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  p_month integer DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  p_week integer DEFAULT EXTRACT(WEEK FROM CURRENT_DATE)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_date date;
  end_date date;
  rankings jsonb;
BEGIN
  -- Determine date range based on period
  CASE p_period
    WHEN 'all_time' THEN
      start_date := '1970-01-01'::date;
      end_date := CURRENT_DATE;
    WHEN 'monthly' THEN
      start_date := make_date(p_year, p_month, 1);
      end_date := (start_date + interval '1 month')::date - interval '1 day';
    WHEN 'weekly' THEN
      -- This is a simplified calculation - in production you'd want more precise week handling
      start_date := date_trunc('week', make_date(p_year, 1, 1) + ((p_week - 1) * interval '7 days'))::date;
      end_date := (start_date + interval '7 days')::date - interval '1 day';
  END CASE;
  
  -- Calculate rankings based on leaderboard type
  CASE p_leaderboard_type
    WHEN 'earnings' THEN
      -- Earnings leaderboard
      SELECT jsonb_agg(
        jsonb_build_object(
          'rank', row_number,
          'user_id', user_id,
          'value', earnings_value,
          'previous_rank', previous_rank
        )
        ORDER BY row_number
      )
      INTO rankings
      FROM (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) DESC) as row_number,
          user_id,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as earnings_value,
          NULL::integer as previous_rank -- In production, you'd track previous ranks
        FROM earnings
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY user_id
        ORDER BY earnings_value DESC
        LIMIT 100
      ) as ranked_users;
      
    WHEN 'hours' THEN
      -- Hours logged leaderboard
      SELECT jsonb_agg(
        jsonb_build_object(
          'rank', row_number,
          'user_id', user_id,
          'value', hours_value,
          'previous_rank', previous_rank
        )
        ORDER BY row_number
      )
      INTO rankings
      FROM (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(hours_logged), 0) DESC) as row_number,
          user_id,
          COALESCE(SUM(hours_logged), 0) as hours_value,
          NULL::integer as previous_rank
        FROM member_progress
        WHERE date BETWEEN start_date AND end_date
        GROUP BY user_id
        ORDER BY hours_value DESC
        LIMIT 100
      ) as ranked_users;
      
    WHEN 'streak' THEN
      -- Streak leaderboard
      SELECT jsonb_agg(
        jsonb_build_object(
          'rank', row_number,
          'user_id', user_id,
          'value', streak_value,
          'previous_rank', previous_rank
        )
        ORDER BY row_number
      )
      INTO rankings
      FROM (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY COALESCE(longest_streak, 0) DESC) as row_number,
          user_id,
          COALESCE(longest_streak, 0) as streak_value,
          NULL::integer as previous_rank
        FROM user_streaks
        WHERE community_id IS NULL
        ORDER BY streak_value DESC
        LIMIT 100
      ) as ranked_users;
      
    WHEN 'communities_won' THEN
      -- Communities won leaderboard
      SELECT jsonb_agg(
        jsonb_build_object(
          'rank', row_number,
          'user_id', user_id,
          'value', communities_won,
          'previous_rank', previous_rank
        )
        ORDER BY row_number
      )
      INTO rankings
      FROM (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT community_id) DESC) as row_number,
          user_id,
          COUNT(DISTINCT community_id) as communities_won,
          NULL::integer as previous_rank
        FROM earnings
        WHERE type = 'reward'
          AND created_at BETWEEN start_date AND end_date
        GROUP BY user_id
        ORDER BY communities_won DESC
        LIMIT 100
      ) as ranked_users;
  END CASE;
  
  -- Insert or update leaderboard
  INSERT INTO leaderboards (
    leaderboard_type,
    period,
    year,
    month,
    week,
    rankings,
    calculated_at
  )
  VALUES (
    p_leaderboard_type,
    p_period,
    CASE WHEN p_period IN ('monthly', 'weekly') THEN p_year ELSE NULL END,
    CASE WHEN p_period = 'monthly' THEN p_month ELSE NULL END,
    CASE WHEN p_period = 'weekly' THEN p_week ELSE NULL END,
    COALESCE(rankings, '[]'::jsonb),
    now()
  )
  ON CONFLICT (leaderboard_type, period, COALESCE(year, 0), COALESCE(month, 0), COALESCE(week, 0))
  DO UPDATE SET
    rankings = EXCLUDED.rankings,
    calculated_at = EXCLUDED.calculated_at;
END;
$$;

-- Function to get user's position in leaderboards
CREATE OR REPLACE FUNCTION get_user_leaderboard_positions(
  p_user_id uuid
)
RETURNS TABLE (
  leaderboard_type text,
  period text,
  rank integer,
  total_users integer,
  value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.leaderboard_type,
    l.period,
    (user_rank->>'rank')::integer as rank,
    jsonb_array_length(l.rankings) as total_users,
    (user_rank->>'value')::numeric as value
  FROM leaderboards l,
  jsonb_array_elements(l.rankings) as user_rank
  WHERE (user_rank->>'user_id')::uuid = p_user_id
    AND l.period = 'all_time'
  ORDER BY l.leaderboard_type;
END;
$$;

-- Function to get user badges
CREATE OR REPLACE FUNCTION get_user_badges(
  p_user_id uuid
)
RETURNS TABLE (
  badge_id uuid,
  badge_name text,
  badge_description text,
  badge_category text,
  badge_rarity text,
  awarded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as badge_id,
    b.name as badge_name,
    b.description as badge_description,
    b.category as badge_category,
    b.rarity as badge_rarity,
    ub.awarded_at
  FROM user_badges ub
  JOIN badges b ON ub.badge_id = b.id
  WHERE ub.user_id = p_user_id
  ORDER BY ub.awarded_at DESC;
END;
$$;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_statistics(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats_record user_statistics;
  streak_record user_streaks;
  leaderboard_positions jsonb;
  badges_earned jsonb;
  result jsonb;
BEGIN
  -- Get user statistics
  SELECT * INTO stats_record
  FROM user_statistics
  WHERE user_id = p_user_id;
  
  -- If no statistics found, calculate them
  IF NOT FOUND THEN
    PERFORM update_user_statistics(p_user_id);
    
    SELECT * INTO stats_record
    FROM user_statistics
    WHERE user_id = p_user_id;
  END IF;
  
  -- Get streak information
  SELECT * INTO streak_record
  FROM user_streaks
  WHERE user_id = p_user_id AND community_id IS NULL;
  
  -- Get leaderboard positions
  SELECT jsonb_agg(
    jsonb_build_object(
      'leaderboard_type', leaderboard_type,
      'period', period,
      'rank', rank,
      'total_users', total_users,
      'value', value
    )
  )
  INTO leaderboard_positions
  FROM get_user_leaderboard_positions(p_user_id);
  
  -- Get badges
  SELECT jsonb_agg(
    jsonb_build_object(
      'badge_id', badge_id,
      'badge_name', badge_name,
      'badge_description', badge_description,
      'badge_category', badge_category,
      'badge_rarity', badge_rarity,
      'awarded_at', awarded_at
    )
  )
  INTO badges_earned
  FROM get_user_badges(p_user_id);
  
  -- Build result
  result := jsonb_build_object(
    'user_id', p_user_id,
    'statistics', jsonb_build_object(
      'total_hours_logged', COALESCE(stats_record.total_hours_logged, 0),
      'communities_joined', COALESCE(stats_record.communities_joined, 0),
      'communities_won', COALESCE(stats_record.communities_won, 0),
      'communities_lost', COALESCE(stats_record.communities_lost, 0),
      'total_earnings', COALESCE(stats_record.total_earnings / 100.0, 0), -- Convert to dollars
      'total_losses', COALESCE(stats_record.total_losses / 100.0, 0), -- Convert to dollars
      'longest_streak', COALESCE(stats_record.longest_streak, 0),
      'current_streak', COALESCE(stats_record.current_streak, 0),
      'meetings_attended', COALESCE(stats_record.meetings_attended, 0),
      'goals_completed', COALESCE(stats_record.goals_completed, 0),
      'success_rate', COALESCE(stats_record.success_rate, 0),
      'platform_tenure_days', COALESCE(stats_record.platform_tenure_days, 0)
    ),
    'streak', CASE WHEN streak_record IS NULL THEN NULL ELSE jsonb_build_object(
      'current_streak', streak_record.current_streak,
      'longest_streak', streak_record.longest_streak,
      'last_active_date', streak_record.last_active_date,
      'streak_start_date', streak_record.streak_start_date
    ) END,
    'leaderboard_positions', COALESCE(leaderboard_positions, '[]'::jsonb),
    'badges', COALESCE(badges_earned, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$;

-- Trigger to update streaks when progress is logged
CREATE OR REPLACE FUNCTION trigger_update_streak_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate streak for the specific community
  PERFORM calculate_user_streak(NEW.user_id, NEW.community_id);
  
  -- Calculate overall streak (across all communities)
  PERFORM calculate_user_streak(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_streak_on_progress
  AFTER INSERT OR UPDATE ON member_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_streak_on_progress();

-- Trigger to update user statistics when progress is logged
CREATE OR REPLACE FUNCTION trigger_update_statistics_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user statistics
  PERFORM update_user_statistics(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_statistics_on_progress
  AFTER INSERT OR UPDATE ON member_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_statistics_on_progress();

-- Trigger to update user statistics when meeting attendance changes
CREATE OR REPLACE FUNCTION trigger_update_statistics_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user statistics
  PERFORM update_user_statistics(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_statistics_on_attendance
  AFTER INSERT OR UPDATE ON meeting_attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_statistics_on_attendance();

-- Trigger to update user statistics when earnings change
CREATE OR REPLACE FUNCTION trigger_update_statistics_on_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user statistics
  PERFORM update_user_statistics(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_statistics_on_earnings
  AFTER INSERT OR UPDATE ON earnings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_statistics_on_earnings();

-- Insert default badges
INSERT INTO badges (name, description, category, rarity, criteria, icon_name)
VALUES
  ('First Goal', 'Completed your first community goal', 'achievement', 'common', 
   '{"communities_won": 1}', 'target'),
  ('5 Communities Conquered', 'Successfully completed 5 community goals', 'achievement', 'rare', 
   '{"communities_won": 5}', 'award'),
  ('Goal Master', 'Successfully completed 10 community goals', 'achievement', 'epic', 
   '{"communities_won": 10}', 'trophy'),
  ('7-Day Streak', 'Maintained activity for 7 consecutive days', 'consistency', 'common', 
   '{"longest_streak": 7}', 'calendar'),
  ('30-Day Streak', 'Maintained activity for 30 consecutive days', 'consistency', 'rare', 
   '{"longest_streak": 30}', 'zap'),
  ('Streak Master', 'Maintained activity for 90 consecutive days', 'consistency', 'legendary', 
   '{"longest_streak": 90}', 'flame'),
  ('10 Hours Logged', 'Logged 10 hours of productive time', 'participation', 'common', 
   '{"total_hours_logged": 10}', 'clock'),
  ('100 Hours Logged', 'Logged 100 hours of productive time', 'participation', 'rare', 
   '{"total_hours_logged": 100}', 'hourglass'),
  ('Meeting Master', 'Attended 50 community meetings', 'participation', 'epic', 
   '{"meetings_attended": 50}', 'video'),
  ('High Achiever', 'Maintained a 90%+ success rate', 'community', 'epic', 
   '{"success_rate": 90, "communities_joined": 5}', 'star'),
  ('Big Winner', 'Earned $1000+ in rewards', 'community', 'legendary', 
   '{"total_earnings": 100000}', 'dollar-sign'),
  ('Consistency King', 'Completed all daily goals for 14 consecutive days', 'consistency', 'epic', 
   '{"longest_streak": 14}', 'crown');

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_user_streak TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION award_badges TO service_role;
GRANT EXECUTE ON FUNCTION update_leaderboards TO service_role;
GRANT EXECUTE ON FUNCTION get_user_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_leaderboard_positions TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_badges TO authenticated;