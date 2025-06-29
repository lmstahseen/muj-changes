import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Export a flag to check if we're in demo mode
export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

// Enhanced types for our database tables
export interface Community {
  id: string;
  title: string;
  goal: string;
  stake_amount: number;
  start_date: string;
  end_date: string;
  category: string;
  max_members: number;
  weekly_meeting_days: string[];
  total_minimum_hours: number;
  preferred_time_period: string;
  preferred_time: string;
  start_time: string;
  end_time: string;
  description: string;
  status: 'waiting' | 'active' | 'ended';
  creator_id: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  creator_name?: string;
  analytics?: any;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  is_creator: boolean;
  joined_at: string;
  stake_paid: boolean;
  total_meeting_seconds: number;
  progress_percentage: number;
  is_disqualified: boolean;
}

export interface Earning {
  id: string;
  user_id: string;
  community_id: string;
  amount: number;
  type: 'stake_payment' | 'reward' | 'forfeit';
  description: string;
  created_at: string;
}

export interface CreateCommunityData {
  title: string;
  goal: string;
  stake_amount: number;
  start_date: string;
  end_date: string;
  category: string;
  max_members: number;
  weekly_meeting_days: string[];
  total_minimum_hours: number;
  preferred_time_period: string;
  preferred_time: string;
  start_time: string;
  end_time: string;
  description: string;
}

// Utility functions for data formatting
export const formatStakeAmount = (amountInCents: number): string => {
  return (amountInCents / 100).toFixed(0);
};

export const formatCurrency = (amountInCents: number): string => {
  return `$${(amountInCents / 100).toLocaleString()}`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

export const getDaysLeft = (endDate: string): number => {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

export const getTimeUntilStart = (startDate: string): string => {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = start.getTime() - now.getTime();
  
  if (diffTime <= 0) return 'Started';
  
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
};

export const getTimeUntilEnd = (endDate: string): string => {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  
  if (diffTime <= 0) return 'Ended';
  
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
};

export const calculateProgress = (current: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
};

// Import React for lazy loading
import React from 'react';