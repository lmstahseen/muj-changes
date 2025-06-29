/*
  # Complete Community Management System

  1. New Tables
    - `meeting_sessions` - Track individual community meetings
    - `meeting_attendance` - Track member attendance at meetings
    - `community_analytics` - Store community performance metrics
    - `member_progress` - Track daily progress for each member
    - `community_rewards` - Handle reward distribution

  2. Functions
    - `update_community_status()` - Automatically transition community status
    - `calculate_member_progress()` - Calculate member completion percentage
    - `distribute_community_rewards()` - Handle reward distribution
    - `create_community_meetings()` - Generate scheduled meetings

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for data access
    - Maintain data integrity with proper constraints
*/

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create meeting_sessions table for tracking individual meetings
CREATE TABLE IF NOT EXISTS meeting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  meeting_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create meeting_attendance table for tracking who attended meetings
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_session_id uuid NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer DEFAULT 0,
  screen_shared boolean DEFAULT false,
  participation_score numeric(3,2) DEFAULT 0.00 CHECK (participation_score >= 0 AND participation_score <= 1),
  created_at timestamptz DEFAULT now()
);

-- Create community_analytics table for tracking community performance
CREATE TABLE IF NOT EXISTS community_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_members integer DEFAULT 0,
  active_members integer DEFAULT 0,
  total_meetings_held integer DEFAULT 0,
  average_attendance_rate numeric(5,2) DEFAULT 0.00,
  total_hours_logged numeric(10,2) DEFAULT 0.00,
  completion_rate numeric(5,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  UNIQUE(community_id, date)
);

-- Create member_progress table for detailed progress tracking
CREATE TABLE IF NOT EXISTS member_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  hours_logged numeric(5,2) DEFAULT 0.00,
  meetings_attended integer DEFAULT 0,
  goals_completed integer DEFAULT 0,
  daily_goal_met boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(community_id, user_id, date)
);

