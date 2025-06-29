-- Enhanced earnings table with better transaction tracking
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS transaction_id uuid DEFAULT gen_random_uuid();
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS transaction_status text DEFAULT 'completed' CHECK (transaction_status IN ('pending', 'completed', 'failed', 'reversed'));
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS processed_at timestamptz DEFAULT now();
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS platform_fee_amount integer DEFAULT 0;

-- User payout details table
CREATE TABLE IF NOT EXISTS user_payout_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  preferred_method text DEFAULT 'bank_transfer' CHECK (preferred_method IN ('bank_transfer', 'paypal', 'crypto')),
  bank_account_number text,
  bank_routing_number text,
  bank_account_holder text,
  paypal_email text,
  crypto_wallet_address text,
  crypto_currency text,
  minimum_payout_threshold integer DEFAULT 2500, -- $25.00 in cents
  auto_payout_enabled boolean DEFAULT false,
  verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  verification_documents jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Community rewards table for distribution tracking
CREATE TABLE IF NOT EXISTS community_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  total_stake_pool integer NOT NULL DEFAULT 0,
  platform_fee_amount integer NOT NULL DEFAULT 0,
  distributable_amount integer NOT NULL DEFAULT 0,
  winner_count integer DEFAULT 0,
  reward_per_winner integer DEFAULT 0,
  distribution_date timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'distributed', 'failed')),
  distribution_criteria jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transaction logs for comprehensive audit trails
CREATE TABLE IF NOT EXISTS transaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('stake_payment', 'reward_distribution', 'penalty', 'refund', 'platform_fee')),
  amount integer NOT NULL,
  balance_before integer DEFAULT 0,
  balance_after integer DEFAULT 0,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Wallet analytics for performance tracking
