/*
  # Update Communities Schema for Time-Based Progress Tracking

  1. Schema Changes
    - Replace daily_hours with total_minimum_hours (integer, 10-500 hours)
    - Add preferred_time_period for 8 time period options (3-hour blocks)
    - Add start_time and end_time for precise scheduling
    
  2. Data Migration
    - Safely convert existing daily_hours to total_minimum_hours
    - Set default time periods based on existing preferred_time
    - Set default start/end times
    
  3. Function Updates
    - Update all functions to use new time-based progress tracking
    - Add community creation function with new fields
*/

-- Check if daily_hours column exists and handle migration accordingly
DO $$
BEGIN
  -- Add the new column with proper data type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'communities' AND column_name = 'total_minimum_hours'
  ) THEN
    ALTER TABLE communities ADD COLUMN total_minimum_hours integer;
  END IF;

  -- Convert daily_hours to total_minimum_hours if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'communities' AND column_name = 'daily_hours'
  ) THEN
    -- Convert daily_hours to total_minimum_hours safely
    -- Use ROUND to ensure we get integers and avoid numeric overflow
    UPDATE communities 
    SET total_minimum_hours = GREATEST(ROUND(daily_hours * 30), 10)
    WHERE total_minimum_hours IS NULL AND daily_hours IS NOT NULL;
  END IF;

  -- Set default for any remaining null values
  UPDATE communities 
  SET total_minimum_hours = 60 -- Default: 60 total hours
  WHERE total_minimum_hours IS NULL;
END $$;

-- Add preferred_time_period column
ALTER TABLE communities ADD COLUMN IF NOT EXISTS preferred_time_period text;

-- Update existing communities to use a default time period based on their preferred_time
UPDATE communities 
SET preferred_time_period = CASE 
  WHEN preferred_time IS NULL THEN '09:00-12:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 0 AND 2 THEN '00:00-03:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 3 AND 5 THEN '03:00-06:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 6 AND 8 THEN '06:00-09:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 9 AND 11 THEN '09:00-12:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 12 AND 14 THEN '12:00-15:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 15 AND 17 THEN '15:00-18:00'
  WHEN EXTRACT(HOUR FROM preferred_time::time) BETWEEN 18 AND 20 THEN '18:00-21:00'
  ELSE '21:00-24:00'
END
WHERE preferred_time_period IS NULL;

-- Add start_time and end_time columns for more precise scheduling
ALTER TABLE communities ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS end_time time;

-- Set default times based on existing preferred_time
UPDATE communities 
SET 
  start_time = COALESCE(preferred_time::time, '09:00'::time),
  end_time = COALESCE((preferred_time::time + interval '2 hours')::time, '11:00'::time)
WHERE start_time IS NULL;

-- Add constraint for total_minimum_hours (check if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'communities' 
    AND constraint_name = 'communities_total_minimum_hours_check'
  ) THEN
    ALTER TABLE communities ADD CONSTRAINT communities_total_minimum_hours_check 
      CHECK ((total_minimum_hours >= 10) AND (total_minimum_hours <= 500));
  END IF;
END $$;

-- Drop the old daily_hours constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'communities' 
    AND constraint_name = 'communities_daily_hours_check'
  ) THEN
    ALTER TABLE communities DROP CONSTRAINT communities_daily_hours_check;
  END IF;
END $$;

-- Drop the old column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'communities' AND column_name = 'daily_hours'
  ) THEN
    ALTER TABLE communities DROP COLUMN daily_hours;
  END IF;
END $$;

