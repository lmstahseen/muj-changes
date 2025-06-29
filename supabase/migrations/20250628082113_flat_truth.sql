/*
  # Community Management Schema

  1. New Tables
    - `communities`
      - `id` (uuid, primary key)
      - `title` (text, community name)
      - `goal` (text, goal description)
      - `stake_amount` (integer, stake in cents)
      - `start_date` (date)
      - `end_date` (date)
      - `category` (text)
      - `max_members` (integer)
      - `weekly_meeting_days` (text array)
      - `daily_hours` (decimal)
      - `preferred_time` (time)
      - `description` (text)
      - `status` (text, default 'waiting')
      - `creator_id` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `community_members`
      - `id` (uuid, primary key)
      - `community_id` (uuid, references communities)
      - `user_id` (uuid, references auth.users)
      - `is_creator` (boolean, default false)
      - `joined_at` (timestamp)
      - `stake_paid` (boolean, default false)
      - `total_meeting_seconds` (integer, default 0)
      - `progress_percentage` (decimal, default 0)

    - `earnings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `community_id` (uuid, references communities)
      - `amount` (integer, amount in cents)
      - `type` (text, 'stake_payment', 'reward', 'forfeit')
      - `description` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for community creation and viewing
    - Allow public read access to communities for discovery
    - Restrict member operations to authenticated users
*/

-- Communities table
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  goal text NOT NULL,
  stake_amount integer NOT NULL CHECK (stake_amount >= 1000), -- minimum $10
  start_date date NOT NULL,
  end_date date NOT NULL,
  category text NOT NULL,
  max_members integer NOT NULL CHECK (max_members >= 3 AND max_members <= 50),
  weekly_meeting_days text[] NOT NULL DEFAULT '{}',
  daily_hours decimal(3,1) NOT NULL CHECK (daily_hours >= 0.5 AND daily_hours <= 8),
  preferred_time time NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
  creator_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT future_start_date CHECK (start_date >= CURRENT_DATE)
);

-- Community members table
CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_creator boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  stake_paid boolean DEFAULT false,
  total_meeting_seconds integer DEFAULT 0,
  progress_percentage decimal(5,2) DEFAULT 0.00,
  UNIQUE(community_id, user_id)
);

-- Earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- amount in cents (can be negative for stakes)
  type text NOT NULL CHECK (type IN ('stake_payment', 'reward', 'forfeit')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

-- Communities policies (public read, authenticated create)
CREATE POLICY "Anyone can view communities"
  ON communities
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create communities"
  ON communities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creators can update their communities"
  ON communities
  FOR UPDATE
  TO authenticated
  USING (creator_id::text = auth.uid()::text);

-- Community members policies
CREATE POLICY "Anyone can view community members"
  ON community_members
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can join communities"
  ON community_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update their own membership"
  ON community_members
  FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Earnings policies
CREATE POLICY "Users can view their own earnings"
  ON earnings
  FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "System can insert earnings"
  ON earnings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_communities_status ON communities(status);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_start_date ON communities(start_date);
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_community_id ON earnings(community_id);

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  -- This function can be used to maintain member counts if needed
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on communities
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();