CREATE TABLE IF NOT EXISTS wallet_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date DEFAULT CURRENT_DATE,
  total_earnings integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  net_balance integer DEFAULT 0,
  communities_joined integer DEFAULT 0,
  communities_won integer DEFAULT 0,
  communities_lost integer DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0.00,
  roi_percentage numeric(8,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Platform analytics for overall statistics
CREATE TABLE IF NOT EXISTS platform_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date DEFAULT CURRENT_DATE,
  total_users integer DEFAULT 0,
  active_users integer DEFAULT 0,
  total_communities integer DEFAULT 0,
  active_communities integer DEFAULT 0,
  total_stakes_collected integer DEFAULT 0,
  total_rewards_distributed integer DEFAULT 0,
  platform_fees_collected integer DEFAULT 0,
  average_success_rate numeric(5,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_earnings_transaction_id ON earnings(transaction_id);
CREATE INDEX IF NOT EXISTS idx_earnings_user_date ON earnings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_community_type ON earnings(community_id, type);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_user_date ON transaction_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_transaction_id ON transaction_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_wallet_analytics_user_date ON wallet_analytics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_community_rewards_status ON community_rewards(status, created_at);

-- Function to simulate stake payment
CREATE OR REPLACE FUNCTION simulate_stake_payment(
  p_user_id uuid,
  p_community_id uuid,
  p_amount integer,
  p_description text,
  p_payment_method text DEFAULT 'credit_card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transaction_id uuid;
  current_balance integer;
  result jsonb;
BEGIN
  -- Generate transaction ID
  transaction_id := gen_random_uuid();
  
  -- Get current user balance
  SELECT COALESCE(SUM(amount), 0) INTO current_balance
  FROM earnings
  WHERE user_id = p_user_id;
  
  -- Simulate payment processing delay
  PERFORM pg_sleep(random() * 2 + 1); -- 1-3 seconds
  
  -- Simulate 5% failure rate
  IF random() < 0.05 THEN
    -- Log failed transaction
    INSERT INTO transaction_logs (
      transaction_id, user_id, community_id, transaction_type,
      amount, balance_before, balance_after, description, metadata
    )
    VALUES (
      transaction_id, p_user_id, p_community_id, 'stake_payment',
      -p_amount, current_balance, current_balance,
      'Failed: ' || p_description,
      jsonb_build_object('payment_method', p_payment_method, 'status', 'failed')
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'transaction_id', transaction_id,
      'error', 'Payment processing failed. Please try again.',
      'retry_allowed', true
    );
  END IF;
  
  -- Record successful stake payment
  INSERT INTO earnings (
    user_id, community_id, amount, type, description,
    transaction_id, transaction_status, metadata, processed_at
  )
  VALUES (
    p_user_id, p_community_id, -p_amount, 'stake_payment', p_description,
    transaction_id, 'completed',
    jsonb_build_object('payment_method', p_payment_method, 'simulated', true),
    now()
  );
  
  -- Log transaction
  INSERT INTO transaction_logs (
    transaction_id, user_id, community_id, transaction_type,
    amount, balance_before, balance_after, description, metadata
  )
  VALUES (
    transaction_id, p_user_id, p_community_id, 'stake_payment',
    -p_amount, current_balance, current_balance - p_amount,
    p_description,
    jsonb_build_object('payment_method', p_payment_method, 'status', 'completed')
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'amount', p_amount,
    'new_balance', current_balance - p_amount,
    'receipt_number', 'SIM-' || EXTRACT(EPOCH FROM now())::bigint
  );
END;
$$;

-- Function to calculate community earnings distribution
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
  
  -- Calculate minimum required meeting hours (80% of total expected)
  min_meeting_hours := (
    EXTRACT(DAYS FROM (community_record.end_date::date - community_record.start_date::date)) *
    community_record.daily_hours * 0.8
  );
  
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
    -- Winner criteria: not disqualified AND (meeting hours >= minimum OR progress >= 80%)
    IF NOT member_record.is_disqualified AND 
       (member_record.meeting_hours >= min_meeting_hours OR member_record.progress_percentage >= 80) THEN
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
      'criteria', 'meeting_hours >= minimum OR progress >= 80%',
      'winners', winners
    )
  );
  
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

-- Function to distribute community earnings
CREATE OR REPLACE FUNCTION distribute_community_earnings(
  p_community_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reward_record RECORD;
  winner_data jsonb;
  winner_user_id uuid;
  transaction_id uuid;
  distribution_count integer := 0;
BEGIN
  -- Get calculated distribution
  SELECT * INTO reward_record 
  FROM community_rewards 
  WHERE community_id = p_community_id AND status = 'calculated'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No calculated distribution found');
  END IF;
  
  -- Distribute rewards to winners
  FOR winner_data IN SELECT * FROM jsonb_array_elements(reward_record.distribution_criteria->'winners')
  LOOP
    winner_user_id := (winner_data->>'user_id')::uuid;
    transaction_id := gen_random_uuid();
    
    -- Record reward earning
    INSERT INTO earnings (
      user_id, community_id, amount, type, description,
      transaction_id, transaction_status, metadata, processed_at
    )
    VALUES (
      winner_user_id, p_community_id, reward_record.reward_per_winner, 'reward',
      'Community completion reward - congratulations!',
      transaction_id, 'completed',
      jsonb_build_object(
        'distribution_id', reward_record.id,
        'winner_criteria', winner_data,
        'automated_distribution', true
      ),
      now()
    );
    
    -- Log transaction
    INSERT INTO transaction_logs (
      transaction_id, user_id, community_id, transaction_type,
      amount, description, metadata
    )
    VALUES (
      transaction_id, winner_user_id, p_community_id, 'reward_distribution',
      reward_record.reward_per_winner,
      'Automated community reward distribution',
      jsonb_build_object('distribution_id', reward_record.id)
    );
    
    distribution_count := distribution_count + 1;
  END LOOP;
  
  -- Record platform fee
  IF reward_record.platform_fee_amount > 0 THEN
    transaction_id := gen_random_uuid();
    
    INSERT INTO transaction_logs (
      transaction_id, user_id, community_id, transaction_type,
      amount, description, metadata
    )
    VALUES (
      transaction_id, '00000000-0000-0000-0000-000000000000'::uuid, p_community_id, 'platform_fee',
      reward_record.platform_fee_amount,
      'Platform fee (10% of stake pool)',
      jsonb_build_object('distribution_id', reward_record.id)
    );
  END IF;
  
  -- Update distribution status
  UPDATE community_rewards
  SET 
    status = 'distributed',
    distribution_date = now(),
    updated_at = now()
  WHERE id = reward_record.id;
  
  -- Send notifications to all community members
  PERFORM notify_distribution_complete(p_community_id, reward_record.id);
  
  RETURN jsonb_build_object(
    'success', true,
    'distributions_sent', distribution_count,
    'total_distributed', reward_record.reward_per_winner * distribution_count,
    'platform_fee', reward_record.platform_fee_amount
  );
END;
$$;

-- Function to process community end and trigger distribution
CREATE OR REPLACE FUNCTION process_community_end(
  p_community_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calculation_result jsonb;
  distribution_result jsonb;
BEGIN
  -- First calculate the distribution
  SELECT calculate_community_distribution(p_community_id) INTO calculation_result;
  
  IF NOT (calculation_result->>'success')::boolean THEN
    RETURN calculation_result;
  END IF;
  
  -- Then distribute the earnings
  SELECT distribute_community_earnings(p_community_id) INTO distribution_result;
  
  RETURN jsonb_build_object(
    'success', true,
    'calculation', calculation_result,
    'distribution', distribution_result
  );
END;
$$;

-- Function to get user wallet summary
CREATE OR REPLACE FUNCTION get_user_wallet_summary(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_earnings integer;
  total_losses integer;
  net_balance integer;
  pending_stakes integer;
  total_communities integer;
  won_communities integer;
  success_rate numeric;
  recent_transactions jsonb;
BEGIN
  -- Calculate totals
  SELECT 
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO total_earnings, total_losses, net_balance
  FROM earnings
  WHERE user_id = p_user_id;
  
  -- Calculate pending stakes (active communities)
  SELECT COALESCE(SUM(ABS(e.amount)), 0) INTO pending_stakes
  FROM earnings e
  JOIN communities c ON e.community_id = c.id
  WHERE e.user_id = p_user_id 
    AND e.type = 'stake_payment' 
    AND c.status = 'active';
  
  -- Calculate community statistics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM earnings 
      WHERE user_id = p_user_id 
        AND community_id = cm.community_id 
        AND type = 'reward'
    ))
  INTO total_communities, won_communities
  FROM community_members cm
  WHERE cm.user_id = p_user_id;
  
  -- Calculate success rate
  success_rate := CASE 
    WHEN total_communities > 0 THEN (won_communities::numeric / total_communities * 100)
    ELSE 0 
  END;
  
  -- Get recent transactions
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'amount', amount,
      'type', type,
      'description', description,
      'created_at', created_at,
      'transaction_id', transaction_id
    ) ORDER BY created_at DESC
  ) INTO recent_transactions
  FROM (
    SELECT * FROM earnings 
    WHERE user_id = p_user_id 
    ORDER BY created_at DESC 
    LIMIT 10
  ) recent;
  
  RETURN jsonb_build_object(
    'total_earnings', total_earnings,
    'total_losses', total_losses,
    'net_balance', net_balance,
    'pending_stakes', pending_stakes,
    'total_communities', total_communities,
    'won_communities', won_communities,
    'success_rate', success_rate,
    'recent_transactions', COALESCE(recent_transactions, '[]'::jsonb)
  );