-- Update functions that reference daily_hours
CREATE OR REPLACE FUNCTION calculate_community_distribution(
  p_community_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_record RECORD;
  member_record RECORD;
  total_stake_pool integer := 0;
  platform_fee integer := 0;
  distributable_amount integer := 0;
  winner_count integer := 0;
  reward_per_winner integer := 0;
  min_meeting_hours numeric;
  distribution_result jsonb := '{}';
  winners jsonb := '[]';
BEGIN
  -- Get community details
  SELECT * INTO community_record FROM communities WHERE id = p_community_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community not found');
  END IF;
  
  -- Calculate minimum required meeting hours (80% of total minimum hours)
  min_meeting_hours := community_record.total_minimum_hours * 0.8;
  
  -- Calculate total stake pool
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO total_stake_pool
  FROM earnings
  WHERE community_id = p_community_id AND type = 'stake_payment';
  
  -- Calculate platform fee (10%)
  platform_fee := ROUND(total_stake_pool * 0.1);
  distributable_amount := total_stake_pool - platform_fee;
  
  -- Determine winners based on criteria
  FOR member_record IN
    SELECT 
      cm.user_id,
      cm.total_meeting_seconds,
      cm.progress_percentage,
      cm.is_disqualified,
      (cm.total_meeting_seconds / 3600.0) as meeting_hours
    FROM community_members cm
    WHERE cm.community_id = p_community_id
  LOOP
    -- Winner criteria: not disqualified AND meeting hours >= minimum required
    IF NOT member_record.is_disqualified AND 
       member_record.meeting_hours >= min_meeting_hours THEN
      winner_count := winner_count + 1;
      winners := winners || jsonb_build_object(
        'user_id', member_record.user_id,
        'meeting_hours', member_record.meeting_hours,
        'progress_percentage', member_record.progress_percentage
      );
    END IF;
  END LOOP;
  
  -- Calculate reward per winner
  IF winner_count > 0 THEN
    reward_per_winner := FLOOR(distributable_amount / winner_count);
  END IF;
  
  -- Store distribution calculation
  INSERT INTO community_rewards (
    community_id, total_stake_pool, platform_fee_amount, distributable_amount,
    winner_count, reward_per_winner, status, distribution_criteria
  )
  VALUES (
    p_community_id, total_stake_pool, platform_fee, distributable_amount,
    winner_count, reward_per_winner, 'calculated',
    jsonb_build_object(
      'min_meeting_hours', min_meeting_hours,
      'criteria', 'meeting_hours >= ' || min_meeting_hours || ' hours',
      'winners', winners
    )
  )
  ON CONFLICT (community_id) DO UPDATE SET
    total_stake_pool = EXCLUDED.total_stake_pool,
    platform_fee_amount = EXCLUDED.platform_fee_amount,
    distributable_amount = EXCLUDED.distributable_amount,
    winner_count = EXCLUDED.winner_count,
    reward_per_winner = EXCLUDED.reward_per_winner,
    status = EXCLUDED.status,
    distribution_criteria = EXCLUDED.distribution_criteria,
    updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true,
    'total_stake_pool', total_stake_pool,
    'platform_fee', platform_fee,
    'distributable_amount', distributable_amount,
    'winner_count', winner_count,
    'reward_per_winner', reward_per_winner,
    'winners', winners
  );
END;
$$;

-- Update the fallback progress calculation function
CREATE OR REPLACE FUNCTION calculate_member_progress_fallback(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_record RECORD;
  member_record RECORD;
  progress_percentage numeric := 0;
BEGIN
  -- Get community details
  SELECT * INTO community_record FROM communities WHERE id = p_community_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Get member details
  SELECT * INTO member_record FROM community_members 
  WHERE community_id = p_community_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Calculate progress based on meeting hours vs required minimum hours
  IF community_record.total_minimum_hours > 0 THEN
    progress_percentage := LEAST(
      ((member_record.total_meeting_seconds / 3600.0) / community_record.total_minimum_hours) * 100,
      100
    );
  END IF;
  
  -- Update the member's progress
  UPDATE community_members
  SET progress_percentage = progress_percentage
  WHERE community_id = p_community_id AND user_id = p_user_id;
  
  RETURN progress_percentage;
END;
$$;

-- Add function to get community requirements
CREATE OR REPLACE FUNCTION get_community_requirements(
  p_community_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_record RECORD;
BEGIN
  SELECT * INTO community_record FROM communities WHERE id = p_community_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community not found');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_minimum_hours', community_record.total_minimum_hours,
    'preferred_time_period', community_record.preferred_time_period,
    'start_time', community_record.start_time,
    'end_time', community_record.end_time,
    'weekly_meeting_days', community_record.weekly_meeting_days
  );
END;
$$;

-- Update community creation function to handle new fields
CREATE OR REPLACE FUNCTION create_community_with_creator(
  p_title text,
  p_goal text,
  p_stake_amount integer,
  p_start_date date,
  p_end_date date,
  p_category text,
  p_max_members integer,
  p_weekly_meeting_days text[],
  p_total_minimum_hours integer,
  p_preferred_time_period text,
  p_start_time time,
  p_end_time time,
  p_description text,
  p_creator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_community_id uuid;
  creator_stake_amount integer;
BEGIN
  -- Insert the community
  INSERT INTO communities (
    title, goal, stake_amount, start_date, end_date, category, max_members,
    weekly_meeting_days, total_minimum_hours, preferred_time_period,
    start_time, end_time, description, creator_id, status
  )
  VALUES (
    p_title, p_goal, p_stake_amount, p_start_date, p_end_date, p_category, p_max_members,
    p_weekly_meeting_days, p_total_minimum_hours, p_preferred_time_period,
    p_start_time, p_end_time, p_description, p_creator_id, 'waiting'
  )
  RETURNING id INTO new_community_id;
  
  -- Add creator as first member
  INSERT INTO community_members (
    community_id, user_id, is_creator, stake_paid
  )
  VALUES (
    new_community_id, p_creator_id, true, true
  );
  
  -- Creator pays the same stake amount as members (not 10%)
  creator_stake_amount := p_stake_amount;
  
  -- Record creator stake payment
  INSERT INTO earnings (
    user_id, community_id, amount, type, description
  )
  VALUES (
    p_creator_id, new_community_id, -creator_stake_amount, 'stake_payment', 'Creator stake payment'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'community_id', new_community_id,
    'creator_stake_amount', creator_stake_amount
  );
END;
$$;