-- Create community_rewards table for tracking reward distribution
CREATE TABLE IF NOT EXISTS community_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  total_stake_pool integer NOT NULL DEFAULT 0,
  winner_count integer DEFAULT 0,
  reward_per_winner integer DEFAULT 0,
  distribution_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'distributed')),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_community_date ON meeting_sessions(community_id, session_date);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_session ON meeting_attendance(meeting_session_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_user ON meeting_attendance(user_id, community_id);
CREATE INDEX IF NOT EXISTS idx_community_analytics_date ON community_analytics(community_id, date);
CREATE INDEX IF NOT EXISTS idx_member_progress_user_date ON member_progress(user_id, date);
CREATE INDEX IF NOT EXISTS idx_member_progress_community_date ON member_progress(community_id, date);

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_sessions_updated_at ON meeting_sessions;
CREATE TRIGGER update_meeting_sessions_updated_at
  BEFORE UPDATE ON meeting_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_progress_updated_at ON member_progress;
CREATE TRIGGER update_member_progress_updated_at
  BEFORE UPDATE ON member_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically transition community status
CREATE OR REPLACE FUNCTION update_community_status()
RETURNS void AS $$
BEGIN
  -- Transition from waiting to active
  UPDATE communities 
  SET status = 'active', updated_at = now()
  WHERE status = 'waiting' 
    AND start_date <= CURRENT_DATE;

  -- Transition from active to ended
  UPDATE communities 
  SET status = 'ended', updated_at = now()
  WHERE status = 'active' 
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate member progress
CREATE OR REPLACE FUNCTION calculate_member_progress(p_community_id uuid, p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  total_required_hours numeric;
  total_logged_hours numeric;
  total_required_meetings integer;
  total_attended_meetings integer;
  progress_percentage numeric;
  community_data record;
BEGIN
  -- Get community requirements
  SELECT daily_hours, weekly_meeting_days, start_date, end_date
  INTO community_data
  FROM communities 
  WHERE id = p_community_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate total required hours (daily_hours * number of days)
  total_required_hours := community_data.daily_hours * 
    (EXTRACT(days FROM (community_data.end_date - community_data.start_date)) + 1);

  -- Calculate total required meetings
  total_required_meetings := array_length(community_data.weekly_meeting_days, 1) * 
    CEIL(EXTRACT(days FROM (community_data.end_date - community_data.start_date)) / 7.0);

  -- Get member's logged hours
  SELECT COALESCE(SUM(hours_logged), 0)
  INTO total_logged_hours
  FROM member_progress
  WHERE community_id = p_community_id AND user_id = p_user_id;

  -- Get member's attended meetings
  SELECT COUNT(*)
  INTO total_attended_meetings
  FROM meeting_attendance ma
  JOIN meeting_sessions ms ON ma.meeting_session_id = ms.id
  WHERE ma.community_id = p_community_id 
    AND ma.user_id = p_user_id
    AND ms.status = 'completed';

  -- Calculate progress (weighted: 70% hours, 30% meetings)
  progress_percentage := (
    (LEAST(total_logged_hours / NULLIF(total_required_hours, 0), 1.0) * 0.7) +
    (LEAST(total_attended_meetings::numeric / NULLIF(total_required_meetings, 0), 1.0) * 0.3)
  ) * 100;

  -- Update member's progress in community_members table
  UPDATE community_members
  SET 
    total_meeting_seconds = total_attended_meetings * 3600, -- Approximate
    progress_percentage = COALESCE(progress_percentage, 0)
  WHERE community_id = p_community_id AND user_id = p_user_id;

  RETURN COALESCE(progress_percentage, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to distribute rewards when community ends
CREATE OR REPLACE FUNCTION distribute_community_rewards(p_community_id uuid)
RETURNS void AS $$
DECLARE
  community_data record;
  total_stake_pool integer;
  winner_count integer;
  reward_per_winner integer;
  member_record record;
BEGIN
  -- Get community data
  SELECT * INTO community_data
  FROM communities
  WHERE id = p_community_id AND status = 'ended';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calculate total stake pool
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO total_stake_pool
  FROM earnings
  WHERE community_id = p_community_id AND type = 'stake_payment';

  -- Count winners (members with >= 80% progress)
  SELECT COUNT(*)
  INTO winner_count
  FROM community_members
  WHERE community_id = p_community_id AND progress_percentage >= 80;

  -- Calculate reward per winner
  IF winner_count > 0 THEN
    reward_per_winner := total_stake_pool / winner_count;
  ELSE
    reward_per_winner := 0;
  END IF;

  -- Create reward record
  INSERT INTO community_rewards (
    community_id, total_stake_pool, winner_count, 
    reward_per_winner, distribution_date, status
  ) VALUES (
    p_community_id, total_stake_pool, winner_count,
    reward_per_winner, now(), 'calculated'
  );

  -- Distribute rewards to winners
  FOR member_record IN 
    SELECT user_id, progress_percentage
    FROM community_members
    WHERE community_id = p_community_id AND progress_percentage >= 80
  LOOP
    INSERT INTO earnings (
      user_id, community_id, amount, type, description
    ) VALUES (
      member_record.user_id, p_community_id, reward_per_winner,
      'reward', 'Community completion reward'
    );
  END LOOP;

  -- Update reward status
  UPDATE community_rewards
  SET status = 'distributed'
  WHERE community_id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create scheduled meetings for a community
CREATE OR REPLACE FUNCTION create_community_meetings(p_community_id uuid)
RETURNS void AS $$
DECLARE
  community_data record;
  loop_date date;
  meeting_day text;
  meeting_time time;
  day_of_week integer;
  target_day_of_week integer;
BEGIN
  -- Get community data
  SELECT start_date, end_date, weekly_meeting_days, preferred_time
  INTO community_data
  FROM communities
  WHERE id = p_community_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  loop_date := community_data.start_date;
  meeting_time := community_data.preferred_time;

  -- Create meetings for each day in the date range
  WHILE loop_date <= community_data.end_date LOOP
    day_of_week := EXTRACT(dow FROM loop_date);
    
    -- Check if current day is a meeting day
    FOREACH meeting_day IN ARRAY community_data.weekly_meeting_days LOOP
      -- Convert day name to number
      target_day_of_week := CASE 
        WHEN meeting_day = 'Sunday' THEN 0
        WHEN meeting_day = 'Monday' THEN 1
        WHEN meeting_day = 'Tuesday' THEN 2
        WHEN meeting_day = 'Wednesday' THEN 3
        WHEN meeting_day = 'Thursday' THEN 4
        WHEN meeting_day = 'Friday' THEN 5
        WHEN meeting_day = 'Saturday' THEN 6
        ELSE -1
      END;
      
      -- If this is a meeting day, create a session
      IF day_of_week = target_day_of_week THEN
        INSERT INTO meeting_sessions (
          community_id, session_date, start_time, status
        ) VALUES (
          p_community_id, 
          loop_date, 
          (loop_date + meeting_time)::timestamptz,
          'scheduled'
        );
      END IF;
    END LOOP;
    
    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create meetings when community becomes active
CREATE OR REPLACE FUNCTION trigger_create_meetings()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'waiting' AND NEW.status = 'active' THEN
    PERFORM create_community_meetings(NEW.id);
  END IF;
  
  IF OLD.status = 'active' AND NEW.status = 'ended' THEN
    PERFORM distribute_community_rewards(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_status_change ON communities;
CREATE TRIGGER community_status_change
  AFTER UPDATE OF status ON communities
  FOR EACH ROW EXECUTE FUNCTION trigger_create_meetings();

-- Enable RLS on new tables
ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_sessions
CREATE POLICY "Anyone can view meeting sessions"
  ON meeting_sessions FOR SELECT
  TO public USING (true);

CREATE POLICY "Community members can manage meetings"
  ON meeting_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = meeting_sessions.community_id 
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for meeting_attendance
CREATE POLICY "Users can view meeting attendance"
  ON meeting_attendance FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can manage their attendance"
  ON meeting_attendance FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for member_progress
CREATE POLICY "Users can view their progress"
  ON member_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their progress"
  ON member_progress FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for community_analytics
CREATE POLICY "Anyone can view community analytics"
  ON community_analytics FOR SELECT
  TO public USING (true);

CREATE POLICY "System can manage analytics"
  ON community_analytics FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for community_rewards
CREATE POLICY "Anyone can view community rewards"
  ON community_rewards FOR SELECT
  TO public USING (true);

CREATE POLICY "System can manage rewards"
  ON community_rewards FOR ALL
  TO authenticated
  USING (true);