END;
$$;

-- Function to calculate user ROI
CREATE OR REPLACE FUNCTION calculate_user_roi(
  p_user_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_date timestamptz;
  total_invested integer;
  total_returned integer;
  roi_percentage numeric;
  monthly_data jsonb;
BEGIN
  start_date := now() - (p_days || ' days')::interval;
  
  -- Calculate investment and returns in the period
  SELECT 
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)
  INTO total_invested, total_returned
  FROM earnings
  WHERE user_id = p_user_id 
    AND created_at >= start_date;
  
  -- Calculate ROI percentage
  roi_percentage := CASE 
    WHEN total_invested > 0 THEN ((total_returned - total_invested)::numeric / total_invested * 100)
    ELSE 0 
  END;
  
  -- Get monthly breakdown
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', month_year,
      'invested', invested,
      'returned', returned,
      'net', returned - invested
    ) ORDER BY month_year
  ) INTO monthly_data
  FROM (
    SELECT 
      to_char(created_at, 'YYYY-MM') as month_year,
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as invested,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as returned
    FROM earnings
    WHERE user_id = p_user_id 
      AND created_at >= start_date
    GROUP BY to_char(created_at, 'YYYY-MM')
  ) monthly;
  
  RETURN jsonb_build_object(
    'period_days', p_days,
    'total_invested', total_invested,
    'total_returned', total_returned,
    'net_profit', total_returned - total_invested,
    'roi_percentage', roi_percentage,
    'monthly_breakdown', COALESCE(monthly_data, '[]'::jsonb)
  );
END;
$$;

-- Function to get platform financial statistics
CREATE OR REPLACE FUNCTION get_platform_financial_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users integer;
  active_users integer;
  total_stakes integer;
  total_rewards integer;
  platform_fees integer;
  avg_success_rate numeric;
BEGIN
  -- Get user counts
  SELECT 
    COUNT(DISTINCT user_id),
    COUNT(DISTINCT CASE WHEN created_at >= now() - interval '30 days' THEN user_id END)
  INTO total_users, active_users
  FROM earnings;
  
  -- Get financial totals
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'stake_payment' THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'reward' THEN amount ELSE 0 END), 0)
  INTO total_stakes, total_rewards
  FROM earnings;
  
  -- Calculate platform fees (10% of stakes)
  platform_fees := ROUND(total_stakes * 0.1);
  
  -- Calculate average success rate
  SELECT AVG(success_rate) INTO avg_success_rate
  FROM (
    SELECT 
      user_id,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM earnings e2 
            WHERE e2.user_id = cm.user_id 
              AND e2.community_id = cm.community_id 
              AND e2.type = 'reward'
          ))::numeric / COUNT(*) * 100)
        ELSE 0 
      END as success_rate
    FROM community_members cm
    GROUP BY user_id
  ) user_rates;
  
  RETURN jsonb_build_object(
    'total_users', total_users,
    'active_users', active_users,
    'total_stakes_collected', total_stakes,
    'total_rewards_distributed', total_rewards,
    'platform_fees_collected', platform_fees,
    'average_success_rate', COALESCE(avg_success_rate, 0)
  );
