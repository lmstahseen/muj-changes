/*
  # Create member progress calculation function

  1. New Functions
    - `calculate_member_progress` - Calculates member progress percentage based on attendance and goals
    - `update_community_status` - Updates community status based on dates
  
  2. Function Details
    - Calculates progress based on meeting attendance, hours logged, and goals completed
    - Returns progress percentage as a decimal between 0 and 100
    - Handles edge cases where no data exists
  
  3. Security
    - Functions are accessible to authenticated users
    - No RLS policies needed for functions
*/

-- Function to calculate member progress percentage
CREATE OR REPLACE FUNCTION calculate_member_progress(
  p_community_id uuid,
  p_user_id uuid
) RETURNS numeric AS $$
DECLARE
  v_community_duration integer;
  v_days_elapsed integer;
  v_total_hours_logged numeric;
  v_required_hours numeric;
  v_meetings_attended integer;
  v_total_meetings integer;
  v_goals_completed integer;
  v_progress_percentage numeric;
  v_community_start_date date;
  v_community_daily_hours numeric;
BEGIN
  -- Get community details
  SELECT start_date, daily_hours, end_date
  INTO v_community_start_date, v_community_daily_hours, v_community_duration
  FROM communities 
  WHERE id = p_community_id;
  
  -- If community not found, return 0
  IF v_community_start_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate days elapsed since start (or 0 if not started yet)
  v_days_elapsed := GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - v_community_start_date))::integer);
  
  -- Calculate required hours based on days elapsed
  v_required_hours := v_days_elapsed * v_community_daily_hours;
  
  -- Get total hours logged by the member
  SELECT COALESCE(SUM(hours_logged), 0)
  INTO v_total_hours_logged
  FROM member_progress
  WHERE community_id = p_community_id AND user_id = p_user_id;
  
  -- Get meetings attended
  SELECT COUNT(*)
  INTO v_meetings_attended
  FROM meeting_attendance
  WHERE community_id = p_community_id AND user_id = p_user_id;
  
  -- Get total meetings held
  SELECT COUNT(*)
  INTO v_total_meetings
  FROM meeting_sessions
  WHERE community_id = p_community_id AND status = 'completed';
  
  -- Get total goals completed
  SELECT COALESCE(SUM(goals_completed), 0)
  INTO v_goals_completed
  FROM member_progress
  WHERE community_id = p_community_id AND user_id = p_user_id;
  
  -- Calculate progress percentage (weighted average)
  -- 50% weight on hours logged, 30% on meeting attendance, 20% on goals
  v_progress_percentage := 0;
  
  -- Hours progress (50% weight)
  IF v_required_hours > 0 THEN
    v_progress_percentage := v_progress_percentage + (LEAST(v_total_hours_logged / v_required_hours, 1.0) * 50);
  END IF;
  
  -- Meeting attendance progress (30% weight)
  IF v_total_meetings > 0 THEN
    v_progress_percentage := v_progress_percentage + ((v_meetings_attended::numeric / v_total_meetings) * 30);
  END IF;
  
  -- Goals progress (20% weight) - assuming 1 goal per day as baseline
  IF v_days_elapsed > 0 THEN
    v_progress_percentage := v_progress_percentage + (LEAST(v_goals_completed::numeric / v_days_elapsed, 1.0) * 20);
  END IF;
  
  -- Update the member's progress in community_members table
  UPDATE community_members 
  SET progress_percentage = v_progress_percentage
  WHERE community_id = p_community_id AND user_id = p_user_id;
  
  RETURN v_progress_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update community status based on dates
CREATE OR REPLACE FUNCTION update_community_status() RETURNS void AS $$
BEGIN
  -- Update communities to active if start date has passed and they have enough members
  UPDATE communities 
  SET status = 'active'
  WHERE status = 'waiting' 
    AND start_date <= CURRENT_DATE
    AND (
      SELECT COUNT(*) 
      FROM community_members 
      WHERE community_id = communities.id
    ) >= 3;
  
  -- Update communities to ended if end date has passed
  UPDATE communities 
  SET status = 'ended'
  WHERE status = 'active' 
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION calculate_member_progress(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_community_status() TO authenticated;