END;
$$;

-- Function to notify distribution completion
CREATE OR REPLACE FUNCTION notify_distribution_complete(
  p_community_id uuid,
  p_distribution_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record RECORD;
  reward_record RECORD;
  is_winner boolean;
BEGIN
  -- Get distribution details
  SELECT * INTO reward_record FROM community_rewards WHERE id = p_distribution_id;
  
  -- Notify all community members
  FOR member_record IN 
    SELECT user_id FROM community_members WHERE community_id = p_community_id
  LOOP
    -- Check if user is a winner
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(reward_record.distribution_criteria->'winners') as winner
      WHERE (winner->>'user_id')::uuid = member_record.user_id
    ) INTO is_winner;
    
    INSERT INTO chat_notifications (
      user_id, community_id, notification_type, title, content
    )
    VALUES (
      member_record.user_id, p_community_id, 'community_update',
      CASE WHEN is_winner THEN 'Congratulations! You Won!' ELSE 'Community Completed' END,
      CASE WHEN is_winner 
        THEN 'You successfully completed your goals and earned $' || (reward_record.reward_per_winner / 100.0)::text || '!'
        ELSE 'The community has ended. Check your wallet for final results.'
      END
    );
  END LOOP;
END;
$$;

-- Trigger to automatically process community end
CREATE OR REPLACE FUNCTION trigger_community_end_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- If community status changed to 'ended', trigger distribution
  IF OLD.status != 'ended' AND NEW.status = 'ended' THEN
    PERFORM process_community_end(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER community_end_distribution
  AFTER UPDATE OF status ON communities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_community_end_processing();

-- Function to update wallet analytics
CREATE OR REPLACE FUNCTION update_wallet_analytics(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today date := CURRENT_DATE;
  analytics_data RECORD;
BEGIN
  -- Calculate current analytics
  SELECT 
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_earnings,
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_losses,
    COALESCE(SUM(amount), 0) as net_balance,
    COUNT(DISTINCT community_id) as communities_joined,
    COUNT(DISTINCT CASE WHEN type = 'reward' THEN community_id END) as communities_won,
    COUNT(DISTINCT CASE WHEN type = 'stake_payment' THEN community_id END) - 
    COUNT(DISTINCT CASE WHEN type = 'reward' THEN community_id END) as communities_lost
  INTO analytics_data
  FROM earnings
  WHERE user_id = p_user_id;
  
  -- Calculate success rate and ROI
  INSERT INTO wallet_analytics (
    user_id, date, total_earnings, total_losses, net_balance,
    communities_joined, communities_won, communities_lost,
    success_rate, roi_percentage
  )
  VALUES (
    p_user_id, today, analytics_data.total_earnings, analytics_data.total_losses, analytics_data.net_balance,
    analytics_data.communities_joined, analytics_data.communities_won, analytics_data.communities_lost,
    CASE WHEN analytics_data.communities_joined > 0 
      THEN (analytics_data.communities_won::numeric / analytics_data.communities_joined * 100)
      ELSE 0 END,
    CASE WHEN analytics_data.total_losses > 0 
      THEN ((analytics_data.net_balance::numeric / analytics_data.total_losses) * 100)
      ELSE 0 END
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_earnings = EXCLUDED.total_earnings,
    total_losses = EXCLUDED.total_losses,
    net_balance = EXCLUDED.net_balance,
    communities_joined = EXCLUDED.communities_joined,
    communities_won = EXCLUDED.communities_won,
    communities_lost = EXCLUDED.communities_lost,
    success_rate = EXCLUDED.success_rate,
    roi_percentage = EXCLUDED.roi_percentage;
END;
$$;

-- Trigger to update analytics on earnings changes
CREATE OR REPLACE FUNCTION trigger_update_wallet_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_wallet_analytics(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER earnings_analytics_update
  AFTER INSERT OR UPDATE ON earnings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_wallet_analytics();

-- Add updated_at triggers
CREATE TRIGGER update_user_payout_details_updated_at
  BEFORE UPDATE ON user_payout_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_rewards_updated_at
  BEFORE UPDATE ON community_rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION simulate_stake_payment TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_community_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_community_earnings TO authenticated;
GRANT EXECUTE ON FUNCTION process_community_end TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_wallet_summary TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_roi TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_financial_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_wallet_analytics TO authenticated;